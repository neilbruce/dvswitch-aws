# DVSwitch AWS NCS Repository Audit

Date: 2026-05-30
Target deployment: personal Amateur Radio NCS appliance on AWS EC2 Ubuntu 24.04 for DVSwitch / Analog_Bridge / MMDVM_Bridge / BrandMeister DMR and APRS.

## Architecture Review

### Existing architecture

- React/Vite frontend under `src/` with dashboard, talkgroup directory, APRS, net control, analytics, service control, and log viewer pages.
- TypeScript/Express server (`server.ts`) exists for the bundled full-stack development path.
- Flask deployment application under `deploy/app.py`, SQLAlchemy models under `deploy/models.py`, installer/service/Apache scripts under `deploy/`.
- SQLite is the current persistent store for the Flask deployment.
- Apache + Gunicorn systemd deployment assets are present.

### Architecture issues

- The repository has two backend implementations: Express and Flask. The declared production environment is Flask, but many previous changes primarily touched Express.
- Runtime integrations are split and inconsistent between `server.ts` and `deploy/app.py`.
- No central service layer exists for RadioID, BrandMeister, APRS-IS, log parsing, ADIF, backup, or systemd execution.
- There is no migration directory or migration runner; schema changes depend on `db.create_all()` and ad-hoc seeding.
- Frontend routes call `/api/*`, so Flask and Express must expose compatible contracts.

## Security Review

### Existing controls

- Flask-Login is used for session auth.
- Flask-WTF CSRF is enabled globally.
- SQLAlchemy ORM is used for most database access.
- Service control is restricted to logged-in Admin users in Flask.
- AuditLog model exists and actions are written for some workflows.

### Security risks

- `deploy/config.py` silently generated `SECRET_KEY`; this invalidates sessions on restart and does not fail closed when a secret is missing.
- Flask debug mode was enabled in the `__main__` runner.
- Some frontend/deploy files still had hard-coded callsign/IP examples and production defaults.
- Service status in Flask was hard-coded to `running`.
- Service control had synthetic command output and did not actually execute systemd commands.
- Login has no lockout window enforcement despite fields existing on `User`.
- No explicit session lifetime is configured for appliance-style operation.
- No migration tooling means schema drift could lead to unsafe manual fixes.

## Reliability Review

### Existing strengths

- APScheduler runs background log parsing and TG91 scheduled net automation.
- MMDVM log parser stores a filename/offset cursor in settings.
- Backup/restore scripts exist.

### Reliability gaps

- The parser only reads the daily MMDVM log path and misses DVSwitch / Analog_Bridge logs.
- Cursor state is per single filename, not per source, so multiple log sources cannot be safely consumed.
- Service status does not reflect actual systemd state.
- The APScheduler job store is in-memory; schedules are re-created on restart, but missed scheduled windows need explicit reconciliation.
- Backup retention is 7 days; requirement is 30 days.
- Backup does not include environment files or Apache logs, and log backup paths are narrow.

## Database Review

### Existing schema

- Models exist for users/roles, stations, heard, nets, check-ins, talkgroups, countries, APRS, audit logs, settings, events, and reports.

### Database gaps

- No Alembic migration baseline.
- SQLite only; PostgreSQL connection is possible through `DATABASE_URL`, but migration and pool options are not tuned by backend type.
- Heard table aggregates by callsign/talkgroup; it does not preserve full transmission history.
- Check-ins lack city/name/join/last-heard/late-check-in fields.
- RadioID cache is not modeled.
- Talkgroup favorites and recent tune history are not modeled.
- APRS retention is ad-hoc and not enforced by database policy.

## Radio Functionality Review

### Existing features

- Talkgroup list endpoint exists.
- Tune endpoint exists and calls `DVSWITCH_SCRIPT` without `shell=True`.
- MMDVM parsing exists for two patterns.
- Station and heard records are updated.

### Broken/incomplete features

- Fixed default TG/callsign/DMR ID values remain in Flask status fallback.
- Talkgroup search does not cover description/language in Flask.
- No `/api/talkgroups/search`, `/api/talkgroups/favorites`, `/api/talkgroups/recent`, or disconnect route in Flask.
- No BrandMeister talkgroup sync job in Flask.
- No BrandMeister lastheard/master/reflector/bridge status endpoints.
- RadioID lookup uses an older endpoint path and is not persisted as a cache table.

## APRS Review

### Existing features

- APRS-IS listener exists in Flask and stores parsed positions.
- `/api/aprs` returns recent APRS rows.

### APRS gaps

- APRS server, port, callsign, passcode, and filter are hard-coded inside `aprs_is_listener()`.
- APRS parsing supports only position packets and is acceptable for an initial appliance, but status/error tracking is missing.
- Database growth limit is implemented only through deletion after insert, not configurable retention.
- Frontend APRS page has a hard-coded NCS reference label.

