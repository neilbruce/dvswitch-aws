# DVSwitch AWS Operations API

This service exposes a JSON API for DVSwitch/MMDVM operations. Mutating endpoints require a JWT session from `POST /api/auth/login`; role checks are enforced on each protected route.

## Authentication and RBAC

- `POST /api/auth/login` — body: `{ "username": "admin", "password": "..." }`. Returns the signed-in username and roles and sets an HTTP-only session cookie.
- `POST /api/auth/logout` — clears the session cookie.
- `GET /api/auth/session` — returns the current authentication state.
- Roles:
  - `Admin`: all protected operations, including tuning, service control, delete check-ins, audits.
  - `Operator`: net/check-in operations, BrandMeister sync, log viewing.
  - `ReadOnly`: public dashboard/read APIs only.

## Radio integrations

- `GET /api/radioid/user?id=<dmrId>` or `GET /api/radioid/user?callsign=<call>` — queries RadioID and returns normalized DMR user metadata.
- `POST /api/talkgroups/sync` — protected; downloads and replaces the local BrandMeister talkgroup directory from `BRANDMEISTER_TG_URL`.
- `GET /api/talkgroups/sync/status` — returns the last BrandMeister sync status.
- `GET /api/talkgroups?q=&region=&category=&language=&country=` — searches the synchronized directory.
- `POST /api/talkgroup/tune` — protected Admin route; body `{ "tg": 91 }`; updates the current TG and invokes `DVSWITCH_TUNE_SCRIPT` when present.

## Live operations

- `GET /api/status` — bridge state, active net summary, host memory/load, service status.
- `GET /api/heard?search=&tg=` — live heard rows created from the persistent MMDVM log cursor.
- `GET /api/aprs` — latest APRS-IS packets when `APRS_IS_ENABLED=true`.
- `GET /api/logs?type=mmdvm|apache|system&lines=35` — protected; reads actual host log files and reports 404 when unavailable.

## Nets and check-ins

- `GET /api/nets` — all net sessions.
- `GET /api/net/checkins` — active check-in board.
- `POST /api/net/control` — protected Operator/Admin route; body supports `start`, `pause`, `resume`, and `stop`.
- `POST /api/checkins/add` — protected Operator/Admin route for manual check-ins.
- `POST /api/checkins/validate` — protected Operator/Admin route; toggles validation.
- `POST /api/checkins/delete` — protected Admin route.

When an active net matches the talkgroup in the MMDVM log, heard stations are automatically added to the board. TG91 entries are validated automatically for NCS logging.

## Statistics and exports

- `GET /api/stats/countries` — country-level station, transmission, airtime, and check-in counts.
- `GET /api/exports/csv?net_id=<id>` — CSV export for check-ins.
- `GET /api/exports/adif/validate?net_id=<id>` — validates callsigns, DMR IDs, and timestamps before export.
- `GET /api/exports/adif?net_id=<id>` — ADIF export for validated check-ins only; returns HTTP 422 when validation fails.

## Audit logging

- `GET /api/audits` — protected Admin route; returns security and operational audit records.

## OpenAPI discovery

- `GET /api/docs` — machine-readable OpenAPI-style endpoint summary.
