#!/usr/bin/env python3
"""Local dev: set an editor account password. Usage: set_password.py email new_password"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from physics_admin.auth import hash_password
from physics_admin.database import SessionLocal, init_db
from physics_admin.models import User


def main() -> None:
    if len(sys.argv) != 3:
        print("Usage: set_password.py <email> <new_password>", file=sys.stderr)
        sys.exit(1)
    email, password = sys.argv[1].lower(), sys.argv[2]
    if len(password) < 8:
        print("Password must be at least 8 characters", file=sys.stderr)
        sys.exit(1)
    init_db()
    db = SessionLocal()
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        print(f"No user with email {email}", file=sys.stderr)
        sys.exit(1)
    user.password_hash = hash_password(password)
    db.commit()
    print(f"Password updated for {email}")


if __name__ == "__main__":
    main()
