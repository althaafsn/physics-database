from __future__ import annotations

import subprocess

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from physics_admin.config import get_settings
from physics_admin.database import init_db
from physics_admin.routes import router

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


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
