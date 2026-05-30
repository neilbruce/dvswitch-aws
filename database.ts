import fs from "fs";
import path from "path";
import crypto from "crypto";

const DB_FILE_PATH = path.join(process.cwd(), "db_persistence.json");

export interface DBUser {
  username: string;
  passwordHash: string;
  passwordSalt: string;
  roles: string[];
}

export interface DBServiceStatuses {
  analogBridge: "running" | "stopped" | "failed";
  mmdvmBridge: "running" | "stopped" | "failed";
  apache: "running" | "stopped" | "failed";
  gunicorn: "running" | "stopped" | "failed";
  dvswitch: "running" | "stopped" | "failed";
}

export interface DBAuditRecord {
  id: string;
  timestamp: string;
  user: string;
  role: string;
  action: string;
  target: string;
  status: "success" | "failed";
  ipAddress: string;
}

export interface DBTalkgroupItem {
  number: number;
  name: string;
  country: string;
  description: string;
  category: string;
  language: string;
  region: string;
}

export interface DBStationItem {
  callsign: string;
  dmrId: string;
  country: string;
  firstHeard: string;
  lastHeard: string;
  totalAirtime: number;
  totalTx: number;
  totalNets: number;
  mostUsedTg: number;
  notes?: string;
  tags?: string[];
}

export interface DBLiveHeardItem {
  id: string;
  callsign: string;
  dmrId: string;
  country: string;
  talkgroup: number;
  firstHeard: string;
  lastHeard: string;
  txCount: number;
  airtime: number;
  netParticipation: boolean;
}

export interface DBCheckInItem {
  number: number;
  callsign: string;
  country: string;
  dmrId: string;
  timestamp: string;
  signalReport?: string;
  validated: boolean;
}

export interface DBNetSessionItem {
  id: string;
  name: string;
  status: "active" | "paused" | "stopped" | "scheduled";
  talkgroup: number;
  startTime: string;
  endTime?: string;
  duration?: number;
  participantCount: number;
  countryCount: number;
  checkins: DBCheckInItem[];
}

export interface DBAprsItem {
  id: string;
  callsign: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;
  heading: number;
  comment?: string;
  symbol: string;
}

export interface DatabaseSchema {
  currentTg: number;
  currentCallsign: string;
  currentDmrId: string;
  currentRepeaterId: string;
  lastTuneTimestamp: string;
  services: DBServiceStatuses;
  users: DBUser[];
  auditLogs: DBAuditRecord[];
  talkgroups: DBTalkgroupItem[];
  stations: DBStationItem[];
  liveHeard: DBLiveHeardItem[];
  nets: DBNetSessionItem[];
  aprsData: DBAprsItem[];
}

// Security: Dynamic Salt and Hash using PBKDF2
export function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex");
}

export function generateSalt(): string {
  return crypto.randomBytes(16).toString("hex");
}

