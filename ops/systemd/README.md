# Systemd Template Notes

Goal: keep `hermes-dashboard` "plug-and-play" across OpenClaw instances by avoiding:

- hardcoded home directories (`/home/leads/...`)
- secrets inside unit files

## Recommended Layout

- App code: `/opt/hermes-dashboard`
- Runtime data:
  - DB: `/var/lib/hermes-dashboard/hermes.db`
  - State: `/var/lib/hermes-dashboard/state/`
- Env file (secrets + config): `/etc/hermes-dashboard/hermes-dashboard.env`

## Unit File

Use `ops/systemd/hermes-dashboard.service` as a starting point.

Important: update these to match your deployment:

- `WorkingDirectory=...`
- `EnvironmentFile=...`
- `ReadWritePaths=...` (must cover your DB and state dirs)
- `User=` / `Group=`

## Env File

Minimal required values:

- `AUTH_USER`, `AUTH_PASS`
- `API_KEY`

Template-safe defaults:

- `HERMES_DB_PATH=/var/lib/hermes-dashboard/hermes.db`
- `HERMES_STATE_DIR=/var/lib/hermes-dashboard/state`

OpenClaw instance discovery:

- Single instance:
  - `HERMES_OPENCLAW_HOME=/home/<user>/.openclaw`
  - `HERMES_DEFAULT_INSTANCE=default`
- Multi instance:
  - `HERMES_OPENCLAW_INSTANCES=[{"id":"default","label":"Default","openclawHome":"..."}]`

## Secrets Hygiene

If you currently have a systemd drop-in (e.g. `override.conf`) that sets secrets via `Environment=...`,
move those values into the env file and remove them from the drop-in.

