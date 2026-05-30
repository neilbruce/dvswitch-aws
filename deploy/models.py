# models.py - Production SQLAlchemy Models for DMR NCS Platform
import datetime
from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()

user_roles = db.Table('user_roles',
    db.Column('user_id', db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
    db.Column('role_id', db.Integer, db.ForeignKey('roles.id', ondelete='CASCADE'), primary_key=True)
)

class Role(db.Model):
    __tablename__ = 'roles'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)
    description = db.Column(db.String(255))

    def __repr__(self):
        return f"<Role {self.name}>"

class User(UserMixin, db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=True)
    password_hash = db.Column(db.String(255), nullable=False)
    active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    failed_logins = db.Column(db.Integer, default=0)
    locked_until = db.Column(db.DateTime, nullable=True)
    last_login_at = db.Column(db.DateTime, nullable=True)

    roles = db.relationship('Role', secondary=user_roles, backref=db.backref('users', lazy='dynamic'))

    def set_password(self, password):
        self.password_hash = generate_password_hash(password, method='scrypt')

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def has_role(self, role_name):
        return any(role.name == role_name for role in self.roles)

class Station(db.Model):
    __tablename__ = 'stations'
    dmr_id = db.Column(db.String(30), primary_key=True)
    callsign = db.Column(db.String(30), unique=True, nullable=False, index=True)
    name = db.Column(db.String(120), nullable=True)
    city = db.Column(db.String(100), nullable=True)
    state = db.Column(db.String(100), nullable=True)
    country = db.Column(db.String(100), nullable=False)
    first_heard = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    last_heard = db.Column(db.DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    total_airtime = db.Column(db.Integer, default=0)
    total_tx = db.Column(db.Integer, default=0)
    total_nets = db.Column(db.Integer, default=0)
    most_used_tg = db.Column(db.Integer, nullable=True)
    notes = db.Column(db.Text, nullable=True)
    tags = db.Column(db.String(255), nullable=True)
    radioid_updated_at = db.Column(db.DateTime, nullable=True)

class Heard(db.Model):
    __tablename__ = 'heard'
    id = db.Column(db.Integer, primary_key=True)
    callsign = db.Column(db.String(30), nullable=False, index=True)
    dmr_id = db.Column(db.String(30), nullable=False, index=True)
    name = db.Column(db.String(120), nullable=True)
    city = db.Column(db.String(100), nullable=True)
    country = db.Column(db.String(100), nullable=True)
    talkgroup = db.Column(db.Integer, nullable=False, index=True)
    first_heard = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    last_heard = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    tx_count = db.Column(db.Integer, default=1)
    airtime = db.Column(db.Integer, default=0)
    net_participation = db.Column(db.Boolean, default=False)
    last_net_id = db.Column(db.Integer, db.ForeignKey('nets.id'), nullable=True)

class HeardHistory(db.Model):
    __tablename__ = 'heard_history'
    id = db.Column(db.Integer, primary_key=True)
    source = db.Column(db.String(40), nullable=False, index=True)
    callsign = db.Column(db.String(30), nullable=False, index=True)
    dmr_id = db.Column(db.String(30), nullable=True, index=True)
    name = db.Column(db.String(120), nullable=True)
    city = db.Column(db.String(100), nullable=True)
    country = db.Column(db.String(100), nullable=True)
    talkgroup = db.Column(db.Integer, nullable=False, index=True)
    started_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, index=True)
    ended_at = db.Column(db.DateTime, nullable=True)
    duration = db.Column(db.Integer, default=0)
    raw = db.Column(db.Text, nullable=True)

class Net(db.Model):
    __tablename__ = 'nets'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    status = db.Column(db.String(30), default='scheduled')
    talkgroup = db.Column(db.Integer, nullable=False)
    start_time = db.Column(db.DateTime, nullable=False)
    end_time = db.Column(db.DateTime, nullable=True)
    duration = db.Column(db.Integer, nullable=True)
    participant_count = db.Column(db.Integer, default=0)
    country_count = db.Column(db.Integer, default=0)
    archived = db.Column(db.Boolean, default=False)

    checkins = db.relationship('CheckIn', backref='net', lazy='dynamic', cascade="all, delete-orphan")
    reports = db.relationship('Report', backref='net', lazy='dynamic')