// Seed helper to populate initial database template safely
function generateMockDMRDatabase(): DatabaseSchema {
  const adminSalt = generateSalt();
  const readonlySalt = generateSalt();

  return {
    currentTg: 91,
    currentCallsign: "VU3EFZ",
    currentDmrId: "4040444",
    currentRepeaterId: "404044418",
    lastTuneTimestamp: "2026-05-30 08:59:48",
    services: {
      analogBridge: "running",
      mmdvmBridge: "running",
      apache: "running",
      gunicorn: "running",
      dvswitch: "running",
    },
    users: [
      {
        username: "admin",
        passwordSalt: adminSalt,
        passwordHash: hashPassword("vulcan3efz!", adminSalt),
        roles: ["Admin"]
      },
      {
        username: "readonly",
        passwordSalt: readonlySalt,
        passwordHash: hashPassword("radio", readonlySalt),
        roles: ["ReadOnly"]
      }
    ],
    auditLogs: [
      {
        id: "aud_1",
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        user: "admin",
        role: "Admin",
        action: "System Initialization",
        target: "Database Setup",
        status: "success",
        ipAddress: "127.0.0.1"
      }
    ],
    talkgroups: [
      { number: 91, name: "Worldwide", country: "Worldwide", description: "Primary World Talkgroup", category: "International", language: "English", region: "Global" },
      { number: 404, name: "India Net", country: "India", description: "Primary National TG", category: "National", language: "Hindi/English", region: "Asia" },
      { number: 40480, name: "India English", country: "India", description: "Indian English Net", category: "National", language: "English", region: "Asia" },
      { number: 92, name: "Europe", country: "Europe-wide", description: "European Regional TG", category: "Regional", language: "Multi", region: "Europe" },
      { number: 93, name: "North America", country: "North America", description: "North American Regional TG", category: "Regional", language: "English", region: "North America" },
      { number: 3100, name: "USA Nationwide", country: "United States", description: "United States Main Bridge", category: "National", language: "English", region: "North America" },
      { number: 235, name: "United Kingdom", country: "United Kingdom", description: "UK General Chat", category: "National", language: "English", region: "Europe" },
      { number: 505, name: "Australia Main", country: "Australia", description: "VK Nationwide Bridge", category: "National", language: "English", region: "Oceania" },
      { number: 910, name: "Worldwide German", country: "Worldwide", description: "German Language Primary", category: "Language", language: "German", region: "Europe" }
    ],
    stations: [
      { callsign: "VU3EFZ", dmrId: "4040444", country: "India", firstHeard: "2026-05-15T12:00:00Z", lastHeard: "2026-05-30T08:50:00Z", totalAirtime: 1240, totalTx: 142, totalNets: 4, mostUsedTg: 91, notes: "NCS Operator Station", tags: ["NCS", "Admin"] },
      { callsign: "KF0VOX", dmrId: "3129845", country: "United States", firstHeard: "2026-05-20T08:30:00Z", lastHeard: "2026-05-30T08:45:00Z", totalAirtime: 4800, totalTx: 320, totalNets: 6, mostUsedTg: 91, notes: "Active participant", tags: ["QSL"] },
      { callsign: "VU2DOR", dmrId: "4040122", country: "India", firstHeard: "2026-05-18T10:15:00Z", lastHeard: "2026-05-30T08:32:00Z", totalAirtime: 8100, totalTx: 520, totalNets: 8, mostUsedTg: 40480, notes: "Regional net coordinator", tags: ["VK-Net"] },
      { callsign: "IU7TZF", dmrId: "2223849", country: "Italy", firstHeard: "2026-05-22T14:20:00Z", lastHeard: "2026-05-30T08:21:00Z", totalAirtime: 1980, totalTx: 112, totalNets: 2, mostUsedTg: 91, tags: ["European-op"] },
      { callsign: "JF1EEZ", dmrId: "4401824", country: "Japan", firstHeard: "2026-05-24T03:10:00Z", lastHeard: "2026-05-30T08:18:00Z", totalAirtime: 3420, totalTx: 210, totalNets: 3, mostUsedTg: 91, notes: "Constant Japan DX station" }
    ],
    liveHeard: [
      { id: "lh_1", callsign: "KF0VOX", dmrId: "3129845", country: "United States", talkgroup: 91, firstHeard: new Date(Date.now() - 600000).toISOString(), lastHeard: new Date(Date.now() - 30000).toISOString(), txCount: 8, airtime: 48, netParticipation: true },
      { id: "lh_2", callsign: "VU2DOR", dmrId: "4040122", country: "India", talkgroup: 40480, firstHeard: new Date(Date.now() - 1200000).toISOString(), lastHeard: new Date(Date.now() - 60000).toISOString(), txCount: 15, airtime: 98, netParticipation: false }
    ],
    nets: [
      {
        id: "net_active_1",
        name: "BrandMeister Saturday TG91 Net",
        status: "active",
        talkgroup: 91,
        startTime: new Date().toISOString(),
        participantCount: 4,
        countryCount: 4,
        checkins: [
          { number: 1, callsign: "VU3EFZ", country: "India", dmrId: "4040444", timestamp: new Date(Date.now() - 900000).toISOString(), signalReport: "59", validated: true },
          { number: 2, callsign: "KF0VOX", country: "United States", dmrId: "3129845", timestamp: new Date(Date.now() - 600000).toISOString(), signalReport: "59", validated: true },
          { number: 3, callsign: "IU7TZF", country: "Italy", dmrId: "2223849", timestamp: new Date(Date.now() - 400000).toISOString(), signalReport: "57", validated: true },
          { number: 4, callsign: "JF1EEZ", country: "Japan", dmrId: "4401824", timestamp: new Date(Date.now() - 200000).toISOString(), signalReport: "59", validated: true }
        ]
      }
    ],
    aprsData: [
      { id: "aprs_1", callsign: "VU3EFZ-9", timestamp: new Date().toISOString(), latitude: 12.9716, longitude: 77.5946, altitude: 920.0, speed: 12.5, heading: 45, comment: "DMR Hotspot Mobile", symbol: "/#" },
      { id: "aprs_2", callsign: "KF0VOX-7", timestamp: new Date(Date.now() - 150000).toISOString(), latitude: 40.7128, longitude: -74.0060, altitude: 10.0, speed: 55.4, heading: 270, comment: "Mobile station brandmeister", symbol: "[-]" }
    ]
  };
}

class PersistentDatabase {
  private data!: DatabaseSchema;

  constructor() {
    this.load();
  }

  // Load from disk
  private load() {
    if (fs.existsSync(DB_FILE_PATH)) {
      try {
        const raw = fs.readFileSync(DB_FILE_PATH, "utf-8");
        this.data = JSON.parse(raw);
        // Sync structures in case of upgrades
        if (!this.data.users || this.data.users.length === 0) {
          const fresh = generateMockDMRDatabase();
          this.data.users = fresh.users;
        }
        if (!this.data.talkgroups) this.data.talkgroups = [];
        if (!this.data.stations) this.data.stations = [];
        if (!this.data.liveHeard) this.data.liveHeard = [];
        if (!this.data.nets) this.data.nets = [];
        if (!this.data.aprsData) this.data.aprsData = [];
      } catch (e) {
        console.error("Failed to read database, seeding clean template:", e);
        this.data = generateMockDMRDatabase();
        this.save();
      }
    } else {
      console.log("No persistent DB detected, initializing file database template...");
      this.data = generateMockDMRDatabase();
      this.save();
    }
  }

  // Atomic write to avoid file truncation or corruption under peak HMR reloads
  public save() {
    try {
      const tempPath = DB_FILE_PATH + ".tmp";
      fs.writeFileSync(tempPath, JSON.stringify(this.data, null, 2), "utf-8");
      fs.renameSync(tempPath, DB_FILE_PATH);
    } catch (e) {
      console.error("Atomic database save failed:", e);
    }
  }

  // Getters / Setters
  public get() {
    return this.data;
  }
}

export const dbInstance = new PersistentDatabase();
