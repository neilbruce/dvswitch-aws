# app.py - Productions-Grade Flask Application Core for DMR NCS Station Control
import os
import sys
import datetime
import json
import hashlib
import re
import socket
import threading
import time
import subprocess
import csv
import io
import psutil
from zoneinfo import ZoneInfo
from flask import Flask, render_template, request, jsonify, redirect, url_for, flash, send_file, make_response, session
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from flask_wtf.csrf import CSRFProtect
from apscheduler.schedulers.background import BackgroundScheduler
import requests

sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from models import db, User, Role, Station, Heard, HeardHistory, Net, CheckIn, Talkgroup, TalkgroupFavorite, TalkgroupRecent, RadioIdCache, LogCursor, Country, Aprs, AuditLog, Setting, Event, Report

# Establish Flask App and Load Configuration
app = Flask(__name__)
from config import Config
app.config.from_object(Config)

# Enable CSRF Protection & Core Extensions
csrf = CSRFProtect(app)
db.init_app(app)

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login_html'

# Timezone configurations
IST = ZoneInfo(Config.TIMEZONE)
RADIOID_LAST_REQUEST_AT = 0.0
SERVICE_ACTIONS = {"start", "stop", "restart"}


@app.before_request
def enforce_api_same_origin_csrf():
    if request.method in {'GET', 'HEAD', 'OPTIONS', 'TRACE'}:
        return None
    if not request.path.startswith('/api/'):
        csrf.protect()
        return None
    origin = request.headers.get('Origin') or request.headers.get('Referer')
    if origin:
        from urllib.parse import urlparse
        parsed = urlparse(origin)
        if parsed.netloc and parsed.netloc != request.host:
            return jsonify({"error": "CSRF origin check failed"}), 403
    return None

# Secure Login User Loader
@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))

# Core Security/Audit Log Helper
def log_audit_action(action, target="", status="success", username=None):
    if not username:
        username = current_user.username if current_user.is_authenticated else "anonymous"
    user_roles = "none"
    if current_user.is_authenticated:
        user_roles = ",".join([r.name for r in current_user.roles])
    
    ip_addr = request.headers.get('X-Forwarded-For', request.remote_addr)
    log_entry = AuditLog(
        user=username,
        role=user_roles,
        action=action,
        target=target,
        status=status,
        ip_address=ip_addr
    )
    db.session.add(log_entry)
    db.session.commit()


# --- PRODUCTION RADIO, BRANDMEISTER, APRS AND NCS SERVICE LAYER ---
def utcnow():
    return datetime.datetime.utcnow()

def sanitize(value, max_len=120):
    return str(value or '').replace('\r', ' ').replace('\n', ' ').replace('\t', ' ').strip()[:max_len]

def parse_int(value, minimum=1, maximum=9999999):
    try:
        parsed = int(str(value))
    except (TypeError, ValueError):
        return None
    return parsed if minimum <= parsed <= maximum else None

def adif_field(name, value):
    text = str(value or '')
    return f"<{name}:{len(text.encode('utf-8'))}>{text} "

def get_ab_info():
    data = {"tg": Config.DEFAULT_TALKGROUP, "call": Config.STATION_CALLSIGN, "gw": Config.STATION_DMR_ID, "rpt": Config.REPEATER_ID}
    if os.path.exists(Config.AB_INFO_FILE):
        try:
            with open(Config.AB_INFO_FILE, 'r', encoding='utf-8') as fh:
                digital = json.load(fh).get('digital', {})
            data.update({
                "tg": parse_int(digital.get('tg'), 1, 9999999) or data["tg"],
                "call": sanitize(digital.get('call'), 30) or data["call"],
                "gw": sanitize(digital.get('gw'), 30) or data["gw"],
                "rpt": sanitize(digital.get('rpt'), 30) or data["rpt"],
            })
        except (OSError, json.JSONDecodeError):
            pass
    return data

def sync_ab_info(tg):
    directory = os.path.dirname(Config.AB_INFO_FILE)
    if directory:
        os.makedirs(directory, exist_ok=True)
    with open(Config.AB_INFO_FILE, 'w', encoding='utf-8') as fh:
        json.dump({"digital": {"gw": Config.STATION_DMR_ID, "rpt": Config.REPEATER_ID, "tg": str(tg), "call": Config.STATION_CALLSIGN}}, fh)

def tune_tg_radio(tg):
    parsed_tg = parse_int(tg)
    if not parsed_tg:
        return False, "Invalid talkgroup"
    if not os.path.exists(Config.DVSWITCH_SCRIPT):
        return False, f"DVSwitch tune script not found: {Config.DVSWITCH_SCRIPT}"
    try:
        result = subprocess.run(["sudo", Config.DVSWITCH_SCRIPT, "tune", str(parsed_tg)], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=30)
        sync_ab_info(parsed_tg)
        db.session.add(TalkgroupRecent(talkgroup=parsed_tg, action='tune'))
        db.session.commit()
        return True, result.stdout.strip() or f"Tuned TG {parsed_tg}"
    except (subprocess.SubprocessError, OSError) as exc:
        db.session.rollback()
        return False, str(exc)

def disconnect_talkgroup():
    if not os.path.exists(Config.DVSWITCH_SCRIPT):
        return False, f"DVSwitch tune script not found: {Config.DVSWITCH_SCRIPT}"
    try:
        result = subprocess.run(["sudo", Config.DVSWITCH_SCRIPT, "disconnect"], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=30)
        db.session.add(TalkgroupRecent(talkgroup=0, action='disconnect'))
        db.session.commit()
        return True, result.stdout.strip() or "Disconnected current talkgroup"
    except (subprocess.SubprocessError, OSError) as exc:
        db.session.rollback()
        return False, str(exc)

def systemd_status(unit):
    try:
        result = subprocess.run(['systemctl', 'is-active', unit], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=5)
        state = result.stdout.strip()
        if state == 'active':
            return 'running'
        if state in {'inactive', 'deactivating'}:
            return 'stopped'
        return 'failed'
    except (subprocess.SubprocessError, OSError):
        return 'failed'

def control_systemd_service(service, action):
    if service not in Config.SYSTEMD_UNITS or action not in SERVICE_ACTIONS:
        return False, "Invalid service or action"
    unit = Config.SYSTEMD_UNITS[service]
    try:
        result = subprocess.run(['sudo', 'systemctl', action, unit], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=45)
        output = result.stdout.strip() or result.stderr.strip() or f"systemctl {action} {unit} exited {result.returncode}"
        return result.returncode == 0, output
    except (subprocess.SubprocessError, OSError) as exc:
        return False, str(exc)

