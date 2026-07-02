from __future__ import annotations

import subprocess

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from physics_admin.config import get_settings
from physics_admin.database import init_db
from physics_admin.rate_limit import client_ip, global_limiter
from physics_admin.routes import router
from physics_admin.routes_solutions import router as solutions_router
from physics_admin.routes_tutor import router as tutor_router

settings = get_settings()

app = FastAPI(title="Physics DB Admin API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router, prefix="/api")
app.include_router(solutions_router, prefix="/api")
app.include_router(tutor_router, prefix="/api")


@app.middleware("http")
async def rate_limit_and_security_headers(request: Request, call_next):
    if request.url.path != "/health":
        allowed, retry_after = global_limiter.hit(f"global:{client_ip(request)}")
        if not allowed:
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={"detail": "Too many requests. Please slow down."},
                headers={"Retry-After": str(int(retry_after) + 1)},
            )
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if settings.is_production:
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
    return response


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
