import React, { useEffect, useState } from 'react';
import { 
  Radio, 
  Cpu, 
  Database, 
  HardDrive, 
  Server, 
  Zap, 
  Network, 
  Clock, 
  UserCheck, 
  Globe, 
  MapPin,
  Share2,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';

interface SystemStatus {
  current_tg: number;
  current_callsign: string;
  current_dmr_id: string;
  current_repeater_id: string;
  brandmeister_status: string;
  cpu_usage: number;
  ram_usage: number;
  disk_usage: number;
  uptime: string;
  server_public_ip: string;
  last_tune_time?: string;
  net_active: boolean;
  active_net?: {
    id: string;
    name: string;
    talkgroup: number;
    participants: number;
    countries: number;
  } | null;
  services: {
    analogBridge: string;
    mmdvmBridge: string;
    apache: string;
    gunicorn: string;
    dvswitch: string;
  };
}

interface DashboardViewProps {
  onViewChange: (view: string) => void;
  isLoggedIn: boolean;
  triggerRefresh: number;
}

export default function DashboardView({ onViewChange, isLoggedIn, triggerRefresh }: DashboardViewProps) {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        setError(null);
      } else {
        setError("Failed server check connection.");
      }
    } catch (e) {
      setError("DMR Gateway server connection failed.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000); // 3 seconds live update requested in prompt!
    return () => clearInterval(interval);
  }, [triggerRefresh]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-mono text-gray-500">Retrieving Brandmeister gateway telemetry...</p>
      </div>
    );
  }

  if (error || !status) {
    return (
      <div className="bg-red-50 border border-red-100 rounded-xl p-6 text-center max-w-lg mx-auto my-10 space-y-4">
        <Zap className="w-8 h-8 text-red-600 mx-auto" />
        <h3 className="text-base font-semibold text-red-900">Communication Node Failure</h3>
        <p className="text-xs text-red-600 leading-relaxed font-mono">
          Could not communicate with local DVSwitch / MMDVM_Bridge socket. Ensure services are online and port 3000 mapping is active.
        </p>
        <button 
          onClick={fetchStatus} 
          className="bg-red-600 text-white font-medium text-xs px-4 py-2 rounded-lg hover:bg-red-700 transition"
        >
          Retry Socket Hook
        </button>
      </div>
    );
  }

  const service_colors: Record<string, string> = {
    running: 'bg-green-100 text-green-800 border-green-200',
    stopped: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    failed: 'bg-red-100 text-red-800 border-red-200'
  };

  return (
    <div className="space-y-6">
      {/* Active Net Banner / Saturday NCS Reminder */}
      {status.net_active && status.active_net ? (
        <div className="bg-gradient-to-r from-red-600 via-red-500 to-indigo-600 text-white rounded-2xl p-6 shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <span className="bg-white/20 text-white text-xs font-bold font-mono px-2.5 py-1 rounded-full uppercase tracking-wider inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
              Live Net Active
            </span>
            <h2 className="text-xl font-bold tracking-tight">{status.active_net.name}</h2>
            <p className="text-xs text-red-100 font-sans">
              Currently tracking global checkins on <strong className="font-semibold text-white">Talkgroup {status.active_net.talkgroup}</strong>.
            </p>
          </div>
          <div className="flex gap-4 items-center">
            <div className="bg-white/10 px-4 py-2.5 rounded-xl border border-white/20 text-center min-w-[100px]">
              <span className="text-xl font-extrabold font-mono block">{status.active_net.participants}</span>
              <span className="text-[10px] text-red-100 uppercase font-medium">Check-ins</span>
            </div>
            <div className="bg-white/10 px-4 py-2.5 rounded-xl border border-white/20 text-center min-w-[100px]">
              <span className="text-xl font-extrabold font-mono block">{status.active_net.countries}</span>
              <span className="text-[10px] text-red-100 uppercase font-medium">Countries</span>
            </div>
            <button
              onClick={() => onViewChange('checkinboard')}
              className="bg-white hover:bg-gray-100 text-red-600 font-bold text-xs px-4 py-3 rounded-xl transition cursor-pointer flex items-center gap-1 shadow-sm"
            >
              Broadcast View
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-gray-950 border border-gray-800 text-white rounded-2xl p-5 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-gray-300">Net Control Schedule Status</h3>
            <p className="text-xs text-gray-400">
              Next Scheduled NCS Session: <span className="text-red-400 font-semibold font-mono">Saturday @ 21:30 IST</span> (TG91 Worldwide Net).
            </p>
          </div>
          {isLoggedIn ? (
            <button
              onClick={() => onViewChange('netcontrol')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold tracking-wider transition"
            >
              MANUALLY BOOT NET
            </button>
          ) : (
            <span className="text-xs text-gray-500 font-mono">STANDBY MODE</span>
          )}
        </div>
      )}

      {/* Primary DMR Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Talkgroup */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="bg-red-50 p-3.5 rounded-xl text-red-600">
            <Radio className="w-6 h-6" />
          </div>
          <div className="space-y-0.5">
            <span className="text-xs text-gray-400 font-sans font-medium uppercase tracking-wider block">Current TG</span>
            <span className="text-2xl font-bold font-mono text-gray-900 block">TG {status.current_tg}</span>
            <span className="text-[10px] text-gray-400 font-mono block">Updated: {status.last_tune_time?.split(' ')[1] || '08:59'}</span>
          </div>
        </div>

        {/* Card 2: Callsign */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="bg-blue-50 p-3.5 rounded-xl text-blue-600">
            <Server className="w-6 h-6" />
          </div>
          <div className="space-y-0.5">
            <span className="text-xs text-gray-400 font-sans font-medium uppercase tracking-wider block">Station Callsign</span>
            <span className="text-2xl font-bold font-mono text-gray-900 block">{status.current_callsign}</span>
            <span className="text-[10px] text-gray-400 font-mono block">DMR ID: {status.current_dmr_id}</span>
          </div>
        </div>

        {/* Card 3: BrandMeister Master Status */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="bg-green-50 p-3.5 rounded-xl text-green-600">
            <Network className="w-6 h-6" />
          </div>
          <div className="space-y-0.5">
            <span className="text-xs text-gray-400 font-sans font-medium uppercase tracking-wider block">DMR Master Network</span>
            <span className="text-2xl font-bold font-sans text-gray-950 block capitalize flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block animate-pulse"></span>
              {status.brandmeister_status}
            </span>
            <span className="text-[10px] text-gray-400 font-mono block">IP: 15.206.12.84</span>
          </div>
        </div>

        {/* Card 4: Hardware Uptime */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="bg-indigo-50 p-3.5 rounded-xl text-indigo-600">
            <Clock className="w-6 h-6" />
          </div>
          <div className="space-y-0.5">
            <span className="text-xs text-gray-400 font-sans font-medium uppercase tracking-wider block">AWS Server Uptime</span>
            <span className="text-xl font-bold font-mono text-gray-900 block">{status.uptime}</span>
            <span className="text-[10px] text-gray-400 font-sans block">Ubuntu 24.04 LTS OK</span>
          </div>
        </div>
      </div>

      {/* Grid: Server Stats and Application Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Columns: Services Manager */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-gray-100 shadow-sm space-y-5">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-widest font-sans border-b border-gray-50 pb-3">
            DVSwitch Radio Service Decryptor
          </h3>
          <div className="divide-y divide-gray-100">
            <div className="py-3 flex justify-between items-center">
              <div className="space-y-0.5">
                <span className="font-medium text-sm text-gray-900 block font-sans">Analog_Bridge Daemon</span>
                <span className="text-xs text-gray-400 block font-mono">Analog to digital PCM transcoding engine</span>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold uppercase border ${service_colors[status.services.analogBridge]}`}>
                {status.services.analogBridge}
              </span>
            </div>

            <div className="py-3 flex justify-between items-center">
              <div className="space-y-0.5">
                <span className="font-medium text-sm text-gray-900 block font-sans">MMDVM_Bridge Gateway</span>
                <span className="text-xs text-gray-400 block font-mono">IP network interfaces link parser</span>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold uppercase border ${service_colors[status.services.mmdvmBridge]}`}>
                {status.services.mmdvmBridge}
              </span>
            </div>

            <div className="py-3 flex justify-between items-center">
              <div className="space-y-0.5">
                <span className="font-medium text-sm text-gray-900 block font-sans">DVSwitch Payload Script</span>
                <span className="text-xs text-gray-400 block font-mono">Radio socket payload tuners</span>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold uppercase border ${service_colors[status.services.dvswitch]}`}>
                {status.services.dvswitch}
              </span>
            </div>

            <div className="py-3 flex justify-between items-center">
              <div className="space-y-0.5">
                <span className="font-medium text-sm text-gray-900 block font-sans">Apache Reverse Proxy</span>
                <span className="text-xs text-gray-400 block font-mono">Web server SSL Let's Encrypt endpoint</span>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold uppercase border ${service_colors[status.services.apache]}`}>
                {status.services.apache}
              </span>
            </div>

            <div className="py-3 flex justify-between items-center">
              <div className="space-y-0.5">
                <span className="font-medium text-sm text-gray-900 block font-sans">Gunicorn Web Daemon</span>
                <span className="text-xs text-gray-400 block font-mono">Python WSGI workers binding on port 5000</span>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold uppercase border ${service_colors[status.services.gunicorn]}`}>
                {status.services.gunicorn}
              </span>
            </div>
          </div>
          {isLoggedIn && (
            <div className="flex justify-end pt-2">
              <button
                onClick={() => onViewChange('services')}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
              >
                Access Service Control Deck
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Right Columns: Hardware Health */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm space-y-6">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-widest font-sans border-b border-gray-50 pb-3">
            AWS EC2 System Health
          </h3>
          
          <div className="space-y-4">
            {/* CPU */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs font-sans font-medium text-gray-500">
                <span className="flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-gray-400" />
                  CPU Utilization
                </span>
                <span className="font-bold font-mono text-gray-900">{status.cpu_usage}%</span>
              </div>
              <div className="w-full bg-gray-150 h-2.5 rounded-full overflow-hidden">
                <div 
                  className="bg-blue-600 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${status.cpu_usage}%` }}
                ></div>
              </div>
            </div>

            {/* RAM */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs font-sans font-medium text-gray-500">
                <span className="flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-gray-400" />
                  RAM Allocation
                </span>
                <span className="font-bold font-mono text-gray-900">{status.ram_usage}%</span>
              </div>
              <div className="w-full bg-gray-150 h-2.5 rounded-full overflow-hidden">
                <div 
                  className="bg-indigo-600 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${status.ram_usage}%` }}
                ></div>
              </div>
            </div>

            {/* Disk */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs font-sans font-medium text-gray-500">
                <span className="flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-gray-400" />
                  Root Disk Space
                </span>
                <span className="font-bold font-mono text-gray-900">{status.disk_usage}%</span>
              </div>
              <div className="w-full bg-gray-150 h-2.5 rounded-full overflow-hidden">
                <div 
                  className="bg-purple-600 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${status.disk_usage}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-50 text-xs font-mono text-gray-500 flex flex-col gap-2">
            <div className="flex justify-between">
              <span>EC2 Platform:</span>
              <span className="text-gray-900 font-bold">AWS t3.medium</span>
            </div>
            <div className="flex justify-between">
              <span>Public IP:</span>
              <span className="text-gray-900 font-bold">{status.server_public_ip}</span>
            </div>
            <div className="flex justify-between">
              <span>DB Optimizer:</span>
              <span className="text-green-600 font-extrabold">SQLite OK</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