## NCS Workflow Review

### Existing workflow

- Scheduled Saturday 21:30 IST net start and Sunday 03:00 IST close jobs exist.
- Active net check-ins are created automatically when heard station matches the active talkgroup.
- Manual check-in add/validate/delete routes exist.
- ADIF and CSV export endpoints exist.

### NCS gaps

- Auto-start/close does not reconcile missed windows after reboot/crash.
- Auto-close does not generate persisted ADIF/report archives.
- Automatic check-ins do not track join time, last heard time, name, city, or late status.
- ADIF export lacks TIME_OFF, SUBMODE, NAME, COUNTRY fields and filtering by date range/talkgroup/station.
- Dedicated NCS dashboard endpoint with active net/new stations/stats/top talkgroups/operators is missing.

## Feature Inventory

### Existing features

- React dashboard/navigation.
- Flask login/session auth.
- Role model with Admin/ReadOnly.
- Talkgroup listing and tune route.
- MMDVM log parser.
- Basic active net lifecycle.
- Manual check-ins.
- CSV/ADIF export.
- APRS storage and listing.
- Audit logs.
- Backup/restore scripts.

### Broken features

- Flask status uses fixed service status and public IP fallback.
- Service control returns synthetic output.
- Flask debug runner enables debug mode.
- Setup/installer scripts do not yet provide a fully noninteractive one-command path with generated secrets.

### Fake features

- Hard-coded service status in Flask.
- Hard-coded station fallback values in Flask status/ABInfo sync.
- Hard-coded frontend public IP label and APRS reference label.
- Synthetic service-control output.

### Incomplete features

- BrandMeister sync/status/lastheard.
- RadioID persistent cache/rate limiting.
- Multi-source live heard parser.
- Favorites/recent talkgroups.
- Disconnect operation.
- Migration architecture.
- ADIF filtering/validation completeness.
- System backup retention/config coverage.
- Future Browser TX/RX/WebRTC/SIP/multi-hotspot architecture documentation.

## Implementation Plan

Before implementation, each change must keep the appliance deployable and avoid fabricated data.

1. **Production configuration hardening**
   - Files: `deploy/config.py`, `.env.example`, `deploy/install.sh`, frontend labels.
   - Migration impact: none.
   - Security impact: refuse unsafe secrets and remove hard-coded identity/IP values.
   - Deployment impact: installer must create required env values.

2. **Database migration baseline and schema extensions**
   - Files: `deploy/models.py`, `deploy/migrations/*`, `deploy/requirements.txt`.
   - Migration impact: add Alembic baseline and fields/tables for RadioID cache, heard history, favorites, recent TGs, log cursors, enriched check-ins.
   - Security impact: controlled schema evolution.
   - Deployment impact: installer runs migrations before service start.

3. **Radio and BrandMeister services**
   - Files: `deploy/app.py`, `deploy/config.py`.
   - Migration impact: use new cache/recent/favorites tables.
   - Security impact: input validation and rate-limited external calls.
   - Deployment impact: requires outbound HTTPS from EC2.

4. **Live-heard and APRS ingestion**
   - Files: `deploy/app.py`, `deploy/models.py`, frontend APRS/live heard pages.
   - Migration impact: history tables and cursors.
   - Security impact: parser sanitizes untrusted log/APRS input.
   - Deployment impact: requires readable DVSwitch/MMDVM/Analog_Bridge log paths and APRS credentials.

5. **NCS automation and ADIF**
   - Files: `deploy/app.py`, `deploy/models.py`, docs.
   - Migration impact: check-in enrichment/archive/report fields.
   - Security impact: exports validate records and avoid malformed ADIF.
   - Deployment impact: schedules remain Asia/Kolkata and recover after restart.

6. **System operations, backup, docs**
   - Files: `deploy/app.py`, `deploy/backup.sh`, `deploy/install.sh`, `docs/*`.
   - Migration impact: none beyond previous schema.
   - Security impact: no `shell=True`, strict allow-list for services/actions.
   - Deployment impact: one-command install, 30-day retention, upgrade/rollback guide.

## Explicit Blockers / External Dependencies

- BrandMeister API availability and exact response shape can change; code must tolerate failure and preserve cached local data.
- RadioID request quotas are external; local cache/rate limits are required.
- APRS-IS requires a valid amateur callsign/passcode for transmitting login identity; receive-only operation can use passcode `-1`, but production should configure the operator passcode.
- Browser TX/RX/WebRTC/SIP/multiple-hotspot work is intentionally architecture-only for this phase.
