# Production Readiness Report

## Critical Issues Found

1. A JSON file persistence backend still existed beside SQLAlchemy, creating competing database sources of truth.
2. The deployment service previously ran as root and embedded runtime configuration directly in the systemd unit.
3. No installed healthcheck command existed for appliance validation.
4. Gunicorn multi-worker defaults could duplicate in-process background schedulers/APRS listeners.
5. Backup/restore did not cover the final environment-file and log/archive layout consistently.
6. BrandMeister helper calls lacked retry/cache behavior for transient API failures.
7. Release tests did not exist to prevent regression to demo values or unsafe command execution.

## Critical Issues Fixed

1. Removed `database.ts` JSON persistence and reduced `server.ts` to a frontend/static server with optional Flask API proxying.
2. Added a dedicated `dmrncs` service user, moved secrets to `/etc/dmr-ncs.env`, and added sudoers allow-list entries for required service and DVSwitch operations only.
3. Added `deploy/dmr-ncs-healthcheck.py` and `deploy/dmr-ncs`; installer places the `dmr-ncs` command on the system path.
4. Set Gunicorn default workers to one and added migration execution before service start.
5. Rebuilt backup/restore scripts for database, env/config, service files, exports, reports, and radio/web logs with 30-day retention.
6. Added cached/retried BrandMeister JSON helper behavior.
7. Added `tests/test_release_static.py` and `npm test` for release regression checks.

## Remaining Risks

- BrandMeister and RadioID API schemas/rate limits are external dependencies and can change without notice.
- APRS-IS packet support is intentionally limited to validated position packets required by the dashboard.
- Running scheduler/APRS ingestion inside the web process is acceptable for a single-operator appliance with one Gunicorn worker; larger deployments should split workers into separate systemd units.
- DVSwitch service/unit names vary by installation. Override service names in `/etc/dmr-ncs.env` when local names differ from defaults.
- Browser TX/RX, WebRTC audio, SIP bridge, and multi-hotspot support are architecture-reserved only and not enabled.

## Deployment Instructions

```bash
sudo STATION_CALLSIGN=YOURCALL STATION_DMR_ID=1234567 ./deploy/install.sh
sudo dmr-ncs healthcheck
```

Then sign in with the installer-provided administrator credentials and run BrandMeister talkgroup sync.

## Upgrade Instructions

```bash
sudo /opt/dmr_ncs_system/backup.sh
sudo rsync -a ./ /opt/dmr_ncs_system/
cd /opt/dmr_ncs_system
sudo -u dmrncs venv/bin/alembic -c alembic.ini upgrade head
sudo systemctl restart dmr-ncs.service apache2
sudo dmr-ncs healthcheck
```

## Backup Instructions

```bash
sudo /opt/dmr_ncs_system/backup.sh
```

Backups are stored in `/opt/dmr_ncs_system/backups` and retained for `BACKUP_RETENTION_DAYS` days, defaulting to 30.

## Recovery Instructions

```bash
sudo /opt/dmr_ncs_system/restore.sh /opt/dmr_ncs_system/backups/<backup>.tar.gz
sudo dmr-ncs healthcheck
```

Verify `/etc/dmr-ncs.env` after restore if station identity or service names changed.

## Final Production Readiness Score

**88 / 100**

The repository is suitable as a release candidate for a personal DVSwitch NCS appliance after environment-specific verification with `sudo dmr-ncs healthcheck`. Remaining risk is primarily from external radio/network APIs and site-specific DVSwitch service naming.
