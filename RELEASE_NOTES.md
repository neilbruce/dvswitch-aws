# Release Notes - DVSwitch AWS NCS Release Candidate

## Release Candidate Scope

This release candidate is focused on production hardening and release readiness for a personal DVSwitch cloud NCS appliance on Ubuntu 24.04 LTS, Raspberry Pi 4/5, SQLite initially, and PostgreSQL-ready SQLAlchemy migrations.

## Highlights

- Removed the competing JSON persistence backend from the Node path; SQLAlchemy is now the single production persistence model.
- Added Alembic migration scaffolding and schema extension migration for live-heard history, RadioID cache, log cursors, enriched check-ins, talkgroup favorites, and recent talkgroups.
- Hardened Flask configuration so required secrets and station identity must come from environment variables.
- Added privilege separation through a dedicated `dmrncs` service user and sudo allow-list for only required systemd/DVSwitch operations.
- Added `dmr-ncs healthcheck` for database, DVSwitch, MMDVM_Bridge, Analog_Bridge, APRS, BrandMeister, web UI, disk, and memory checks.
- Added production backup/restore coverage for database, configuration, exports, reports, and logs with 30-day retention.
- Added release static tests to catch reintroduction of JSON persistence, known demo values, missing healthcheck wiring, missing migration startup, and shell command injection risks.

## Operational Notes

- Gunicorn defaults to one worker to prevent duplicate in-process scheduler/APRS/log-parser jobs.
- Configure `STATION_CALLSIGN` and `STATION_DMR_ID` before install.
- Run `sudo dmr-ncs healthcheck` after install, upgrade, reboot, and restore.
- Load talkgroups via the authenticated BrandMeister sync endpoint or UI sync control after first boot.

## Compatibility

- Ubuntu 24.04 LTS
- Raspberry Pi OS / Debian-family systems with systemd, Apache2, Python 3, and DVSwitch services
- SQLite by default
- PostgreSQL-ready through `DATABASE_URL` and Alembic