def lookup_radio_metadata(callsign=None, dmr_id=None):
    global RADIOID_LAST_REQUEST_AT
    now = utcnow()
    cached = None
    if dmr_id:
        cached = RadioIdCache.query.filter_by(dmr_id=str(dmr_id)).first()
    elif callsign:
        cached = RadioIdCache.query.filter_by(callsign=callsign.upper()).first()
    if cached and cached.expires_at > now:
        return {"dmr_id": cached.dmr_id, "callsign": cached.callsign, "name": cached.name, "city": cached.city, "state": cached.state, "country": cached.country}
    elapsed = time.monotonic() - RADIOID_LAST_REQUEST_AT
    if elapsed < Config.RADIOID_MIN_INTERVAL_SECONDS:
        time.sleep(Config.RADIOID_MIN_INTERVAL_SECONDS - elapsed)
    params = {}
    if dmr_id:
        params['id'] = str(dmr_id)
    if callsign:
        params['callsign'] = callsign.upper()
    if not params:
        return {}
    try:
        RADIOID_LAST_REQUEST_AT = time.monotonic()
        response = requests.get(Config.RADIOID_URL, params=params, timeout=6, headers={'User-Agent': 'dvswitch-aws-ncs/1.0'})
        response.raise_for_status()
        payload = response.json()
        if isinstance(payload, dict) and isinstance(payload.get('results'), list):
            record = payload['results'][0] if payload['results'] else None
        elif isinstance(payload, list):
            record = payload[0] if payload else None
        else:
            record = payload if isinstance(payload, dict) else None
        if not record:
            return {}
        normalized = {
            "dmr_id": str(record.get('id') or record.get('radio_id') or record.get('dmr_id') or dmr_id or ''),
            "callsign": sanitize(record.get('callsign') or callsign, 30).upper(),
            "name": sanitize(record.get('name') or ' '.join(filter(None, [record.get('fname'), record.get('surname')])), 120),
            "city": sanitize(record.get('city'), 100), "state": sanitize(record.get('state'), 100), "country": sanitize(record.get('country'), 100),
        }
        if normalized["dmr_id"] and normalized["callsign"]:
            cache = RadioIdCache.query.filter_by(dmr_id=normalized["dmr_id"]).first() or RadioIdCache(dmr_id=normalized["dmr_id"], callsign=normalized["callsign"], expires_at=now)
            cache.callsign = normalized["callsign"]; cache.name = normalized["name"]; cache.city = normalized["city"]; cache.state = normalized["state"]; cache.country = normalized["country"]
            cache.raw_json = json.dumps(record); cache.fetched_at = now; cache.expires_at = now + datetime.timedelta(hours=Config.RADIOID_CACHE_HOURS)
            db.session.merge(cache); db.session.commit()
        return normalized
    except requests.RequestException:
        db.session.rollback(); return {}

def upsert_station(metadata, talkgroup, airtime):
    dmr_id = sanitize(metadata.get('dmr_id'), 30) or sanitize(metadata.get('callsign'), 30).upper()
    callsign = sanitize(metadata.get('callsign'), 30).upper() or dmr_id
    station = db.session.get(Station, dmr_id)
    if not station:
        station = Station(dmr_id=dmr_id, callsign=callsign, country=metadata.get('country') or 'Unknown', first_heard=utcnow())
        db.session.add(station)
    station.callsign = callsign; station.name = metadata.get('name') or station.name; station.city = metadata.get('city') or station.city; station.state = metadata.get('state') or station.state
    station.country = metadata.get('country') or station.country or 'Unknown'; station.last_heard = utcnow(); station.total_airtime = (station.total_airtime or 0) + int(airtime or 0); station.total_tx = (station.total_tx or 0) + 1; station.most_used_tg = talkgroup
    if metadata.get('dmr_id'): station.radioid_updated_at = utcnow()
    return station

def process_transmission(callsign, talkgroup, airtime, dmr_id="", source='mmdvm', raw=''):
    tg = parse_int(talkgroup)
    if not tg: return
    metadata = lookup_radio_metadata(callsign=sanitize(callsign, 30).upper() or None, dmr_id=sanitize(dmr_id, 30) or None)
    metadata.setdefault('callsign', sanitize(callsign, 30).upper()); metadata.setdefault('dmr_id', sanitize(dmr_id, 30)); metadata.setdefault('country', metadata.get('country') or 'Unknown')
    station = upsert_station(metadata, tg, airtime)
    heard = Heard.query.filter_by(dmr_id=station.dmr_id, talkgroup=tg).first()
    if not heard:
        heard = Heard(callsign=station.callsign, dmr_id=station.dmr_id, talkgroup=tg, first_heard=utcnow())
        db.session.add(heard)
    heard.callsign = station.callsign; heard.name = station.name; heard.city = station.city; heard.country = station.country; heard.last_heard = utcnow(); heard.tx_count = (heard.tx_count or 0) + 1; heard.airtime = (heard.airtime or 0) + int(airtime or 0)
    db.session.add(HeardHistory(source=source, callsign=station.callsign, dmr_id=station.dmr_id, name=station.name, city=station.city, country=station.country, talkgroup=tg, started_at=utcnow(), ended_at=utcnow(), duration=int(airtime or 0), raw=raw[:1000]))
    active_net = Net.query.filter_by(status='active', talkgroup=tg).first()
    if active_net:
        checkin = CheckIn.query.filter_by(net_id=active_net.id, dmr_id=station.dmr_id).first()
        late_cutoff = active_net.start_time + datetime.timedelta(minutes=30)
        if checkin:
            checkin.last_heard_time = utcnow()
        else:
            checkin = CheckIn(net_id=active_net.id, number=active_net.checkins.count() + 1, callsign=station.callsign, dmr_id=station.dmr_id, name=station.name, city=station.city, country=station.country or 'Unknown', timestamp=utcnow(), join_time=utcnow(), last_heard_time=utcnow(), validated=(tg == Config.NET_AUTOMATIC_TG), late_checkin=utcnow() > late_cutoff)
            db.session.add(checkin); station.total_nets = (station.total_nets or 0) + 1
        active_net.participant_count = active_net.checkins.count(); active_net.country_count = len({c.country for c in active_net.checkins.all() if c.country}); heard.net_participation = True; heard.last_net_id = active_net.id
    db.session.commit()

def parse_log_line(line, source):
    tg_match = re.search(r'(?:dst|Dst|TG|to\s+TG|Talkgroup)[:=\s]+(\d{1,7})', line)
    id_match = re.search(r'(?:src|Src|source|DMR ID)[:=\s]+(\d{4,10})', line)
    call_match = re.search(r'(?:metadata=|from\s+|Callsign[:=\s]+)([A-Z0-9]{3,10})', line, re.IGNORECASE)
    duration_match = re.search(r'(?:airtime|duration|seconds?)[:=\s]+(\d{1,4})', line, re.IGNORECASE)
    if not tg_match or (not id_match and not call_match): return None
    return {'talkgroup': int(tg_match.group(1)), 'dmr_id': id_match.group(1) if id_match else '', 'callsign': call_match.group(1).upper() if call_match else '', 'airtime': int(duration_match.group(1)) if duration_match else 1, 'source': source, 'raw': line}

