from physics_admin.rate_limit import SlidingWindowLimiter


def test_allows_up_to_the_limit():
    limiter = SlidingWindowLimiter(max_requests=3, window_seconds=60)
    for _ in range(3):
        allowed, _ = limiter.hit("k")
        assert allowed is True


def test_blocks_once_over_the_limit():
    limiter = SlidingWindowLimiter(max_requests=3, window_seconds=60)
    for _ in range(3):
        limiter.hit("k")
    allowed, retry_after = limiter.hit("k")
    assert allowed is False
    assert retry_after > 0


def test_keys_are_independent():
    limiter = SlidingWindowLimiter(max_requests=1, window_seconds=60)
    allowed_a, _ = limiter.hit("a")
    allowed_b, _ = limiter.hit("b")
    assert allowed_a is True
    assert allowed_b is True


def test_window_expires_old_hits():
    limiter = SlidingWindowLimiter(max_requests=1, window_seconds=0.05)
    allowed_first, _ = limiter.hit("k")
    assert allowed_first is True
    blocked, _ = limiter.hit("k")
    assert blocked is False

    import time

    time.sleep(0.1)
    allowed_after_wait, _ = limiter.hit("k")
    assert allowed_after_wait is True


def test_sweep_drops_stale_keys():
    limiter = SlidingWindowLimiter(max_requests=1, window_seconds=0.05)
    limiter.hit("stale")
    import time

    time.sleep(0.1)
    limiter.sweep(max_keys=0)
    assert "stale" not in limiter._hits
