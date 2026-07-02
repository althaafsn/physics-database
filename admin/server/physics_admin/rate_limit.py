"""In-memory rate limiting.

Deliberately dependency-free: the API runs as a single uvicorn process on a
single small EC2 instance, so a per-process in-memory sliding window is
sufficient (and avoids adding Redis/etc. for a single-editor tool). If the
service is ever scaled to multiple workers/instances, this should move to a
shared store (e.g. Redis) instead.
"""

from __future__ import annotations

import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request, status


class SlidingWindowLimiter:
    def __init__(self, max_requests: int, window_seconds: float) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def hit(self, key: str) -> tuple[bool, float]:
        """Record a hit for `key`. Returns (allowed, retry_after_seconds)."""
        now = time.monotonic()
        bucket = self._hits[key]
        cutoff = now - self.window_seconds
        while bucket and bucket[0] < cutoff:
            bucket.popleft()
        if len(bucket) >= self.max_requests:
            retry_after = bucket[0] + self.window_seconds - now
            return False, max(retry_after, 0.0)
        bucket.append(now)
        return True, 0.0

    def sweep(self, max_keys: int = 10_000) -> None:
        """Drop stale/empty buckets so memory doesn't grow unbounded."""
        if len(self._hits) <= max_keys:
            return
        now = time.monotonic()
        cutoff = now - self.window_seconds
        stale = [k for k, bucket in self._hits.items() if not bucket or bucket[-1] < cutoff]
        for k in stale:
            del self._hits[k]


def client_ip(request: Request) -> str:
    # Caddy (reverse proxy) sets X-Forwarded-For; trust only the first hop
    # since Caddy is the only thing allowed to reach uvicorn (127.0.0.1).
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# Strict limiter for auth endpoints (login/register): expensive-ish (password
# hashing) and the most attractive target for brute-force/credential-stuffing.
auth_limiter = SlidingWindowLimiter(max_requests=10, window_seconds=300)

# Looser global limiter so a single IP cannot flood the single-process API.
global_limiter = SlidingWindowLimiter(max_requests=120, window_seconds=60)

# Strict limiter for the public, unauthenticated AI tutor endpoint - each
# request triggers a real (costed) LLM call, so this is tighter than the
# general API limiter. Threshold is configurable via TUTOR_RATE_LIMIT_PER_HOUR.
def _build_tutor_limiter() -> SlidingWindowLimiter:
    from physics_admin.config import get_settings

    settings = get_settings()
    return SlidingWindowLimiter(max_requests=settings.tutor_rate_limit_per_hour, window_seconds=3600)


tutor_limiter = _build_tutor_limiter()


def enforce_auth_rate_limit(request: Request) -> None:
    ip = client_ip(request)
    allowed, retry_after = auth_limiter.hit(f"auth:{ip}")
    auth_limiter.sweep()
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many attempts. Please wait and try again.",
            headers={"Retry-After": str(int(retry_after) + 1)},
        )


def enforce_tutor_rate_limit(request: Request) -> None:
    ip = client_ip(request)
    allowed, retry_after = tutor_limiter.hit(f"tutor:{ip}")
    tutor_limiter.sweep()
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="You've reached the AI tutor's hourly question limit. Please try again later.",
            headers={"Retry-After": str(int(retry_after) + 1)},
        )