def log_sources_for_today():
    today_str = datetime.datetime.now(IST).strftime('%Y-%m-%d')
    return {'mmdvm': Config.MMDVM_LOG_PATH or os.path.join(Config.MMDVM_LOG_DIR, f'MMDVM_Bridge-{today_str}.log'), 'dvswitch': Config.DVSWITCH_LOG_PATH, 'analog_bridge': Config.ANALOG_BRIDGE_LOG_PATH}

def parse_radio_logs_job():
    with app.app_context():
        for source, path in log_sources_for_today().items():
            if not path or not os.path.exists(path): continue
            try:
                stat = os.stat(path); cursor = db.session.get(LogCursor, source) or LogCursor(source=source, path=path, offset=0)
                if cursor.path != path or cursor.inode != str(stat.st_ino) or cursor.offset > stat.st_size: cursor.path = path; cursor.inode = str(stat.st_ino); cursor.offset = 0
                if cursor.offset == stat.st_size: continue
                with open(path, 'r', encoding='utf-8', errors='ignore') as fh: fh.seek(cursor.offset); data = fh.read(); cursor.offset = fh.tell()
                cursor.updated_at = utcnow(); db.session.merge(cursor)
                for line in data.splitlines():
                    parsed = parse_log_line(line, source)
                    if parsed: process_transmission(parsed['callsign'], parsed['talkgroup'], parsed['airtime'], parsed['dmr_id'], parsed['source'], parsed['raw'])
                db.session.commit()
            except Exception as exc:
                db.session.rollback(); db.session.add(Event(event_type='log', message=f'{source} parser failed: {exc}', severity='error')); db.session.commit()

def sync_brandmeister_talkgroups():
    payload = fetch_brandmeister_json(Config.BRANDMEISTER_TALKGROUP_URL, cache_seconds=300)
    rows = payload if isinstance(payload, list) else payload.get('results', []) if isinstance(payload, dict) else []
    count = 0
    for item in rows:
        number = parse_int(item.get('id') or item.get('tg') or item.get('number') or item.get('talkgroup'))
        if not number: continue
        tg = db.session.get(Talkgroup, number) or Talkgroup(number=number, name=f'TG {number}', country='Worldwide')
        tg.name = sanitize(item.get('name') or item.get('title') or tg.name, 120) or f'TG {number}'; tg.country = sanitize(item.get('country') or item.get('country_name') or tg.country or 'Worldwide', 100); tg.description = sanitize(item.get('description') or item.get('desc') or tg.name, 255); tg.category = sanitize(item.get('category') or item.get('type') or 'BrandMeister', 100); tg.language = sanitize(item.get('language') or item.get('lang') or '', 100); tg.region = sanitize(item.get('region') or item.get('continent') or tg.country, 100); tg.source = 'BrandMeister'; tg.updated_at = utcnow(); db.session.merge(tg); count += 1
    db.session.merge(Setting(key='brandmeister_tg_last_sync', value=utcnow().isoformat(), group='brandmeister')); db.session.commit(); return count

def fetch_brandmeister_json(url, params=None, cache_seconds=60):
    params = params or {}
    cache_key = 'bm_cache_' + hashlib.sha256((url + json.dumps(params, sort_keys=True)).encode('utf-8')).hexdigest()
    cached = db.session.get(Setting, cache_key)
    if cached:
        try:
            payload = json.loads(cached.value)
            fetched_at = datetime.datetime.fromisoformat(payload['fetched_at'])
            if utcnow() - fetched_at < datetime.timedelta(seconds=cache_seconds):
                return payload['data']
        except (KeyError, ValueError, json.JSONDecodeError):
            pass
    last_exc = None
    for attempt in range(3):
        try:
            response = requests.get(url, params=params, timeout=10, headers={'User-Agent': 'dvswitch-aws-ncs/1.0'})
            response.raise_for_status()
            data = response.json()
            db.session.merge(Setting(key=cache_key, value=json.dumps({'fetched_at': utcnow().isoformat(), 'data': data}), group='brandmeister_cache'))
            db.session.commit()
            return data
        except requests.RequestException as exc:
            last_exc = exc
            time.sleep(1 + attempt)
    if cached:
        return json.loads(cached.value).get('data')
    raise last_exc

def parse_aprs_position(line):
    match = re.match(r'^([A-Z0-9-]+)>[^:]+:([!=/])(\d{2})(\d{2}\.\d{2})([NS])(.)(\d{3})(\d{2}\.\d{2})([EW])(.)(.*)$', line, re.IGNORECASE)
    if not match: return None
    lat = int(match.group(3)) + float(match.group(4)) / 60; lon = int(match.group(7)) + float(match.group(8)) / 60
    if match.group(5) == 'S': lat *= -1
    if match.group(9) == 'W': lon *= -1
    comment = match.group(11) or ''; course_speed = re.search(r'(\d{3})/(\d{3})', comment)
    return Aprs(callsign=match.group(1).upper(), timestamp=utcnow(), latitude=lat, longitude=lon, speed=float(course_speed.group(2))*1.852 if course_speed else 0.0, heading=int(course_speed.group(1)) if course_speed else 0, comment=sanitize(comment, 255), symbol=f'{match.group(6)}{match.group(10)}', raw=line)

def prune_aprs_rows():
    cutoff = utcnow() - datetime.timedelta(days=Config.APRS_RETENTION_DAYS); Aprs.query.filter(Aprs.timestamp < cutoff).delete(); overflow = Aprs.query.count() - Config.APRS_MAX_ROWS
    if overflow > 0:
        for row in Aprs.query.order_by(Aprs.timestamp.asc()).limit(overflow).all(): db.session.delete(row)

def aprs_is_listener():
    if not Config.APRS_ENABLED: return
    while True:
        try:
            with socket.create_connection((Config.APRS_IS_HOST, Config.APRS_IS_PORT), timeout=30) as sock:
                sock.settimeout(60); sock.sendall(f'user {Config.APRS_IS_CALLSIGN} pass {Config.APRS_IS_PASSCODE} vers dvswitch-aws-ncs 1.0 filter {Config.APRS_IS_FILTER}\n'.encode('ascii'))
                buffer = ''
                while True:
                    chunk = sock.recv(4096).decode('utf-8', errors='ignore')
                    if not chunk: break
                    buffer += chunk; lines = buffer.splitlines(); buffer = '' if buffer.endswith(('\n','\r')) else (lines.pop() if lines else '')
                    with app.app_context():
                        for line in lines:
                            if line and not line.startswith('#'):
                                packet = parse_aprs_position(line)
                                if packet: db.session.add(packet); db.session.add(Event(event_type='aprs', message=f'APRS packet {packet.callsign}', severity='info'))
                        prune_aprs_rows(); db.session.commit()
        except Exception as exc:
            with app.app_context(): db.session.rollback(); db.session.add(Event(event_type='aprs', message=f'APRS-IS reconnect after error: {exc}', severity='warning')); db.session.commit()
            time.sleep(30)

def start_aprs_is_listener(): threading.Thread(target=aprs_is_listener, daemon=True).start()