class CheckIn(db.Model):
    __tablename__ = 'checkins'
    id = db.Column(db.Integer, primary_key=True)
    net_id = db.Column(db.Integer, db.ForeignKey('nets.id', ondelete='CASCADE'), nullable=False)
    number = db.Column(db.Integer, nullable=False)
    callsign = db.Column(db.String(30), nullable=False)
    dmr_id = db.Column(db.String(30), nullable=False)
    name = db.Column(db.String(120), nullable=True)
    city = db.Column(db.String(100), nullable=True)
    country = db.Column(db.String(100), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    join_time = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    last_heard_time = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    signal_report = db.Column(db.String(10), nullable=True, default='59')
    validated = db.Column(db.Boolean, default=True)
    late_checkin = db.Column(db.Boolean, default=False)

class Talkgroup(db.Model):
    __tablename__ = 'talkgroups'
    number = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False, index=True)
    country = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(255), nullable=True)
    category = db.Column(db.String(100), nullable=True)
    language = db.Column(db.String(100), default='')
    region = db.Column(db.String(100), nullable=True)
    source = db.Column(db.String(40), default='local')
    updated_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

class TalkgroupFavorite(db.Model):
    __tablename__ = 'talkgroup_favorites'
    id = db.Column(db.Integer, primary_key=True)
    talkgroup = db.Column(db.Integer, db.ForeignKey('talkgroups.number', ondelete='CASCADE'), nullable=False, index=True)
    label = db.Column(db.String(120), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    __table_args__ = (db.UniqueConstraint('talkgroup', name='uq_talkgroup_favorite'),)

class TalkgroupRecent(db.Model):
    __tablename__ = 'talkgroup_recent'
    id = db.Column(db.Integer, primary_key=True)
    talkgroup = db.Column(db.Integer, nullable=False, index=True)
    tuned_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, index=True)
    action = db.Column(db.String(30), default='tune')

class RadioIdCache(db.Model):
    __tablename__ = 'radioid_cache'
    dmr_id = db.Column(db.String(30), primary_key=True)
    callsign = db.Column(db.String(30), nullable=False, index=True)
    name = db.Column(db.String(120), nullable=True)
    city = db.Column(db.String(100), nullable=True)
    state = db.Column(db.String(100), nullable=True)
    country = db.Column(db.String(100), nullable=True)
    raw_json = db.Column(db.Text, nullable=True)
    fetched_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=False, index=True)

class LogCursor(db.Model):
    __tablename__ = 'log_cursors'
    source = db.Column(db.String(40), primary_key=True)
    path = db.Column(db.String(255), nullable=False)
    inode = db.Column(db.String(80), nullable=True)
    offset = db.Column(db.Integer, default=0)
    updated_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

class Country(db.Model):
    __tablename__ = 'countries'
    country = db.Column(db.String(100), primary_key=True)
    participant_count = db.Column(db.Integer, default=0)
    nets_count = db.Column(db.Integer, default=0)
    total_airtime = db.Column(db.Integer, default=0)
    last_active = db.Column(db.DateTime, default=datetime.datetime.utcnow)

class Aprs(db.Model):
    __tablename__ = 'aprs'
    id = db.Column(db.Integer, primary_key=True)
    callsign = db.Column(db.String(30), nullable=False, index=True)
    timestamp = db.Column(db.DateTime, default=datetime.datetime.utcnow, index=True)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    altitude = db.Column(db.Float, default=0.0)
    speed = db.Column(db.Float, default=0.0)
    heading = db.Column(db.Integer, default=0)
    comment = db.Column(db.String(255), nullable=True)
    symbol = db.Column(db.String(10), default='[-]')
    raw = db.Column(db.Text, nullable=True)

class AuditLog(db.Model):
    __tablename__ = 'audit_logs'
    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, default=datetime.datetime.utcnow, index=True)
    user = db.Column(db.String(80), nullable=False)
    role = db.Column(db.String(50), nullable=False)
    action = db.Column(db.String(150), nullable=False)
    target = db.Column(db.String(255), nullable=True)
    status = db.Column(db.String(20), default='success')
    ip_address = db.Column(db.String(45), nullable=True)

class Setting(db.Model):
    __tablename__ = 'settings'
    key = db.Column(db.String(100), primary_key=True)
    value = db.Column(db.Text, nullable=False)
    group = db.Column(db.String(50), default='general')

class Report(db.Model):
    __tablename__ = 'reports'
    id = db.Column(db.Integer, primary_key=True)
    net_id = db.Column(db.Integer, db.ForeignKey('nets.id'), nullable=True)
    title = db.Column(db.String(150), nullable=False)
    format = db.Column(db.String(10), nullable=False)
    path = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

class Event(db.Model):
    __tablename__ = 'events'
    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, default=datetime.datetime.utcnow, index=True)
    event_type = db.Column(db.String(50), nullable=False)
    message = db.Column(db.Text, nullable=False)
    severity = db.Column(db.String(20), default='info')
