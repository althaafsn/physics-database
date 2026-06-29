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

| Variable | Default |
|----------|---------|
| `PHYSICS_DB_ROOT` | set by `dev.sh` |
| `JWT_SECRET` | dev-only secret |
| `CORS_ORIGINS` | `http://localhost:3000` |
| `MOCK_SUBSCRIPTION_DAYS` | 30 |

Root `.env.local` (optional):

```
NEXT_PUBLIC_ADMIN_API_URL=http://localhost:8000
```

## Production

Host this API separately. Wire `POST /api/billing/subscribe` to Stripe. The static CloudFront reader stays unchanged.