def auto_start_net_saturday():
    with app.app_context():
        if Net.query.filter_by(status='active').first(): return
        name = f"Worldwide TG{Config.NET_AUTOMATIC_TG} Net - {datetime.datetime.now(IST).strftime('%Y-%m-%d %H:%M IST')}"
        success, message = tune_tg_radio(Config.NET_AUTOMATIC_TG)
        if not success: db.session.add(Event(event_type='scheduler', message=f'TG91 auto-start tune failed: {message}', severity='error')); db.session.commit(); return
        db.session.add(Net(name=name, status='active', talkgroup=Config.NET_AUTOMATIC_TG, start_time=utcnow())); db.session.add(Event(event_type='scheduler', message=f"Automated net session '{name}' initiated", severity='info')); db.session.commit()

def build_adif(checkins):
    output = io.StringIO(); output.write('DMR DVSwitch BrandMeister NCS Station platform generated ADIF\n'); output.write(adif_field('ADIF_VER','3.1.4') + adif_field('PROGRAMID','DMRNCSCONSOLE') + '<EOH>\n\n')
    for c in checkins:
        start = c.join_time or c.timestamp; end = c.last_heard_time or c.timestamp; comment = f'TG{c.net.talkgroup} check-in #{c.number}' if c.net else f'Check-in #{c.number}'
        for name, value in [('CALL', c.callsign.upper()), ('QSO_DATE', start.strftime('%Y%m%d')), ('TIME_ON', start.strftime('%H%M%S')), ('TIME_OFF', end.strftime('%H%M%S')), ('MODE','DIGITALVOICE'), ('SUBMODE','DMR'), ('COMMENT', comment), ('APP_DVSWITCH_DMR_ID', c.dmr_id), ('NAME', c.name or ''), ('COUNTRY', c.country or '')]:
            if value: output.write(adif_field(name, value))
        output.write('<EOR>\n')
    return output.getvalue()

def generate_net_adif_file(net):
    os.makedirs(Config.EXPORT_DIR, exist_ok=True); path = os.path.join(Config.EXPORT_DIR, f'net_{net.id}_tg{net.talkgroup}_{utcnow().strftime("%Y%m%d_%H%M%S")}.adi')
    with open(path, 'w', encoding='utf-8') as fh: fh.write(build_adif(CheckIn.query.filter_by(net_id=net.id).all()))
    db.session.add(Report(net_id=net.id, title=f'{net.name} ADIF', format='ADIF', path=path)); return path

def auto_close_net_sunday():
    with app.app_context():
        active_net = Net.query.filter_by(status='active', talkgroup=Config.NET_AUTOMATIC_TG).first()
        if not active_net: return
        active_net.status = 'stopped'; active_net.end_time = utcnow(); active_net.duration = int((active_net.end_time - active_net.start_time).total_seconds()/60); active_net.participant_count = active_net.checkins.count(); active_net.country_count = len({c.country for c in active_net.checkins.all() if c.country}); generate_net_adif_file(active_net); active_net.archived = True; db.session.add(Event(event_type='scheduler', message=f"Automated net session '{active_net.name}' archived", severity='info')); db.session.commit()

def service_statuses(): return {service: systemd_status(unit) for service, unit in Config.SYSTEMD_UNITS.items()}

# Start APScheduler with native cron automation triggers
scheduler = BackgroundScheduler()
scheduler.add_job(parse_radio_logs_job, 'interval', seconds=5)

# Strictly trigger on Saturdays 21:30 IST and Sunday 03:00 IST directly via scheduler definitions
scheduler.add_job(auto_start_net_saturday, 'cron', day_of_week='sat', hour=Config.NET_START_HOUR, minute=Config.NET_START_MINUTE, timezone=IST)
scheduler.add_job(auto_close_net_sunday, 'cron', day_of_week='sun', hour=Config.NET_CLOSE_HOUR, minute=Config.NET_CLOSE_MINUTE, timezone=IST)

scheduler.start()
start_aprs_is_listener()


# --- HTTP API ROUTE CONTROLLERS ---

# 1. Dashboard Status API
@app.route('/api/status', methods=['GET'])
def get_system_status():
    ab_info = get_ab_info()
    cpu = psutil.cpu_percent()
    ram = psutil.virtual_memory().percent
    disk = psutil.disk_usage('/').percent
    diff = int(datetime.datetime.now().timestamp()) - int(psutil.boot_time())
    uptime_str = f"{diff // 86400}d {(diff % 86400) // 3600}h {(diff % 3600) // 60}m"
    try:
        fetch_brandmeister_json(Config.BRANDMEISTER_MASTERS_URL)
        brandmeister = "online"
    except requests.RequestException:
        brandmeister = "degraded"
    active_net = Net.query.filter_by(status='active').first()
    return jsonify({
        "current_tg": ab_info["tg"],
        "current_callsign": ab_info["call"],
        "current_dmr_id": ab_info["gw"],
        "current_repeater_id": ab_info["rpt"],
        "brandmeister_status": brandmeister,
        "cpu_usage": cpu,
        "ram_usage": ram,
        "disk_usage": disk,
        "uptime": uptime_str,
        "server_public_ip": Config.SERVER_PUBLIC_IP,
        "last_tune_time": TalkgroupRecent.query.order_by(TalkgroupRecent.tuned_at.desc()).first().tuned_at.isoformat() if TalkgroupRecent.query.first() else None,
        "net_active": active_net is not None,
        "active_net": {
            "id": active_net.id,
            "name": active_net.name,
            "talkgroup": active_net.talkgroup,
            "participants": active_net.participant_count,
            "countries": active_net.country_count
        } if active_net else None,
        "services": service_statuses()
    })

# 2. Talkgroup API - Directory, Search, Favorites, Recents and Tune Controls
@app.route('/talkgroups', methods=['GET'])
def get_talkgroups_html():
    countries = db.session.query(Talkgroup.country).distinct().all()
    categories = db.session.query(Talkgroup.category).distinct().all()
    languages = db.session.query(Talkgroup.language).distinct().all()
    regions = db.session.query(Talkgroup.region).distinct().all()
    return render_template(
        'talkgroups.html',
        talkgroups=Talkgroup.query.order_by(Talkgroup.number.asc()).all(),
        countries=sorted([c[0] for c in countries if c[0]]),
        categories=sorted([c[0] for c in categories if c[0]]),
        languages=sorted([l[0] for l in languages if l[0]]),
        regions=sorted([r[0] for r in regions if r[0]]),
        current_tg=get_ab_info()["tg"],
    )

def serialize_talkgroup(tg):
    return {"number": tg.number, "name": tg.name, "country": tg.country, "description": tg.description, "category": tg.category, "language": tg.language, "region": tg.region, "source": tg.source}

