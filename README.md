# Hermes Dashboard

Next.js dashboard for Hermes marketing operations with SQLite-backed APIs and session auth.

## Setup

1. Copy env file:

```bash
cp .env.example .env.local
```

2. Set required auth values in `.env.local`:
- `AUTH_USER`
- `AUTH_PASS` (min 10 chars)
- `API_KEY`
- `AUTH_COOKIE_SECURE` (`false` for HTTP, `true` for HTTPS)

Optional Google SSO:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI` (e.g. `https://your-domain/api/auth/google/callback`)
- Optional: `GOOGLE_AUTH_ALLOWED_EMAILS`, `GOOGLE_AUTH_ALLOWED_DOMAINS`, `GOOGLE_AUTH_DEFAULT_ROLE`

3. Install and run:

```bash
pnpm install
pnpm dev
```

## Auth Behavior

- Session auth is required for all protected pages and API routes.
- API routes also allow `x-api-key` when it matches `API_KEY`.
- If the `users` table is empty, the app seeds the first admin from:
  - `AUTH_USER`
  - `AUTH_PASS`
- There are no default fallback credentials.
- Admin users can manage users and roles (`admin`, `operator`, `viewer`) from **Settings**.
- When Google SSO is configured, users can sign in via Google and are provisioned on first login.

## Scripts

- `pnpm dev`
- `pnpm build`
- `pnpm start`
- `pnpm lint`
- `pnpm seed`
- `pnpm test`
