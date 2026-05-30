import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

// Set up server port 3000 (MANDATORY per environment instructions)
const PORT = 3000;

// --- IN-MEMORY DATABASE SIMULATOR FOR DEV SANDBOX ---
// Seed data matching typical Amateur Radio operations & BrandMeister TG configurations
let currentTg = 91;
let currentCallsign = "VU3EFZ";
let currentDmrId = "4040444";
let currentRepeaterId = "404044418";
let lastTuneTimestamp = "2026-05-30 08:59:48";

interface ServiceStatuses {
  analogBridge: "running" | "stopped" | "failed";
  mmdvmBridge: "running" | "stopped" | "failed";
  apache: "running" | "stopped" | "failed";
  gunicorn: "running" | "stopped" | "failed";
  dvswitch: "running" | "stopped" | "failed";
}

let services: ServiceStatuses = {
  analogBridge: "running",
  mmdvmBridge: "running",
  apache: "running",
  gunicorn: "running",
  dvswitch: "running",
};

interface MockUser {
  username: string;
  roles: string[];
}

let mockCurrentUser: MockUser | null = null;

// Audit logs simulation
interface AuditRecord {
  id: string;
  timestamp: string;
  user: string;
  role: string;
  action: string;
  target: string;
  status: "success" | "failed";
  ipAddress: string;
}

const auditLogs: AuditRecord[] = [
  {
    id: "aud_1",
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    user: "admin",
    role: "Admin",
    action: "System Initialization",
    target: "Database Setup",
    status: "success",
    ipAddress: "127.0.0.1"
  },
  {
    id: "aud_2",
    timestamp: new Date(Date.now() - 1800000).toISOString(),
    user: "admin",
    role: "Admin",
    action: "Tune talkgroup to 91",
    target: "TG 91",
    status: "success",
    ipAddress: "15.206.12.84"
  }
];

// Talkgroup Directory
interface TalkgroupItem {
  number: number;
  name: string;
  country: string;
  description: string;
  category: string;
  language: string;
  region: string;
}

const talkgroups: TalkgroupItem[] = [
  { number: 91, name: "Worldwide", country: "Worldwide", description: "Primary World Talkgroup", category: "International", language: "English", region: "Global" },
  { number: 404, name: "India Net", country: "India", description: "Primary National TG", category: "National", language: "Hindi/English", region: "Asia" },
  { number: 40480, name: "India English", country: "India", description: "Indian English Net", category: "National", language: "English", region: "Asia" },
  { number: 92, name: "Europe", country: "Europe-wide", description: "European Regional TG", category: "Regional", language: "Multi", region: "Europe" },
  { number: 93, name: "North America", country: "North America", description: "North American Regional TG", category: "Regional", language: "English", region: "North America" },
  { number: 3100, name: "USA Nationwide", country: "United States", description: "United States Main Bridge", category: "National", language: "English", region: "North America" },
  { number: 235, name: "United Kingdom", country: "United Kingdom", description: "UK General Chat", category: "National", language: "English", region: "Europe" },
  { number: 505, name: "Australia Main", country: "Australia", description: "VK Nationwide Bridge", category: "National", language: "English", region: "Oceania" },
  { number: 910, name: "Worldwide German", country: "Worldwide", description: "German Language Primary", category: "Language", language: "German", region: "Europe" }
];