def talkgroup_query_from_request():
    q = sanitize(request.args.get('q', ''), 120)
    query = Talkgroup.query
    if q:
        like = f"%{q}%"
        query = query.filter(
            db.or_(
                Talkgroup.number.cast(db.String).like(like),
                Talkgroup.name.like(like),
                Talkgroup.country.like(like),
                Talkgroup.language.like(like),
                Talkgroup.description.like(like),
            )
        )
    for attr in ['country', 'language', 'region', 'category']:
        value = sanitize(request.args.get(attr, ''), 100)
        if value:
            query = query.filter(getattr(Talkgroup, attr) == value)
    return query.order_by(Talkgroup.number.asc())

@app.route('/api/talkgroups', methods=['GET'])
def get_talkgroups():
    return jsonify([serialize_talkgroup(tg) for tg in talkgroup_query_from_request().limit(2000).all()])

@app.route('/api/talkgroups/search', methods=['GET'])
def search_talkgroups():
    return get_talkgroups()

@app.route('/api/talkgroups/sync', methods=['POST'])
@login_required
def sync_talkgroups_api():
    if not (current_user.has_role('Admin') or current_user.has_role('Operator')):
        return jsonify({"error": "Operator access required"}), 403
    try:
        count = sync_brandmeister_talkgroups()
        log_audit_action('BrandMeister talkgroup sync', target=Config.BRANDMEISTER_TALKGROUP_URL, status='success')
        return jsonify({"success": True, "count": count})
    except requests.RequestException as exc:
        log_audit_action('BrandMeister talkgroup sync', target=Config.BRANDMEISTER_TALKGROUP_URL, status='failed')
        return jsonify({"error": str(exc)}), 502

@app.route('/api/talkgroups/favorites', methods=['GET', 'POST', 'DELETE'])
@login_required
def talkgroup_favorites():
    if request.method == 'GET':
        favorites = TalkgroupFavorite.query.order_by(TalkgroupFavorite.created_at.desc()).all()
        return jsonify([{"talkgroup": f.talkgroup, "label": f.label, "createdAt": f.created_at.isoformat()} for f in favorites])
    data = request.json or {}
    tg = parse_int(data.get('talkgroup'))
    if not tg:
        return jsonify({"error": "Invalid talkgroup"}), 400
    if request.method == 'POST':
        fav = TalkgroupFavorite.query.filter_by(talkgroup=tg).first() or TalkgroupFavorite(talkgroup=tg)
        fav.label = sanitize(data.get('label'), 120) or fav.label
        db.session.merge(fav); db.session.commit()
        log_audit_action('Favorite talkgroup', target=f'TG {tg}', status='success')
        return jsonify({"success": True})
    TalkgroupFavorite.query.filter_by(talkgroup=tg).delete(); db.session.commit()
    log_audit_action('Unfavorite talkgroup', target=f'TG {tg}', status='success')
    return jsonify({"success": True})

@app.route('/api/talkgroups/recent', methods=['GET'])
def talkgroup_recent():
    rows = TalkgroupRecent.query.order_by(TalkgroupRecent.tuned_at.desc()).limit(25).all()
    return jsonify([{"talkgroup": r.talkgroup, "action": r.action, "tunedAt": r.tuned_at.isoformat()} for r in rows])

@app.route('/api/talkgroup/tune', methods=['POST'])
@login_required
def tune_talkgroup():
    if not current_user.has_role("Admin"):
        return jsonify({"error": "Unauthorized permission check failed"}), 403
    tg = parse_int((request.json or {}).get('tg'))
    if not tg:
        return jsonify({"error": "Invalid talkgroup target specified"}), 400
    success, message = tune_tg_radio(tg)
    log_audit_action(action=f"Tune talkgroup to {tg}", target=f"TG {tg}", status="success" if success else "failed")
    if not success:
        return jsonify({"error": message}), 500
    return jsonify({"success": True, "message": message})

@app.route('/api/talkgroup/disconnect', methods=['POST'])
@login_required
def disconnect_talkgroup_api():
    if not current_user.has_role("Admin"):
        return jsonify({"error": "Unauthorized permission check failed"}), 403
    success, message = disconnect_talkgroup()
    log_audit_action(action="Disconnect talkgroup", target="DVSwitch", status="success" if success else "failed")
    if not success:
        return jsonify({"error": message}), 500
    return jsonify({"success": True, "message": message})

# 3. Live Heard Logs and Stations Search API
@app.route('/api/heard', methods=['GET'])
def get_heard_stations():
    search = sanitize(request.args.get('search', ''), 120)
    tg = request.args.get('tg', '')
    since = request.args.get('range', 'day')
    query = Heard.query
    if search:
        like = f"%{search}%"
        query = query.filter(db.or_(Heard.callsign.like(like), Heard.dmr_id.like(like), Heard.country.like(like), Heard.name.like(like), Heard.city.like(like)))
    parsed_tg = parse_int(tg) if tg else None
    if parsed_tg:
        query = query.filter_by(talkgroup=parsed_tg)
    cutoff_map = {'hour': datetime.timedelta(hours=1), 'day': datetime.timedelta(days=1), 'week': datetime.timedelta(days=7), 'month': datetime.timedelta(days=31)}
    if since in cutoff_map:
        query = query.filter(Heard.last_heard >= utcnow() - cutoff_map[since])
    records = query.order_by(Heard.last_heard.desc()).limit(1000).all()
    return jsonify([{
        "id": r.id,
        "callsign": r.callsign,
        "dmrId": r.dmr_id,
        "name": r.name,
        "city": r.city,
        "country": r.country,
        "talkgroup": r.talkgroup,
        "firstHeard": r.first_heard.isoformat() if r.first_heard else "",
        "lastHeard": r.last_heard.isoformat() if r.last_heard else "",
        "txCount": r.tx_count,
        "airtime": r.airtime,
        "netParticipation": r.net_participation
    } for r in records])

@app.route('/api/heard/history', methods=['GET'])
def get_heard_history():
    since = request.args.get('range', 'day')
    query = HeardHistory.query
    cutoff_map = {'hour': datetime.timedelta(hours=1), 'day': datetime.timedelta(days=1), 'week': datetime.timedelta(days=7), 'month': datetime.timedelta(days=31)}
    if since in cutoff_map:
        query = query.filter(HeardHistory.started_at >= utcnow() - cutoff_map[since])
    tg = parse_int(request.args.get('tg')) if request.args.get('tg') else None
    if tg:
        query = query.filter_by(talkgroup=tg)
    rows = query.order_by(HeardHistory.started_at.desc()).limit(2000).all()
    return jsonify([{"id": r.id, "source": r.source, "callsign": r.callsign, "dmrId": r.dmr_id, "name": r.name, "city": r.city, "country": r.country, "talkgroup": r.talkgroup, "timestamp": r.started_at.isoformat(), "duration": r.duration} for r in rows])

# 4. Net Session Management Dashboard API (Audit/Controls)
@app.route('/api/nets', methods=['GET'])
def list_nets():
    nets = Net.query.order_by(Net.start_time.desc()).all()
    return jsonify([{
        "id": n.id,
        "name": n.name,
        "status": n.status,
        "talkgroup": n.talkgroup,
        "startTime": n.start_time.isoformat(),
        "endTime": n.end_time.isoformat() if n.end_time else None,
        "duration": n.duration,
        "participantCount": n.participant_count,
        "countryCount": n.country_count
    } for n in nets])

