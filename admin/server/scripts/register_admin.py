#!/usr/bin/env python3
"""Create or reset an allowlisted admin user on the server."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from physics_admin.auth import hash_password
from physics_admin.config import get_settings
from physics_admin.database import SessionLocal, init_db
from physics_admin.models import User
from physics_admin.security import is_email_allowed


def main() -> None:
    if len(sys.argv) != 3:
        print("Usage: register_admin.py <email> <password>", file=sys.stderr)
        sys.exit(1)
    email, password = sys.argv[1].lower(), sys.argv[2]
    if len(password) < 8:
        print("Password must be at least 8 characters", file=sys.stderr)
        sys.exit(1)

    settings = get_settings()
    if settings.is_production and not is_email_allowed(email):
        print(f"{email} is not in ADMIN_ALLOWED_EMAILS", file=sys.stderr)
        sys.exit(1)

    init_db()
    db = SessionLocal()
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        user = User(email=email, password_hash=hash_password(password))
        user.subscription_status = "active"
        db.add(user)
        print(f"Created admin user {email}")
    else:
        user.password_hash = hash_password(password)
        user.subscription_status = "active"
        print(f"Updated password for {email}")
    db.commit()
    db.close()


if __name__ == "__main__":
    main()