// Stations Database
interface StationItem {
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

const stations: StationItem[] = [
  { callsign: "VU3EFZ", dmrId: "4040444", country: "India", firstHeard: "2026-05-15T12:00:00Z", lastHeard: "2026-05-30T08:50:00Z", totalAirtime: 1240, totalTx: 142, totalNets: 4, mostUsedTg: 91, notes: "NCS Operator Station", tags: ["NCS", "Admin"] },
  { callsign: "KF0VOX", dmrId: "3129845", country: "United States", firstHeard: "2026-05-20T08:30:00Z", lastHeard: "2026-05-30T08:45:00Z", totalAirtime: 4800, totalTx: 320, totalNets: 6, mostUsedTg: 91, notes: "Active participant", tags: ["QSL"] },
  { callsign: "VU2DOR", dmrId: "4040122", country: "India", firstHeard: "2026-05-18T10:15:00Z", lastHeard: "2026-05-30T08:32:00Z", totalAirtime: 8100, totalTx: 520, totalNets: 8, mostUsedTg: 40480, notes: "Regional net coordinator", tags: ["VK-Net"] },
  { callsign: "IU7TZF", dmrId: "2223849", country: "Italy", firstHeard: "2026-05-22T14:20:00Z", lastHeard: "2026-05-30T08:21:00Z", totalAirtime: 1980, totalTx: 112, totalNets: 2, mostUsedTg: 91, tags: ["European-op"] },
  { callsign: "JF1EEZ", dmrId: "4401824", country: "Japan", firstHeard: "2026-05-24T03:10:00Z", lastHeard: "2026-05-30T08:18:00Z", totalAirtime: 3420, totalTx: 210, totalNets: 3, mostUsedTg: 91, notes: "Constant Japan DX station" },
  { callsign: "G4BMF", dmrId: "2354812", country: "United Kingdom", firstHeard: "2026-05-10T17:40:00Z", lastHeard: "2026-05-30T07:55:00Z", totalAirtime: 5120, totalTx: 288, totalNets: 5, mostUsedTg: 91 },
  { callsign: "VK4ADX", dmrId: "5052914", country: "Australia", firstHeard: "2026-05-12T06:50:00Z", lastHeard: "2026-05-30T07:44:00Z", totalAirtime: 2900, totalTx: 175, totalNets: 2, mostUsedTg: 505 }
];

// Live Heard Items (Dynamic array)
interface LiveHeardItem {
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

const liveHeard: LiveHeardItem[] = [
  { id: "lh_1", callsign: "KF0VOX", dmrId: "3129845", country: "United States", talkgroup: 91, firstHeard: new Date(Date.now() - 600000).toISOString(), lastHeard: new Date(Date.now() - 30000).toISOString(), txCount: 8, airtime: 48, netParticipation: true },
  { id: "lh_2", callsign: "VU2DOR", dmrId: "4040122", country: "India", talkgroup: 40480, firstHeard: new Date(Date.now() - 1200000).toISOString(), lastHeard: new Date(Date.now() - 60000).toISOString(), txCount: 15, airtime: 98, netParticipation: false },
  { id: "lh_3", callsign: "IU7TZF", dmrId: "2223849", country: "Italy", talkgroup: 91, firstHeard: new Date(Date.now() - 2400000).toISOString(), lastHeard: new Date(Date.now() - 300000).toISOString(), txCount: 4, airtime: 24, netParticipation: true },
  { id: "lh_4", callsign: "JF1EEZ", dmrId: "4401824", country: "Japan", talkgroup: 91, firstHeard: new Date(Date.now() - 3600000).toISOString(), lastHeard: new Date(Date.now() - 1200000).toISOString(), txCount: 12, airtime: 64, netParticipation: true }
];

// Net History and Active Nets
interface CheckInItem {
  number: number;
  callsign: string;
  country: string;
  dmrId: string;
  timestamp: string;
  signalReport?: string;
  validated: boolean;
}

interface NetSessionItem {
  id: string;
  name: string;
  status: "active" | "paused" | "stopped" | "scheduled";
  talkgroup: number;
  startTime: string;
  endTime?: string;
  duration?: number;
  participantCount: number;
  countryCount: number;
  checkins: CheckInItem[];
}

const nets: NetSessionItem[] = [
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
  },
  {
    id: "net_historic_2",
    name: "National DMR Net TG404",
    status: "stopped",
    talkgroup: 404,
    startTime: new Date(Date.now() - 604800000).toISOString(),
    endTime: new Date(Date.now() - 604800000 + 7200000).toISOString(),
    duration: 120,
    participantCount: 18,
    countryCount: 1,
    checkins: []
  }
];

// APRS Telemetry Logs
interface AprsItem {
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

const aprsData: AprsItem[] = [
  { id: "aprs_1", callsign: "VU3EFZ-9", timestamp: new Date().toISOString(), latitude: 12.9716, longitude: 77.5946, altitude: 920.0, speed: 12.5, heading: 45, comment: "DMR Hotspot Mobile", symbol: "/#" },
  { id: "aprs_2", callsign: "KF0VOX-7", timestamp: new Date(Date.now() - 150000).toISOString(), latitude: 40.7128, longitude: -74.0060, altitude: 10.0, speed: 55.4, heading: 270, comment: "Mobile station brandmeister", symbol: "[-]" },
  { id: "aprs_3", callsign: "G4BMF-10", timestamp: new Date(Date.now() - 300000).toISOString(), latitude: 51.5074, longitude: -0.1278, altitude: 35.0, speed: 0.0, heading: 0, comment: "NCS backup node ready", symbol: "[-]" }
];

// MMDVM/Service Logs Simulators
const getMmdvmLogs = (): string[] => {
  const dates = new Date().toISOString().split("T")[0];
  return [
    `[${dates} 08:30:22] MMDVM_Bridge Engine successfully initialized.`,
    `[${dates} 08:31:05] Connecting to BrandMeister DMR Master Server...`,
    `[${dates} 08:31:08] Master connection established: TG91 active.`,
    `[${dates} 08:50:11] received network voice header from KF0VOX to TG 91`,
    `[${dates} 08:50:14] Begin TX: src=3129845 rpt=312984501 dst=91 slot=2 cc=1 metadata=KF0VOX`,
    `[${dates} 08:50:32] End of transmission: 18s airtime.`,
    `[${dates} 08:52:45] received network voice header from IU7TZF to TG 91`,
    `[${dates} 08:52:51] Begin TX: src=2223849 rpt=222384918 dst=91 slot=2 cc=1 metadata=IU7TZF`,
    `[${dates} 08:55:12] received network voice header from JF1EEZ to TG 91`,
    `[${dates} 08:55:18] Begin TX: src=4401824 rpt=440182412 dst=91 slot=2 cc=1 metadata=JF1EEZ`
  ];
};

const getApacheLogs = (): string[] => {
  return [
    `[authz_core:info] [pid 1245] [client 15.206.12.84:18204] AH01626: authorization successful`,
    `[proxy:debug] [pid 1245] [client 15.206.12.84:18204] AH01143: Preserving host header: dmr.realneilbruce.in`,
    `[proxy_http:debug] [pid 1246] [client 127.0.0.1:40984] AH01111: Forwarding request to http://127.0.0.1:5000/api/status`,
    `[headers:debug] [pid 1245] Adding CORS and Security headers on path /admin`
  ];
};

const getSystemLogs = (): string[] => {
  return [
    `systemd[1]: Starting dvs-admin.service: Gunicorn instance server...`,
    `gunicorn[1248]: [INFO] Starting gunicorn 22.0.0`,
    `gunicorn[1248]: [INFO] Listening at: http://127.0.0.1:5000`,
    `gunicorn[1248]: [INFO] Booting worker with pid: 1249`,
    `systemd[1]: Started dvs-admin.service: Gunicorn instance server.`
  ];
};

// Background live transmission simulation routine
// Simulates live DMR transmissions every 6 seconds to update the active dashboard
setInterval(() => {
  const callsigns = ["KF0VOX", "IU7TZF", "JF1EEZ", "G4BMF", "VK4ADX", "VU2DOR", "VU3EFZ"];
  const randomCall = callsigns[Math.floor(Math.random() * callsigns.length)];
  const randomDuration = Math.floor(Math.random() * 15) + 3; // 3 to 18 seconds
  const matchedStation = stations.find(s => s.callsign === randomCall);
  
  if (matchedStation) {
    // Add airtime
    matchedStation.totalAirtime += randomDuration;
    matchedStation.totalTx += 1;
    matchedStation.lastHeard = new Date().toISOString();
    
    // Update live heard
    const existingHeard = liveHeard.find(lh => lh.callsign === randomCall);
    if (existingHeard) {
      existingHeard.lastHeard = new Date().toISOString();
      existingHeard.txCount += 1;
      existingHeard.airtime += randomDuration;
    } else {
      liveHeard.unshift({
        id: "lh_" + Date.now(),
        callsign: randomCall,
        dmrId: matchedStation.dmrId,
        country: matchedStation.country,
        talkgroup: currentTg,
        firstHeard: new Date().toISOString(),
        lastHeard: new Date().toISOString(),
        txCount: 1,
        airtime: randomDuration,
        netParticipation: true
      });
      if (liveHeard.length > 25) {
        liveHeard.pop();
      }
    }

    // If there's an active Net, check this station in
    const activeNet = nets.find(n => n.status === "active");
    if (activeNet && activeNet.talkgroup === currentTg) {
      const alreadyChecked = activeNet.checkins.some(c => c.callsign === randomCall);
      if (!alreadyChecked) {
        activeNet.checkins.push({
          number: activeNet.checkins.length + 1,
          callsign: randomCall,
          country: matchedStation.country,
          dmrId: matchedStation.dmrId,
          timestamp: new Date().toISOString(),
          signalReport: "59",
          validated: true
        });
        activeNet.participantCount = activeNet.checkins.length;
        
        // Count unique countries
        const countriesSet = new Set(activeNet.checkins.map(c => c.country));
        activeNet.countryCount = countriesSet.size;
      }
    }

    // Randomize APRS location
    const movingCall = randomCall + "-9";
    const aprsPoint = aprsData.find(ap => ap.callsign.startsWith(randomCall));
    if (aprsPoint) {
      aprsPoint.latitude += (Math.random() - 0.5) * 0.01;
      aprsPoint.longitude += (Math.random() - 0.5) * 0.01;
      aprsPoint.timestamp = new Date().toISOString();
      aprsPoint.speed = Math.floor(Math.random() * 80) + 10;
      aprsPoint.heading = Math.floor(Math.random() * 360);
    }
  }
}, 6000);


async function startServer() {
  const app = express();
  app.use(express.json());

  // --- API BACKEND PROXIES AND CONTROLLER ACTIONS ---

  // Dashboard Status Endpoint
  app.get("/api/status", (req, res) => {
    const activeNet = nets.find(n => n.status === "active");
    res.json({
      current_tg: currentTg,
      current_callsign: currentCallsign,
      current_dmr_id: currentDmrId,
      current_repeater_id: currentRepeaterId,
      brandmeister_status: "online",
      cpu_usage: Math.floor(Math.random() * 20) + 15, // Dynamic CPU
      ram_usage: 42,
      disk_usage: 58,
      uptime: "4d 14h 22m",
      server_public_ip: "15.206.12.84",
      last_tune_time: lastTuneTimestamp,
      net_active: activeNet !== undefined,
      active_net: activeNet ? {
        id: activeNet.id,
        name: activeNet.name,
        talkgroup: activeNet.talkgroup,
        participants: activeNet.participantCount,
        countries: activeNet.countryCount
      } : null,
      services: services
    });
  });

  // Talkgroups Directory
  app.get("/api/talkgroups", (req, res) => {
    const q = (req.query.q as string || "").toLowerCase();
    const region = (req.query.region as string || "").toLowerCase();
    const category = (req.query.category as string || "").toLowerCase();
    const language = (req.query.language as string || "").toLowerCase();
    const country = (req.query.country as string || "").toLowerCase();
    
    let filtered = [...talkgroups];
    
    if (q) {
      filtered = filtered.filter(tg => 
        tg.number.toString().includes(q) ||
        tg.name.toLowerCase().includes(q) || 
        tg.country.toLowerCase().includes(q) ||
        tg.region.toLowerCase().includes(q) ||
        tg.description.toLowerCase().includes(q) ||
        tg.category.toLowerCase().includes(q) ||
        tg.language.toLowerCase().includes(q)
      );
    }
    
    if (region) {
      filtered = filtered.filter(tg => tg.region.toLowerCase() === region);
    }
    if (category) {
      filtered = filtered.filter(tg => tg.category.toLowerCase() === category);
    }
    if (language) {
      filtered = filtered.filter(tg => tg.language.toLowerCase() === language);
    }
    if (country) {
      filtered = filtered.filter(tg => tg.country.toLowerCase() === country);
    }
    
    res.json(filtered);
  });

  // Tune gateway to specific TG
  app.post("/api/talkgroup/tune", (req, res) => {
    const { tg, username } = req.body;
    if (!tg) {
      return res.status(400).json({ error: "Missing TG parameter" });
    }
    
    currentTg = parseInt(tg);
    lastTuneTimestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
    
    // Add audit entry
    auditLogs.unshift({
      id: "aud_" + Date.now(),
      timestamp: new Date().toISOString(),
      user: username || "admin",
      role: "Admin",
      action: `Tune talkgroup to ${tg}`,
      target: `TG ${tg}`,
      status: "success",
      ipAddress: "127.0.0.1"
    });

    res.json({ success: true, message: `Successfully tuned station payload to Talkgroup ${tg}` });
  });

  // Live Heard API
  app.get("/api/heard", (req, res) => {
    const search = (req.query.search as string || "").toLowerCase();
    const tg = req.query.tg as string;
    
    let filtered = [...liveHeard];
    
    if (search) {
      filtered = filtered.filter(lh => 
        lh.callsign.toLowerCase().includes(search) || 
        lh.dmrId.includes(search) || 
        lh.country.toLowerCase().includes(search)
      );
    }
    if (tg) {
      filtered = filtered.filter(lh => lh.talkgroup === parseInt(tg));
    }
    
    res.json(filtered);
  });

  // Station profiles
  app.get("/api/stations", (req, res) => {
    res.json(stations);
  });

  app.get("/api/stations/:callsign", (req, res) => {
    const callsign = req.params.callsign.toUpperCase();
    const station = stations.find(s => s.callsign === callsign);
    if (!station) {
      return res.status(404).json({ error: "Station profile not found." });
    }
    res.json(station);
  });

  app.post("/api/stations/:callsign/notes", (req, res) => {
    const callsign = req.params.callsign.toUpperCase();
    const { notes, tags } = req.body;
    const station = stations.find(s => s.callsign === callsign);
    if (station) {
      station.notes = notes;
      station.tags = tags;
      return res.json({ success: true, station });
    }
    res.status(404).json({ error: "Station not found" });
  });

  // Net Management Logs and Control Modes
  app.get("/api/nets", (req, res) => {
    res.json(nets);
  });

  // Current Net Checkins Board
  app.get("/api/net/checkins", (req, res) => {
    const activeNet = nets.find(n => n.status === "active") || nets[0];
    res.json({
      net_id: activeNet.id,
      net_name: activeNet.name,
      status: activeNet.status,
      talkgroup: activeNet.talkgroup,
      checkins: activeNet.checkins
    });
  });

  // Action overrides to Start, Stop, Pause, Resume Net sessions
  app.post("/api/net/control", (req, res) => {
    const { action, tg, name, username } = req.body;
    
    if (action === "start") {
      const activeNet = nets.find(n => n.status === "active");
      if (activeNet) {
        return res.status(400).json({ error: "An active net session is already in progress." });
      }
      
      const newNet: NetSessionItem = {
        id: "net_" + Date.now(),
        name: name || `Worldwide TG${tg || 91} Net`,
        status: "active",
        talkgroup: parseInt(tg || 91),
        startTime: new Date().toISOString(),
        participantCount: 0,
        countryCount: 0,
        checkins: []
      };
      
      // Auto switch talkgroup if start is called
      currentTg = newNet.talkgroup;
      
      nets.unshift(newNet);
      
      auditLogs.unshift({
        id: "aud_" + Date.now(),
        timestamp: new Date().toISOString(),
        user: username || "admin",
        role: "Admin",
        action: "Start Net Session",
        target: newNet.name,
        status: "success",
        ipAddress: "127.0.0.1"
      });
      
      return res.json({ success: true, message: `Initialized Net ${newNet.name}` });
    }
    
    const activeNet = nets.find(n => n.status === "active" || n.status === "paused");
    if (!activeNet) {
      return res.status(400).json({ error: "No active Net in session to control." });
    }
    
    if (action === "stop") {
      activeNet.status = "stopped";
      activeNet.endTime = new Date().toISOString();
      const differenceMs = new Date(activeNet.endTime).getTime() - new Date(activeNet.startTime).getTime();
      activeNet.duration = Math.ceil(differenceMs / 60000);
      
      auditLogs.unshift({
        id: "aud_" + Date.now(),
        timestamp: new Date().toISOString(),
        user: username || "admin",
        role: "Admin",
        action: "Stop Net Session",
        target: activeNet.name,
        status: "success",
        ipAddress: "127.0.0.1"
      });
      
      res.json({ success: true, message: `Halt logged for Net: ${activeNet.name}` });
    } else if (action === "pause") {
      activeNet.status = "paused";
      res.json({ success: true, message: "Net session paused successfully." });
    } else if (action === "resume") {
      activeNet.status = "active";
      res.json({ success: true, message: "Net session resumed successfully." });
    } else {
      res.status(400).json({ error: "Requested control action invalid." });
    }
  });

  // Services Control Console Command Execution
  app.post("/api/services/control", (req, res) => {
    const { service, action, username } = req.body;
    
    if (service === "system_reboot") {
      auditLogs.unshift({
        id: "aud_" + Date.now(),
        timestamp: new Date().toISOString(),
        user: username || "admin",
        role: "Admin",
        action: "System Reboot Triggered",
        target: "AWS EC2 Instance Node",
        status: "success",
        ipAddress: "127.0.0.1"
      });
      return res.json({
        success: true,
        console_output: "System call executed successfully:\nConnection closed. Initiating AWS EC2 Host reboot sequence...\nReboot command sent to kernel."
      });
    }

    if (services.hasOwnProperty(service)) {
      const typedService = service as keyof ServiceStatuses;
      if (action === "restart") {
        services[typedService] = "running";
      } else if (action === "stop") {
        services[typedService] = "stopped";
      } else if (action === "start") {
        services[typedService] = "running";
      }
      
      const realServiceShellCommand = `sudo systemctl ${action} ${service === 'apache' ? 'apache2' : service === 'gunicorn' ? 'dvs-admin' : service}`;
      
      auditLogs.unshift({
        id: "aud_" + Date.now(),
        timestamp: new Date().toISOString(),
        user: username || "admin",
        role: "Admin",
        action: `Service ${action}: ${service}`,
        target: service,
        status: "success",
        ipAddress: "127.0.0.1"
      });

      return res.json({
        success: true,
        console_output: `[root@dmr-ncs ~]# ${realServiceShellCommand}\n\n[SYSTEMCTL SUCCESS] - Service ${service} restarted, status loaded: 'active (running)'.`
      });
    }
    
    res.status(400).json({ error: "Requested service control is invalid" });
  });

  // Audit Logs query
  app.get("/api/audits", (req, res) => {
    res.json(auditLogs);
  });

  // APRS Data Packets
  app.get("/api/aprs", (req, res) => {
    res.json(aprsData);
  });

  // Log Viewers (Serve mock live text logs based on log type selected)
  app.get("/api/logs", (req, res) => {
    const logType = req.query.type as string || "mmdvm";
    let body: string[] = [];
    if (logType === "mmdvm") {
      body = getMmdvmLogs();
    } else if (logType === "apache") {
      body = getApacheLogs();
    } else if (logType === "system") {
      body = getSystemLogs();
    } else {
      body = [
        `[2026-05-30 08:59:48] App Server logging running: Flask session live.`,
        `[2026-05-30 09:00:15] GET /api/status 200 OK (User: anonymous)`,
        `[2026-05-30 09:00:22] background parse of logs generated: 0 new transmissions found`
      ];
    }
    res.send(body.join("\n"));
  });

  // Auth processing endpoint
  app.post("/api/auth/login", (req, res) => {
    const { username, password } = req.body;
    
    // Check credentials matching request specifications
    if (username === "admin" && password === "vulcan3efz!") {
      mockCurrentUser = { username: "admin", roles: ["Admin"] };
      
      auditLogs.unshift({
        id: "aud_login_" + Date.now(),
        timestamp: new Date().toISOString(),
        user: "admin",
        role: "Admin",
        action: "Admin Account Authentication",
        target: "Private Panel /admin",
        status: "success",
        ipAddress: "127.0.0.1"
      });

      return res.json({
        success: true,
        username: "admin",
        roles: ["Admin"],
        message: "Successfully logged in to Admin secure cockpit."
      });
    } else if (username === "readonly" && password === "radio") {
      mockCurrentUser = { username: "readonly", roles: ["ReadOnly"] };
      
      auditLogs.unshift({
        id: "aud_login_" + Date.now(),
        timestamp: new Date().toISOString(),
        user: "readonly",
        role: "ReadOnly",
        action: "Observer Account Authentication",
        target: "Private Panel /admin",
        status: "success",
        ipAddress: "127.0.0.1"
      });

      return res.json({
        success: true,
        username: "readonly",
        roles: ["ReadOnly"],
        message: "Successfully logged in as Observer."
      });
    } else {
      auditLogs.unshift({
        id: "aud_failed_" + Date.now(),
        timestamp: new Date().toISOString(),
        user: username || "unknown",
        role: "none",
        action: "Authentication Failed",
        target: "Private Panel /admin",
        status: "failed",
        ipAddress: "127.0.0.1"
      });
      return res.status(401).json({ error: "Invalid username details or password selection." });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    mockCurrentUser = null;
    res.json({ success: true, message: "Logged out successfully" });
  });

  app.get("/api/auth/session", (req, res) => {
    if (mockCurrentUser) {
      return res.json({
        is_logged_in: true,
        username: mockCurrentUser.username,
        roles: mockCurrentUser.roles
      });
    }
    res.json({ is_logged_in: false, username: "anonymous", roles: ["ReadOnly"] });
  });

  // Single Checkin validation / delete
  app.post("/api/checkins/validate", (req, res) => {
    const { number, net_id } = req.body;
    const net = nets.find(n => n.id === net_id);
    if (net) {
      const checkin = net.checkins.find(c => c.number === number);
      if (checkin) {
        checkin.validated = !checkin.validated;
        return res.json({ success: true, checkin });
      }
    }
    res.status(404).json({ error: "Checkin not found" });
  });

  app.post("/api/checkins/delete", (req, res) => {
    const { number, net_id } = req.body;
    const net = nets.find(n => n.id === net_id);
    if (net) {
      const index = net.checkins.findIndex(c => c.number === number);
      if (index !== -1) {
        net.checkins.splice(index, 1);
        // Correct checkin numbers
        net.checkins.forEach((c, idx) => {
          c.number = idx + 1;
        });
        net.participantCount = net.checkins.length;
        const countriesSet = new Set(net.checkins.map(c => c.country));
        net.countryCount = countriesSet.size;
        return res.json({ success: true });
      }
    }
    res.status(404).json({ error: "Checkin not found" });
  });

  // Manual Checkin Add
  app.post("/api/checkins/add", (req, res) => {
    const { callsign, dmrId, country, signalReport } = req.body;
    const activeNet = nets.find(n => n.status === "active");
    if (!activeNet) {
      return res.status(400).json({ error: "No active net session is currently running." });
    }
    
    const uppercaseCall = callsign.toUpperCase();
    const alreadyCheckin = activeNet.checkins.some(c => c.callsign === uppercaseCall);
    if (alreadyCheckin) {
      return res.status(400).json({ error: `Station ${uppercaseCall} is already checked in to this Net.` });
    }

    const newCheckin: CheckInItem = {
      number: activeNet.checkins.length + 1,
      callsign: uppercaseCall,
      country: country || "India",
      dmrId: dmrId || "404" + Math.floor(Math.random() * 100000),
      timestamp: new Date().toISOString(),
      signalReport: signalReport || "59",
      validated: true
    };

    activeNet.checkins.push(newCheckin);
    activeNet.participantCount = activeNet.checkins.length;
    const countriesSet = new Set(activeNet.checkins.map(c => c.country));
    activeNet.countryCount = countriesSet.size;

    // Check if station is in Stations DB, if not add it
    const existStation = stations.some(s => s.callsign === uppercaseCall);
    if (!existStation) {
      stations.push({
        callsign: uppercaseCall,
        dmrId: newCheckin.dmrId,
        country: newCheckin.country,
        firstHeard: new Date().toISOString(),
        lastHeard: new Date().toISOString(),
        totalAirtime: 15,
        totalTx: 1,
        totalNets: 1,
        mostUsedTg: activeNet.talkgroup
      });
    }

    res.json({ success: true, checkin: newCheckin });
  });

  // --- DOWNLOADABLE EXPORTS IN MEMORY SUITES ---
  // Generate real CSV of Checkins
  app.get("/api/exports/csv", (req, res) => {
    const netId = req.query.net_id as string;
    const net = nets.find(n => n.id === netId) || nets[0];
    
    let csvContent = "Checkin_Number,Callsign,DMR_ID,Country,Timestamp,Signal_Report,Validated\n";
    net.checkins.forEach(c => {
      csvContent += `${c.number},${c.callsign},${c.dmrId},"${c.country}",${c.timestamp},${c.signalReport || "59"},${c.validated ? "YES" : "NO"}\n`;
    });
    
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=ncs_net_${net.talkgroup}_checkins.csv`);
    res.send(csvContent);
  });

  // Generate real ADIF file for Amateur Radio log ingestion
  app.get("/api/exports/adif", (req, res) => {
    const netId = req.query.net_id as string;
    const net = nets.find(n => n.id === netId) || nets[0];
    
    let adif = "DMR DVSwitch BrandMeister NCS Station platform generated ADIF\n<ADIF_VER:5>3.1.4\n<PROGRAMID:13>DMRNCSCONSOLE\n<EOH>\n\n";
    net.checkins.forEach(c => {
      const dateStr = new Date(c.timestamp).toISOString().split("T")[0].replace(/-/g, "");
      const timeStr = new Date(c.timestamp).toISOString().split("T")[1].replace(/:/g, "").slice(0, 6);
      
      adif += `<CALL:${c.callsign.length}>${c.callsign} `;
      adif += `<MODE:3>DMR `;
      adif += `<QSO_DATE:8>${dateStr} `;
      adif += `<TIME_ON:6>${timeStr} `;
      adif += `<COMMENT:${`Checkin No ${c.number} on Net TG ${net.talkgroup}`.length}>Checkin No ${c.number} on Net TG ${net.talkgroup} `;
      adif += `<BAND:3>70C `;
      adif += `<DMR_ID:${c.dmrId.length}>${c.dmrId} `;
      adif += `<EOR>\n`;
    });

    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Content-Disposition", `attachment; filename=ncs_net_${net.talkgroup}_log.adi`);
    res.send(adif);
  });


  // --- VITE DEV AND DEPLOYMENT SERVING HANDLERS ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[FULLSTACK SUCCESS] Server booted successfully and listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