@app.route('/api/net/control', methods=['POST'])
@login_required
def control_net_session():
    if not current_user.has_role("Admin"):
        return jsonify({"error": "Admin access required"}), 403
        
    data = request.json or {}
    action = data.get('action') # start, stop, pause, resume
    net_id = data.get('net_id')
    
    if action == 'start':
        existing_active = Net.query.filter_by(status='active').first()
        if existing_active:
            return jsonify({"error": "An active Net session is already in progress. Close it first."}), 400
        
        # Start brand new session
        tg = data.get('tg', 91)
        name = data.get('name', f"Tactical NCS Net TG{tg} - {datetime.datetime.now(IST).strftime('%Y-%m-%d %H:%M')}")
        
        net = Net(
            name=name,
            status='active',
            talkgroup=int(tg),
            start_time=datetime.datetime.utcnow(),
            participant_count=0,
            country_count=0
        )
        db.session.add(net)
        db.session.commit()
        
        tune_success, tune_message = tune_tg_radio(tg)
        log_audit_action("Start Net", name, "success" if tune_success else "failed")
        return jsonify({"success": tune_success, "message": f"NCS Net '{name}' initialized. {tune_message}"}), (200 if tune_success else 500)
        
    elif action == 'stop':
        active = Net.query.filter_by(status='active').first()
        if not active:
            return jsonify({"error": "No active Net in session to terminate"}), 400
            
        active.status = 'stopped'
        active.end_time = datetime.datetime.utcnow()
        if active.start_time:
            td = active.end_time - active.start_time
            active.duration = int(td.total_seconds() / 60)
            
        db.session.commit()
        log_audit_action("Stop Net", active.name, "success")
        return jsonify({"success": True, "message": f"NCS Net '{active.name}' closed. Generating net package logs."})

    elif action == 'pause':
        active = Net.query.filter_by(status='active').first()
        if active:
            active.status = 'paused'
            db.session.commit()
            return jsonify({"success": True, "message": "Net operations paused."})
            
    elif action == 'resume':
        paused = Net.query.filter_by(status='paused').first()
        if paused:
            paused.status = 'active'
            db.session.commit()
            return jsonify({"success": True, "message": "Net operations resumed."})
            
    return jsonify({"error": "Invalid command argument passed"}), 400

# 5. Checkin board tracker endpoint
@app.route('/api/net/checkins', methods=['GET'])
def get_net_checkins():
    active_net = Net.query.filter_by(status='active').first()
    if not active_net:
        # Fallback to last stopped net to prevent empty projections
        active_net = Net.query.filter(Net.status != 'scheduled').order_by(Net.start_time.desc()).first()
        
    if not active_net:
        return jsonify({"net_name": "No active nets", "checkins": []})
        
    checkins = CheckIn.query.filter_by(net_id=active_net.id).order_by(CheckIn.number.asc()).all()
    return jsonify({
        "net_id": active_net.id,
        "net_name": active_net.name,
        "status": active_net.status,
        "talkgroup": active_net.talkgroup,
        "checkins": [{
            "number": c.number,
            "callsign": c.callsign,
            "dmrId": c.dmr_id,
            "country": c.country,
            "timestamp": c.timestamp.isoformat(),
            "signalReport": c.signal_report,
            "validated": c.validated
        } for c in checkins]
    })


@app.route('/api/checkins/add', methods=['POST'])
@login_required
def add_checkin():
    if not (current_user.has_role('Admin') or current_user.has_role('Operator')):
        return jsonify({"error": "Operator access required"}), 403
    active_net = Net.query.filter_by(status='active').first()
    if not active_net:
        return jsonify({"error": "No active net session"}), 400
    data = request.json or {}
    callsign = sanitize(data.get('callsign'), 30).upper()
    if not re.match(r'^[A-Z0-9/]{3,15}$', callsign):
        return jsonify({"error": "Invalid callsign"}), 400
    metadata = lookup_radio_metadata(callsign=callsign)
    dmr_id = sanitize(data.get('dmrId') or metadata.get('dmr_id'), 30)
    if not re.match(r'^\d{4,10}$', dmr_id):
        return jsonify({"error": "Valid DMR ID is required or callsign must resolve via RadioID"}), 400
    if CheckIn.query.filter_by(net_id=active_net.id, dmr_id=dmr_id).first() or CheckIn.query.filter_by(net_id=active_net.id, callsign=callsign).first():
        return jsonify({"error": "Station already checked in"}), 409
    checkin = CheckIn(
        net_id=active_net.id,
        number=active_net.checkins.count() + 1,
        callsign=callsign,
        dmr_id=dmr_id,
        name=sanitize(data.get('name') or metadata.get('name'), 120),
        city=sanitize(data.get('city') or metadata.get('city'), 100),
        country=sanitize(data.get('country') or metadata.get('country'), 100) or 'Unknown',
        timestamp=utcnow(),
        join_time=utcnow(),
        last_heard_time=utcnow(),
        signal_report=sanitize(data.get('signalReport') or '59', 10),
        validated=True,
        late_checkin=utcnow() > (active_net.start_time + datetime.timedelta(minutes=30)),
    )
    db.session.add(checkin)
    active_net.participant_count = active_net.checkins.count() + 1
    db.session.commit()
    active_net.country_count = len({c.country for c in active_net.checkins.all() if c.country})
    db.session.commit()
    log_audit_action('Manual check-in added', callsign, 'success')
    return jsonify({"success": True, "checkin": {"number": checkin.number, "callsign": checkin.callsign, "dmrId": checkin.dmr_id}})

@app.route('/api/checkins/validate', methods=['POST'])
@login_required
def validate_checkin():
    if not (current_user.has_role('Admin') or current_user.has_role('Operator')):
        return jsonify({"error": "Operator access required"}), 403
    data = request.json or {}
    net_id = parse_int(data.get('net_id'))
    number = parse_int(data.get('number'))
    checkin = CheckIn.query.filter_by(net_id=net_id, number=number).first() if net_id and number else None
    if not checkin:
        return jsonify({"error": "Check-in not found"}), 404
    checkin.validated = not checkin.validated
    db.session.commit()
    log_audit_action('Toggle check-in validation', f'{checkin.callsign} #{checkin.number}', 'success')
    return jsonify({"success": True, "validated": checkin.validated})

