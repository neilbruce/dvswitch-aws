import React, { useState, useEffect } from 'react';
import { Projector, Users, Globe, Play, Maximize2 } from 'lucide-react';

interface CheckIn {
  number: number;
  callsign: string;
  country: string;
  dmrId: string;
  timestamp: string;
  signalReport?: string;
  validated: boolean;
}

interface NetSession {
  net_id: string;
  net_name: string;
  status: 'active' | 'paused' | 'stopped' | 'scheduled';
  talkgroup: number;
  checkins: CheckIn[];
}

export default function CheckInBoard() {
  const [net, setNet] = useState<NetSession | null>(null);

  const fetchBoard = async () => {
    try {
      const res = await fetch('/api/net/checkins');
      if (res.ok) {
        const data = await res.json();
        setNet(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchBoard();
    const interval = setInterval(fetchBoard, 3000);
    return () => clearInterval(interval);
  }, []);

  const validCheckins = net ? net.checkins.filter(c => c.validated) : [];
  const uniqueCountries = Array.from(new Set(validCheckins.map(c => c.country))).length;

  return (
    <div className="bg-gray-950 text-white min-h-[500px] rounded-2xl p-6 md:p-8 space-y-8 flex flex-col justify-between border border-gray-800">
      {/* Header section with projection details */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-800 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping inline-block"></span>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest font-mono">
              Live NCS Projector HUD
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight font-sans text-white">
            {net ? net.net_name : "Waiting For Active Net Session"}
          </h1>
          <p className="text-xs text-gray-400 font-mono">
            Gateway frequency path: <strong className="text-red-400">Talkgroup {net ? net.talkgroup : 91}</strong>
          </p>
        </div>

        {/* Big numbers row */}
        <div className="flex gap-4 items-center w-full md:w-auto">
          <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-3 text-center grow md:grow-0 min-w-[110px]">
            <span className="font-mono text-3xl font-black text-red-500 block">
              {validCheckins.length}
            </span>
            <span className="text-[9px] text-gray-400 uppercase tracking-widest font-sans font-bold">Check-ins</span>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-3 text-center grow md:grow-0 min-w-[110px]">
            <span className="font-mono text-3xl font-black text-blue-400 block">
              {uniqueCountries}
            </span>
            <span className="text-[9px] text-gray-400 uppercase tracking-widest font-sans font-bold">Countries</span>
          </div>
        </div>
      </div>

      {/* Projection Area GRID */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 py-2 flex-grow overflow-y-auto max-h-[350px]">
        {validCheckins.length === 0 ? (
          <div className="col-span-full font-mono text-xs text-gray-500 text-center py-20">
            No active validated checkins. Standby on frequency ...
          </div>
        ) : (
          validCheckins.map((c) => (
            <div 
              key={c.number}
              className="bg-gray-900 border border-gray-850 rounded-xl p-4 flex flex-col justify-between items-center text-center hover:border-red-500 transition shadow-sm animate-fade-in gap-3"
            >
              <span className="bg-gray-950 font-mono text-[10px] font-bold text-gray-500 border border-gray-800 h-5 w-5 rounded-full flex items-center justify-center">
                {c.number}
              </span>
              <span className="text-xl font-black font-mono tracking-wider text-red-400">
                {c.callsign}
              </span>
              <div className="space-y-0.5">
                <span className="text-[10px] font-medium text-gray-300 font-sans block truncate max-w-[100px]">
                  {c.country}
                </span>
                <span className="text-[9px] font-mono text-gray-500 block">Report: {c.signalReport || '59'}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Info Footnote */}
      <div className="border-t border-gray-850 pt-5 flex justify-between items-center text-[10px] font-mono text-gray-600">
        <span>© DMR Network Control Station Projector</span>
        <span className="flex items-center gap-1">
          <Projector className="w-3.5 h-3.5" />
          Optimized for projector resolution tracking.
        </span>
      </div>
    </div>
  );
}
