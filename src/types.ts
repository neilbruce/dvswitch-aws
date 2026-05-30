/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Station {
  callsign: string;
  dmrId: string;
  country: string;
  firstHeard: string;
  lastHeard: string;
  totalAirtime: number; // in seconds
  totalTx: number;
  totalNets: number;
  mostUsedTg: number;
  notes?: string;
  tags?: string[];
}

export interface LiveHeardRecord {
  id: string;
  callsign: string;
  dmrId: string;
  country: string;
  talkgroup: number;
  firstHeard: string; // ISO string or timestamp
  lastHeard: string; // ISO string or timestamp
  txCount: number;
  airtime: number; // in seconds
  netParticipation: boolean;
  lastNetId?: string;
}

export interface CheckIn {
  number: number;
  callsign: string;
  country: string;
  dmrId: string;
  timestamp: string;
  signalReport?: string;
  validated: boolean;
}

export interface NetSession {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'stopped' | 'scheduled';
  talkgroup: number;
  startTime: string;
  endTime?: string;
  duration?: number; // in minutes
  participantCount: number;
  countryCount: number;
  checkins: CheckIn[];
  attendanceCount: number;
}

export interface Talkgroup {
  number: number;
  name: string;
  country: string;
  description: string;
  category: string;
  language: string;
  region: string;
}

export interface AprsPacket {
  id: string;
  callsign: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  altitude: number; // meters
  speed: number; // km/h
  heading: number; // degrees
  comment?: string;
  symbol: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  role: string;
  action: string;
  target: string;
  status: 'success' | 'failed';
  ipAddress: string;
}

export interface SystemStatus {
  cpuUsage: number;
  ramUsage: number;
  diskUsage: number;
  uptime: string;
  publicIp: string;
  databaseStatus: 'online' | 'offline';
  services: {
    analogBridge: 'running' | 'stopped' | 'failed';
    mmdvmBridge: 'running' | 'stopped' | 'failed';
    apache: 'running' | 'stopped' | 'failed';
    gunicorn: 'running' | 'stopped' | 'failed';
    dvswitch: 'running' | 'stopped' | 'failed';
  };
}
