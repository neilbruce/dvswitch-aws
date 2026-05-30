import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, Compass, Radio, Heart, RefreshCw, Send } from 'lucide-react';

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

export default function AprsDashboard() {
  const [beacons, setBeacons] = useState<AprsItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAPRS = async () => {
    try {
      const res = await fetch('/api/aprs');
      if (res.ok) {
        const payload = await res.json();
        setBeacons(payload);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAPRS();
    const interval = setInterval(fetchAPRS, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-100 pb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 font-sans">
            APRS Telemetry & Compass
          </h1>
          <p className="text-sm text-gray-500 mt-1 font-sans">
            Track real-world mobile transceivers transmitting GPS telemetry packets over APRS.fi bridge channels.
          </p>
        </div>
        <button
          onClick={fetchAPRS}
          className="inline-flex items-center gap-1.5 bg-white hover:bg-gray-50 border border-gray-200 px-3.5 py-2 rounded-lg text-xs font-semibold text-gray-700 transition shadow-sm cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Poll APRS-IS Cache
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Visual Map / Compass Section */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col justify-between space-y-6">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest block font-sans">
            APRS Visual Routing Canvas
          </h3>
          
          {/* APRS HUD map grid */}
          <div className="bg-gray-950 rounded-xl h-72 border border-gray-800 relative overflow-hidden flex items-center justify-center">
            {/* Background scanner lines */}
            <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-40"></div>
            <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-gray-800/60"></div>
            <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-gray-800/60"></div>
            
            {/* Orbit scanning effect */}
            <div className="absolute h-48 w-48 rounded-full border border-red-500/10 animate-ping"></div>

            {/* Render beacons as visual coordinates */}
            {beacons.map((b, index) => {
              // Mathematical map coords relative to Bangalore VU3 location
              const xOffset = ((b.longitude - 77.5) * 400 + 130) % 250;
              const yOffset = ((13.5 - b.latitude) * 400 + 100) % 180;
              
              return (
                <div 
                  key={b.id} 
                  className="absolute cursor-pointer group"
                  style={{ left: `${xOffset + 20}px`, top: `${yOffset + 30}px` }}
                >
                  <div className="bg-red-500 p-1.5 rounded-full text-white hover:scale-125 transition relative shadow-lg">
                    <MapPin className="w-3 h-3" />
                    <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gray-900 border border-gray-800 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition z-10">
                      {b.callsign}
                    </span>
                  </div>
                </div>
              );
            })}

            <span className="absolute bottom-3 right-3 font-mono text-[9px] text-gray-500 bg-gray-900 border border-gray-800 px-2 py-0.5 rounded uppercase font-bold tracking-widest">
              NCS Reference Station (Lock)
            </span>
          </div>

          <div className="flex justify-between items-center text-xs font-mono text-gray-500">
            <span>Coordinate Frame: WGS-84</span>
            <span>Ground Speed Sensor Tracking: ACTIVE</span>
          </div>
        </div>

        {/* APRS Logs Table Panel */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 overflow-hidden flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest block font-sans">
              GPS Packets Queue
            </h3>
            
            <div className="divide-y divide-gray-100 max-h-[320px] overflow-y-auto pr-1">
              {loading ? (
                <p className="text-center font-mono text-xs text-gray-400 py-6">Loading GPS tracks...</p>
              ) : (
                beacons.map((b) => (
                  <div key={b.id} className="py-3 space-y-1.5">
                    <div className="flex justify-between items-center text-xs font-mono">
                      <span className="font-bold text-red-500 flex items-center gap-1 text-sm bg-red-50 px-2 py-0.5 rounded">
                        <Compass className="w-3.5 h-3.5 animate-spin-slow shrink-0" />
                        {b.callsign}
                      </span>
                      <span className="text-gray-400">{new Date(b.timestamp).toLocaleTimeString()}</span>
                    </div>

                    <div className="text-xs text-gray-600 font-sans leading-relaxed">
                      Lat: <code className="font-mono text-gray-900 text-[11px] font-semibold">{b.latitude.toFixed(4)}</code>, 
                      Lon: <code className="font-mono text-gray-900 text-[11px] font-semibold">{b.longitude.toFixed(4)}</code>{'\n'}
                      <div className="text-[10px] text-gray-400 mt-1 font-mono">
                        Altitude: {b.altitude}m | Speed: {b.speed}km/h | Compass: {b.heading}°
                      </div>
                    </div>

                    {b.comment && (
                      <span className="bg-gray-50 border border-gray-100 rounded px-2 py-1 block text-[10px] italic text-gray-500 font-sans max-w-full truncate">
                        "{b.comment}"
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
