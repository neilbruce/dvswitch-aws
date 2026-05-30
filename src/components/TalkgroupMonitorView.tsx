import React, { useState, useEffect } from 'react';
import { Radio, Search, Activity, Volume2, Globe } from 'lucide-react';

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

export default function TalkgroupMonitorView() {
  const [selectedTg, setSelectedTg] = useState<number>(91);
  const [stationsHeard, setStationsHeard] = useState<LiveHeardItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStationsOnTg = async () => {
    try {
      const res = await fetch(`/api/heard?tg=${selectedTg}`);
      if (res.ok) {
        const payload = await res.json();
        setStationsHeard(payload);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchStationsOnTg();
    
    // Live update routine every 3 seconds as requested
    const interval = setInterval(fetchStationsOnTg, 3000);
    return () => clearInterval(interval);
  }, [selectedTg]);

  const activeTgs = [
    { number: 91, label: "TG 91 - Worldwide" },
    { number: 404, label: "TG 404 - India National" },
    { number: 40480, label: "TG 40480 - India English" },
    { number: 3100, label: "TG 3100 - USA Bridge" },
    { number: 235, label: "TG 235 - United Kingdom" }
  ];

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-100 pb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 font-sans">
          Dedicated Talkgroup Traffic Monitor
        </h1>
        <p className="text-sm text-gray-500 mt-1 font-sans">
          Lock onto a single Talkgroup frequency channel and monitor incoming emissions and callsigns in real-time.
        </p>
      </div>

      {/* Select Monitor Frequency */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
        <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest block py-1">
          Select Listening Target:
        </label>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          {activeTgs.map((tg) => (
            <button
              key={tg.number}
              onClick={() => setSelectedTg(tg.number)}
              className={`px-3 py-2 rounded-xl text-xs font-bold font-mono tracking-tight transition cursor-pointer flex items-center gap-1.5 ${
                selectedTg === tg.number
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Volume2 className={`w-3.5 h-3.5 ${selectedTg === tg.number ? 'text-white' : 'text-gray-400'}`} />
              {tg.label}
            </button>
          ))}
        </div>
      </div>

      {/* HUD Active Signal Monitor */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Listing Grid */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full divide-y divide-gray-100 text-left">
                <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Callsign</th>
                    <th className="px-6 py-4">DMR ID</th>
                    <th className="px-6 py-4">Origin Country</th>
                    <th className="px-6 py-4">First Heard</th>
                    <th className="px-6 py-4">Last Emission</th>
                    <th className="px-6 py-4">TX Count</th>
                    <th className="px-6 py-4">Total Airtime</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs font-sans text-gray-700">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10 font-mono text-gray-400">
                        Connecting to radio gateway channel...
                      </td>
                    </tr>
                  ) : stationsHeard.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10 font-mono text-gray-400">
                        No active transmissions recorded yet on TG {selectedTg}. Listening on standby...
                      </td>
                    </tr>
                  ) : (
                    stationsHeard.map((record) => (
                      <tr key={record.id} className="hover:bg-gray-200 transition">
                        <td className="px-6 py-4 font-bold font-mono text-red-500 text-sm flex items-center gap-1.5">
                          <Radio className="w-3.5 h-3.5 animate-pulse text-red-500 shrink-0" />
                          {record.callsign}
                        </td>
                        <td className="px-6 py-4 font-mono text-gray-400">{record.dmrId}</td>
                        <td className="px-6 py-4 flex items-center gap-1">
                          <Globe className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          {record.country}
                        </td>
                        <td className="px-6 py-4 font-mono text-gray-500">
                          {new Date(record.firstHeard).toLocaleTimeString()}
                        </td>
                        <td className="px-6 py-4 font-mono text-gray-900 font-semibold">
                          {new Date(record.lastHeard).toLocaleTimeString()}
                        </td>
                        <td className="px-6 py-4 font-mono font-medium text-center">{record.txCount}</td>
                        <td className="px-6 py-4 font-mono text-gray-900 font-bold">{record.airtime}s</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Stats Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-gray-950 border border-gray-800 text-white rounded-2xl p-5 space-y-4 shadow-sm">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest block font-sans">
              Standby Telemetry
            </h3>
            
            <div className="space-y-4 font-mono text-xs text-gray-300">
              <div className="space-y-1">
                <span className="text-[10px] text-gray-500 uppercase block">Active Listeners</span>
                <span className="text-xl font-bold font-mono text-red-400">
                  {stationsHeard.length} Stations
                </span>
              </div>

              <div className="space-y-1 border-t border-gray-800 pt-3">
                <span className="text-[10px] text-gray-500 uppercase block">Current Lock</span>
                <span className="text-sm font-semibold block text-white">
                  Talkgroup {selectedTg}
                </span>
                <span className="text-[10px] text-indigo-400 block whitespace-pre-line leading-relaxed">
                  Analog_Bridge PCM: Active{'\n'}MMDVM Core IP: Port 50700
                </span>
              </div>

              <div className="space-y-1 border-t border-gray-800 pt-3">
                <span className="text-[10px] text-gray-500 uppercase block">Log Rotation</span>
                <span className="text-[10px] leading-relaxed text-gray-400 block">
                  Capturing data on /var/log/mmdvm/MMDVM_Bridge-*.log daily rotates every midnight automatically.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