@app.route('/api/checkins/delete', methods=['POST'])
@login_required
def delete_checkin():
    if not current_user.has_role('Admin'):
        return jsonify({"error": "Admin access required"}), 403
    data = request.json or {}
    net_id = parse_int(data.get('net_id'))
    number = parse_int(data.get('number'))
    checkin = CheckIn.query.filter_by(net_id=net_id, number=number).first() if net_id and number else None
    if not checkin:
        return jsonify({"error": "Check-in not found"}), 404
    net = checkin.net
    db.session.delete(checkin); db.session.flush()
    for idx, row in enumerate(CheckIn.query.filter_by(net_id=net.id).order_by(CheckIn.number.asc()).all(), start=1):
        row.number = idx
    net.participant_count = net.checkins.count(); net.country_count = len({c.country for c in net.checkins.all() if c.country})
    db.session.commit()
    log_audit_action('Delete check-in', f'{net.name} #{number}', 'success')
    return jsonify({"success": True})

# 6. Service Controls Dashboard Action (Admin Systemctl Operations)
@app.route('/api/services/control', methods=['POST'])
@login_required
def service_control():
    if not current_user.has_role("Admin"):
        return jsonify({"error": "Unauthorized permission check failed"}), 403
    data = request.json or {}
    service = sanitize(data.get('service'), 40)
    action = sanitize(data.get('action'), 20)
    if service == 'system_reboot':
        ok, output = control_systemd_service('gunicorn', 'restart') if os.environ.get('ENABLE_HOST_REBOOT') != 'true' else (subprocess.run(['sudo', 'reboot'], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=5).returncode == 0, 'reboot requested')
    else:
        ok, output = control_systemd_service(service, action)
    log_audit_action(f"Service Control: {action} {service}", target=service, status="success" if ok else "failed")
    if not ok:
        return jsonify({"error": output}), 500
    return jsonify({"success": True, "console_output": output, "services": service_statuses()})

# 7. EXPORTS: ADIF and CSV

def filtered_checkin_query():
    query = CheckIn.query.join(Net)
    net_id = request.args.get('net_id')
    if net_id:
        parsed = parse_int(net_id)
        if parsed:
            query = query.filter(CheckIn.net_id == parsed)
    station = sanitize(request.args.get('station', ''), 30).upper()
    if station:
        query = query.filter(CheckIn.callsign == station)
    tg = parse_int(request.args.get('talkgroup')) if request.args.get('talkgroup') else None
    if tg:
        query = query.filter(Net.talkgroup == tg)
    date_from = request.args.get('date_from')
    date_to = request.args.get('date_to')
    if date_from:
        query = query.filter(CheckIn.timestamp >= datetime.datetime.fromisoformat(date_from))
    if date_to:
        query = query.filter(CheckIn.timestamp <= datetime.datetime.fromisoformat(date_to) + datetime.timedelta(days=1))
    return query.order_by(CheckIn.timestamp.asc())

def validate_adif_checkins(checkins):
    errors = []
    for c in checkins:
        if not re.match(r'^[A-Z0-9/]{3,15}$', c.callsign or ''):
            errors.append(f'Check-in {c.id}: invalid CALL')
        if not re.match(r'^\d{4,10}$', c.dmr_id or ''):
            errors.append(f'Check-in {c.id}: invalid DMR ID')
        if not c.timestamp:
            errors.append(f'Check-in {c.id}: missing timestamp')
    return errors

@app.route('/api/exports/adif/validate', methods=['GET'])
def validate_adif_export():
    checkins = filtered_checkin_query().all()
    errors = validate_adif_checkins(checkins)
    return jsonify({"valid": not errors, "errors": errors, "qso_count": len(checkins)})

@app.route('/api/exports/adif', methods=['GET'])
def export_adif():
    checkins = filtered_checkin_query().all()
    errors = validate_adif_checkins(checkins)
    if errors:
        return jsonify({"error": "ADIF validation failed", "errors": errors}), 422
    mem = io.BytesIO()
    mem.write(build_adif([c for c in checkins if c.validated]).encode('utf-8'))
    mem.seek(0)
    return send_file(mem, mimetype="text/plain", as_attachment=True, download_name=f"dmr_ncs_log_{utcnow().strftime('%Y%m%d_%H%M%S')}.adi")

@app.route('/api/exports/csv', methods=['GET'])
def export_csv():
    checkins = filtered_checkin_query().all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Checkin No", "Callsign", "DMR ID", "Name", "City", "Country", "Join Time", "Last Heard", "Signal Report", "Verified", "Late"])
    for c in checkins:
        writer.writerow([c.number, c.callsign, c.dmr_id, c.name or '', c.city or '', c.country, (c.join_time or c.timestamp).isoformat(), (c.last_heard_time or c.timestamp).isoformat(), c.signal_report, "YES" if c.validated else "NO", "YES" if c.late_checkin else "NO"])
    mem = io.BytesIO(); mem.write(output.getvalue().encode('utf-8')); mem.seek(0)
    return send_file(mem, mimetype="text/csv", as_attachment=True, download_name=f"ncs_checkins_{utcnow().strftime('%Y%m%d_%H%M')}.csv")

def compute_country_stats():
    rows = {}
    for station in Station.query.all():
        item = rows.setdefault(station.country or 'Unknown', {"country": station.country or 'Unknown', "stations": 0, "transmissions": 0, "airtime": 0, "checkins": 0})
        item["stations"] += 1
        item["transmissions"] += station.total_tx or 0
        item["airtime"] += station.total_airtime or 0
    for checkin in CheckIn.query.all():
        item = rows.setdefault(checkin.country or 'Unknown', {"country": checkin.country or 'Unknown', "stations": 0, "transmissions": 0, "airtime": 0, "checkins": 0})
        item["checkins"] += 1
    return sorted(rows.values(), key=lambda r: (r['checkins'], r['transmissions']), reverse=True)

@app.route('/api/stats/countries', methods=['GET'])
def country_stats():
    return jsonify(compute_country_stats())

@app.route('/api/ncs/dashboard', methods=['GET'])
def ncs_dashboard():
    active = Net.query.filter_by(status='active').first()
    recent_heard = Heard.query.order_by(Heard.last_heard.desc()).limit(10).all()
    top_tgs = db.session.query(Heard.talkgroup, db.func.sum(Heard.tx_count)).group_by(Heard.talkgroup).order_by(db.func.sum(Heard.tx_count).desc()).limit(10).all()
    return jsonify({
        "activeNet": {"id": active.id, "name": active.name, "talkgroup": active.talkgroup, "checkins": active.checkins.count(), "countries": active.country_count} if active else None,
        "newStations": [{"callsign": h.callsign, "dmrId": h.dmr_id, "country": h.country, "talkgroup": h.talkgroup, "lastHeard": h.last_heard.isoformat()} for h in recent_heard],
        "countries": compute_country_stats(),
        "topTalkgroups": [{"talkgroup": tg, "transmissions": int(count or 0)} for tg, count in top_tgs],
        "activeOperators": [u.username for u in User.query.filter_by(active=True).all()],
    })

@app.route('/api/brandmeister/lastheard', methods=['GET'])
def brandmeister_lastheard():
    try:
        return jsonify(fetch_brandmeister_json(Config.BRANDMEISTER_LASTHEARD_URL, dict(request.args)))
    except requests.RequestException as exc:
        return jsonify({"error": str(exc)}), 502

