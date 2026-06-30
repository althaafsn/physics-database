# Physics DB Admin API

FastAPI backend for the **Editor** section of the main Next.js app (`/admin/*`).

## Quick start

From repo root:

```bash
npm run dev:admin
```

- **Reader:** http://localhost:3000
- **Editor:** http://localhost:3000/admin/problems
- **API:** http://localhost:8000

Or run API only while using `npm run dev` separately:

```bash
cd admin/server
export PHYSICS_DB_ROOT="$(cd ../.. && pwd)"
export PYTHONPATH="$PHYSICS_DB_ROOT"
.venv/bin/uvicorn physics_admin.main:app --reload --port 8000
```

## Flow

1. Sign up at `/admin/signup`
2. Mock subscribe at `/admin/subscribe` (local dev, no Stripe)
3. Edit problems at `/admin/problems`
4. **Sync & export** updates `public/data/` for the reader

## Environment

Copy `admin/server/.env.example` → `admin/server/.env` if needed.

For local editing, keep `APP_ENV=development`, `ALLOW_MOCK_BILLING=true`, and
`ALLOW_PUBLIC_REGISTRATION=true`. With those set, any email can sign in locally
(the production allowlist only applies when `APP_ENV=production`).

`dev.sh` loads `admin/server/.env` and writes a stable `admin/server/.dev-jwt-secret`
when `JWT_SECRET` is empty so login tokens stay valid across API requests.

| Variable | Default |
|----------|---------|
| `PHYSICS_DB_ROOT` | set by `dev.sh` |
| `JWT_SECRET` | from `.dev-jwt-secret` when empty |
| `CORS_ORIGINS` | `http://localhost:3000` |
| `MOCK_SUBSCRIPTION_DAYS` | 30 |

Forgot your local password?

```bash
cd admin/server
export PHYSICS_DB_ROOT="$(cd ../.. && pwd)" PYTHONPATH="$PHYSICS_DB_ROOT"
.venv/bin/python scripts/set_password.py you@example.com 'new-password'
```

## Security

The public CloudFront site ships with **editor UI disabled** (`NEXT_PUBLIC_ENABLE_ADMIN=false`).

The FastAPI API enforces:

| Control | Local dev | Production |
|---------|-----------|------------|
| `ADMIN_ALLOWED_EMAILS` | optional in dev when `ALLOW_PUBLIC_REGISTRATION=true` | **required** — only these emails can register/login/edit |
| `JWT_SECRET` | auto-generated | **required** (32+ chars) |
| `ALLOW_MOCK_BILLING` | `true` | must be `false` |
| `ALLOW_PUBLIC_REGISTRATION` | `true` | must be `false` |

Copy `admin/server/.env.example` → `admin/server/.env` and set your email before running in production.

**Never expose the admin API publicly without these settings.**
