# WiseWallet

WiseWallet is a full-stack personal finance web app for tracking income/expenses, scanning receipts with OCR + AI parsing, building budgets, and viewing reports.

## What the app includes

- Authentication with JWT + session tracking
- Google OAuth login/registration option
- Optional email-based 2FA (enable/disable from Settings)
- Home dashboard with KPI cards, category chart, recent transactions, and net-worth snapshot
- Receipt uploads (PDF/images), OCR extraction, AI parsing, and auto-created expense records
- Records management for both expenses and income (search across row content, filter, column-header sort, paginate, export CSV)
- Budgeting by cadence/period with saved budget sheets and custom categories
- Reports with date ranges, category breakdowns, time-series trends (time on X-axis, amount on Y-axis), and currency conversion support
- Profile management (editable profile, avatar picker, activity feed)
- Settings for theme, currency, timezone, dashboard defaults, password change, and account/session controls
- Help/support form wired to backend email delivery
- Legal pages included: `web/privacy.html` and `web/terms.html`

## Tech stack

- Frontend: Vanilla HTML/CSS/JavaScript modules (`web/`)
- Backend: Node.js 20, Express (`api/`)
- Database: PostgreSQL
- Object storage: Cloudflare R2 (S3-compatible presigned upload/download)
- OCR worker: Python + Tesseract + PyMuPDF (`worker/`)
- AI parsing: Google GenAI (`@google/genai`)

## Project structure

```text
WiseWallet/
  web/                  # static frontend pages + scripts + styles
  api/                  # Express API, models, controllers, routes, migrations
  worker/               # Python OCR worker script
  Dockerfile            # container setup for API + OCR runtime
```

## Local setup

### 1) Prerequisites

- Node.js >= 20
- Python 3.10+
- PostgreSQL
- Tesseract OCR installed on your machine

### 2) Install dependencies

```bash
# API deps
cd api
npm install

# OCR worker deps
cd ../worker
python3 -m pip install -r requirements.txt
```

### 3) Configure environment

Create `api/.env`:

```env
NODE_ENV=development
PORT=4000

DB_PROVIDER=postgres
DB_URL=postgresql://USER:PASSWORD@HOST:5432/DBNAME
DB_SSL=false

JWT_SECRET=replace-with-a-strong-secret
JWT_EXPIRES_IN=7d
SESSION_IDLE_DAYS=1
SESSION_CLEANUP_DAYS=30
TWO_FA_CODE_MINUTES=10
TWO_FA_TRUSTED_DAYS=10
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
GOOGLE_REDIRECT_URI=http://localhost:4000/api/auth/google/callback

CORS_ORIGIN=http://localhost:5500,http://127.0.0.1:5500

OCR_ENABLED=true
OCR_WORKER_SCRIPT=../worker/ocr_demo.py
PYTHON_BIN=python3
RECEIPT_KEEP_FILES=true

AI_PROVIDER=gemini
AI_API_KEY=your_google_ai_key
AI_MODEL=models/gemma-3-4b-it
AI_MAX_CHARS=5000

OBJECT_STORE_PROVIDER=r2
OBJECT_STORE_BUCKET=your_bucket
OBJECT_STORE_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com
OBJECT_STORE_ACCESS_KEY_ID=your_access_key
OBJECT_STORE_SECRET_ACCESS_KEY=your_secret_key
OBJECT_STORE_REGION=auto
OBJECT_STORE_FORCE_PATH_STYLE=true

# Optional email settings (for support + 2FA emails)
EMAIL_FROM=no-reply@wisewallet.local
SUPPORT_EMAIL=support@example.com
# SMTP_HOST=
# SMTP_PORT=
# SMTP_USER=
# SMTP_PASS=
# SMTP_SECURE=false
# BREVO_API_KEY=
# BREVO_API_URL=https://api.brevo.com/v3/smtp/email
```

### Google OAuth checklist

1. In Google Cloud Console, create/select a project.
2. Configure OAuth consent screen.
3. Create an OAuth client of type `Web application`.
4. Add authorized JavaScript origins for your frontend, for example:
   - `http://localhost:5500`
   - your production frontend origin (e.g. `https://yourdomain.com`)
5. Add authorized redirect URIs, for example:
   - `http://localhost:4000/api/auth/google/callback`
   - your production API callback URL (e.g. `https://api.yourdomain.com/api/auth/google/callback`)
6. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` in `api/.env`.

Note: If your OAuth app is in Google "Testing" mode, only listed test users can sign in. For any Google account to sign in, publish the app to production in Google Cloud.

### 4) Run database migrations

Run all SQL files in `api/src/db/migrations` against your Postgres database (in filename order).

Example:

```bash
for f in api/src/db/migrations/*.sql; do
  psql "$DB_URL" -f "$f"
done
```

### 5) Start the API

```bash
cd api
npm run dev
```

API health check:

```bash
curl http://localhost:4000/health
```

### 6) Run the frontend

Serve `web/` with any static server (VS Code Live Server, `python -m http.server`, etc.).

Example:

```bash
cd web
python3 -m http.server 5500
```

Open: `http://localhost:5500`

## API route groups

- `/api/auth`
- `/api/records`
- `/api/receipts`
- `/api/budget-sheets`
- `/api/fx-rates`
- `/api/activity`
- `/api/support`

Google OAuth routes:

- `GET /api/auth/google/config`
- `GET /api/auth/google/start`
- `GET /api/auth/google/callback`

## Useful scripts

```bash
cd api
npm run dev                 # run API with nodemon
npm start                   # run API with node
npm run worker              # run dedicated receipt job worker
npm run migrate             # apply SQL migrations in order (tracked)
npm test                    # run API tests (node:test)
npm run cleanup:sessions    # cleanup expired/stale sessions
npm run replace:categories  # category replacement utility
```

## Production hardening notes

- Run migrations in every environment before deploy:
  - `cd api && npm run migrate`
- Dedicated receipt worker setup (recommended):
  - API: set `RUN_RECEIPT_WORKER_IN_API=false`
  - Worker process: run `npm run worker`
- Optional automatic migrations on startup:
  - set `AUTO_RUN_MIGRATIONS=true`
- Optional captcha on public support endpoint:
  - set `TURNSTILE_SECRET_KEY=<secret>`
  - frontend should send `captchaToken` to `POST /api/support/public`

## Deployment notes

- `Dockerfile` installs Node, Python, and Tesseract for OCR-compatible API deployment.
- Frontend API base is auto-switched in `web/scripts/api.js`:
  - localhost -> `http://localhost:4000/api`
  - non-localhost -> hosted Render API URL