@app.route('/api/brandmeister/masters', methods=['GET'])
def brandmeister_masters():
    try:
        return jsonify(fetch_brandmeister_json(Config.BRANDMEISTER_MASTERS_URL))
    except requests.RequestException as exc:
        return jsonify({"error": str(exc)}), 502

# 8. Authentication HTML and Session Handling API
@app.route('/api/auth/login', methods=['POST'])
def process_login():
    data = request.json or {}
    username = sanitize(data.get('username'), 80).lower()
    password = data.get('password')
    if not username or not password:
        return jsonify({"error": "Username and password details must be filled."}), 400
    user = User.query.filter_by(username=username).first()
    if user and user.locked_until and user.locked_until > utcnow():
        log_audit_action("User login locked", f"User {username}", "failed", username=username)
        return jsonify({"error": "Account temporarily locked after failed login attempts."}), 423
    if not user or not user.active or not user.check_password(password):
        if user:
            user.failed_logins = (user.failed_logins or 0) + 1
            if user.failed_logins >= 5:
                user.locked_until = utcnow() + datetime.timedelta(minutes=15)
            db.session.commit()
        log_audit_action("User login failed", f"User {username}", "failed", username=username)
        return jsonify({"error": "Incorrect password or username details. Please try again."}), 401
    user.failed_logins = 0
    user.locked_until = None
    user.last_login_at = utcnow()
    db.session.commit()
    session.permanent = True
    login_user(user, remember=False)
    log_audit_action("User login successful", "User logged in", "success", username=username)
    return jsonify({"success": True, "username": user.username, "roles": [role.name for role in user.roles], "message": "Logged in successfully to admin panel."})

@app.route('/api/auth/logout', methods=['POST'])
@login_required
def process_logout():
    log_audit_action("User logout executed", "User logout active", "success")
    logout_user()
    return jsonify({"success": True, "message": "Successfully logged out from station dashboard."})

@app.route('/api/auth/session', methods=['GET'])
def get_current_session():
    if current_user.is_authenticated:
        return jsonify({
            "is_logged_in": True,
            "username": current_user.username,
            "roles": [role.name for role in current_user.roles]
        })
    return jsonify({"is_logged_in": False, "username": "anonymous", "roles": ["ReadOnly"]})

# APRS Packet Telemetry API
@app.route('/api/aprs', methods=['GET'])
def get_aprs_beacons():
    packets = Aprs.query.order_by(Aprs.timestamp.desc()).limit(10).all()
    if not packets:
        return jsonify([])
    return jsonify([{
        "id": p.id,
        "callsign": p.callsign,
        "timestamp": p.timestamp.isoformat(),
        "latitude": p.latitude,
        "longitude": p.longitude,
        "altitude": p.altitude,
        "speed": p.speed,
        "heading": p.heading,
        "comment": p.comment,
        "symbol": p.symbol
    } for p in packets])



@app.route('/api/stations', methods=['GET'])
def stations_api():
    rows = Station.query.order_by(Station.last_heard.desc()).limit(2000).all()
    return jsonify([{"callsign": s.callsign, "dmrId": s.dmr_id, "name": s.name, "city": s.city, "country": s.country, "firstHeard": s.first_heard.isoformat() if s.first_heard else '', "lastHeard": s.last_heard.isoformat() if s.last_heard else '', "totalAirtime": s.total_airtime or 0, "totalTx": s.total_tx or 0, "totalNets": s.total_nets or 0, "mostUsedTg": s.most_used_tg} for s in rows])

@app.route('/api/radioid/user', methods=['GET'])
def radioid_user_api():
    callsign = sanitize(request.args.get('callsign'), 30).upper() or None
    dmr_id = sanitize(request.args.get('id'), 30) or None
    record = lookup_radio_metadata(callsign=callsign, dmr_id=dmr_id)
    if not record:
        return jsonify({"error": "RadioID record not found"}), 404
    return jsonify(record)

@app.route('/api/logs', methods=['GET'])
@login_required
def api_logs():
    if not (current_user.has_role('Admin') or current_user.has_role('Operator')):
        return jsonify({"error": "Operator access required"}), 403
    source = sanitize(request.args.get('type', 'mmdvm'), 40)
    path = log_sources_for_today().get(source) or {'apache': '/var/log/apache2/error.log', 'system': '/var/log/syslog'}.get(source)
    lines = parse_int(request.args.get('lines'), 1, 500) or 100
    if not path or not os.path.exists(path):
        return jsonify({"error": "Log file not available", "path": path}), 404
    with open(path, 'r', encoding='utf-8', errors='ignore') as fh:
        content = fh.read().splitlines()[-lines:]
    return '\n'.join(content), 200, {'Content-Type': 'text/plain; charset=utf-8'}

@app.route('/api/audits', methods=['GET'])
@login_required
def audits_api():
    if not current_user.has_role('Admin'):
        return jsonify({"error": "Admin access required"}), 403
    rows = AuditLog.query.order_by(AuditLog.timestamp.desc()).limit(500).all()
    return jsonify([{"id": r.id, "timestamp": r.timestamp.isoformat(), "user": r.user, "role": r.role, "action": r.action, "target": r.target, "status": r.status, "ipAddress": r.ip_address} for r in rows])

@app.route('/api/docs', methods=['GET'])
def api_docs():
    return jsonify({
        "openapi": "3.1.0",
        "info": {"title": "DVSwitch AWS NCS Appliance API", "version": "1.0.0"},
        "paths": {
            "/api/status": {"get": {"summary": "System, BrandMeister and service status"}},
            "/api/talkgroups": {"get": {"summary": "Local talkgroup directory"}},
            "/api/talkgroups/search": {"get": {"summary": "Search talkgroups by number/name/country/language/description"}},
            "/api/talkgroups/sync": {"post": {"summary": "Synchronize BrandMeister talkgroups"}},
            "/api/talkgroups/favorites": {"get": {}, "post": {}, "delete": {}},
            "/api/talkgroups/recent": {"get": {}},
            "/api/talkgroup/tune": {"post": {"summary": "Tune DVSwitch talkgroup"}},
            "/api/talkgroup/disconnect": {"post": {"summary": "Disconnect DVSwitch talkgroup"}},
            "/api/heard": {"get": {"summary": "Aggregated live heard"}},
            "/api/heard/history": {"get": {"summary": "Transmission history"}},
            "/api/aprs": {"get": {"summary": "Recent APRS-IS positions"}},
            "/api/ncs/dashboard": {"get": {"summary": "NCS operator dashboard"}},
            "/api/exports/adif": {"get": {"summary": "Validated ADIF export"}},
            "/api/exports/adif/validate": {"get": {"summary": "ADIF validation"}},
            "/api/services/control": {"post": {"summary": "systemd allow-list control"}},
            "/api/audits": {"get": {"summary": "Audit log"}},
        }
    })

if __name__ == '__main__':
    # Flask runner
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', '5000')), debug=False)
