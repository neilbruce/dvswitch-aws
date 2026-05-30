#!/usr/bin/env python3
"""DMR NCS appliance health check for systemd, database, radio integrations and web UI."""
import json
import os
import shutil
import sqlite3
import subprocess
import sys
import urllib.request
from pathlib import Path

try:
    import psutil
except Exception:  # pragma: no cover - installer provides psutil
    psutil = None

ENV_FILE = os.environ.get("DMR_NCS_ENV", "/etc/dmr-ncs.env")


def load_env(path: str) -> None:
    if not os.path.exists(path):
        return
    with open(path, "r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key, value.strip().strip('"').strip("'"))


def result(name: str, ok: bool, detail: str, critical: bool = True) -> dict:
    return {"name": name, "status": "PASS" if ok else ("FAIL" if critical else "WARN"), "critical": critical, "detail": detail}


def run(command: list[str], timeout: int = 8) -> tuple[bool, str]:
    try:
        completed = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=timeout)
        output = (completed.stdout or completed.stderr).strip()
        return completed.returncode == 0, output
    except Exception as exc:
        return False, str(exc)


def check_database() -> dict:
    url = os.environ.get("DATABASE_URL", "sqlite:////opt/dmr_ncs_system/dmr_control_station.db")
    if url.startswith("sqlite:///"):
        db_path = url.replace("sqlite:///", "", 1)
        if not os.path.exists(db_path):
            return result("database", False, f"SQLite database not found: {db_path}")
        try:
            conn = sqlite3.connect(db_path)
            conn.execute("PRAGMA integrity_check")
            conn.execute("SELECT COUNT(*) FROM users")
            conn.close()
            return result("database", True, db_path)
        except sqlite3.Error as exc:
            return result("database", False, str(exc))
    return result("database", True, "Non-SQLite DATABASE_URL configured; verify with application migrations", critical=False)


def check_unit(label: str, env_key: str, default: str) -> dict:
    unit = os.environ.get(env_key, default)
    if not shutil.which("systemctl"):
        return result(label, False, "systemctl unavailable", critical=False)
    ok, output = run(["systemctl", "is-active", unit])
    return result(label, ok, f"{unit}: {output or 'active'}")


def check_http(name: str, url: str, critical: bool = True) -> dict:
    try:
        with urllib.request.urlopen(url, timeout=8) as response:
            ok = 200 <= response.status < 500
            return result(name, ok, f"HTTP {response.status} {url}", critical=critical)
    except Exception as exc:
        return result(name, False, f"{url}: {exc}", critical=critical)


def check_path(name: str, path: str, critical: bool = True) -> dict:
    return result(name, bool(path and os.path.exists(path)), path or "not configured", critical=critical)


def main() -> int:
    load_env(ENV_FILE)
    port = os.environ.get("PORT", "5000")
    checks = [
        check_database(),
        check_path("DVSwitch tune script", os.environ.get("DVSWITCH_SCRIPT", "/opt/MMDVM_Bridge/dvswitch.sh")),
        check_unit("MMDVM_Bridge", "MMDVM_BRIDGE_SERVICE", "MMDVM_Bridge"),
        check_unit("Analog_Bridge", "ANALOG_BRIDGE_SERVICE", "Analog_Bridge"),
        check_unit("Apache", "APACHE_SERVICE", "apache2"),
        check_unit("Gunicorn", "GUNICORN_SERVICE", "dmr-ncs"),
        check_http("BrandMeister", os.environ.get("BRANDMEISTER_MASTERS_URL", "https://api.brandmeister.network/v2/master/"), critical=False),
        check_http("web UI", f"http://127.0.0.1:{port}/", critical=True),
    ]

    if os.environ.get("APRS_ENABLED", "true").lower() == "true":
        host = os.environ.get("APRS_IS_HOST", "rotate.aprs2.net")
        port_s = os.environ.get("APRS_IS_PORT", "14580")
        checks.append(result("APRS", bool(os.environ.get("APRS_IS_CALLSIGN")), f"{host}:{port_s}"))
    else:
        checks.append(result("APRS", True, "disabled by configuration", critical=False))

    if psutil:
        disk = psutil.disk_usage("/")
        memory = psutil.virtual_memory()
        checks.append(result("disk space", disk.percent < 90, f"{disk.percent:.1f}% used"))
        checks.append(result("memory", memory.percent < 90, f"{memory.percent:.1f}% used"))
    else:
        checks.append(result("system resources", False, "psutil unavailable", critical=False))

    failed = [item for item in checks if item["critical"] and item["status"] != "PASS"]
    print("DMR NCS Healthcheck")
    print("===================")
    for item in checks:
        print(f"{item['status']:4} {item['name']}: {item['detail']}")
    print("===================")
    print("PASS" if not failed else "FAIL")
    return 0 if not failed else 1


if __name__ == "__main__":
    sys.exit(main())
