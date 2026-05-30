import React, { useState, useEffect } from 'react';
import { Download, Play, Square, Pause, RotateCw, Trash2, Send, CheckCircle, Clock } from 'lucide-react';

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

interface NetControlViewProps {
  isLoggedIn: boolean;
  username: string;
}

export default function NetControlView({ isLoggedIn, username }: NetControlViewProps) {
  const [net, setNet] = useState<NetSession | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Custom form state for manual checkin
  const [callsign, setCallsign] = useState("");
  const [dmrId, setDmrId] = useState("");
  const [country, setCountry] = useState("India");
  const [sigReport, setSigReport] = useState("59");

  // Custom Net parameters to boot new net
  const [bootTg, setBootTg] = useState(91);
  const [bootName, setBootName] = useState("");

  const fetchNetDetails = async () => {
    try {
      const res = await fetch('/api/net/checkins');
      if (res.ok) {
        const data = await res.json();
        setNet(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNetDetails();
    const interval = setInterval(fetchNetDetails, 3000); // 3 seconds live update requested
    return () => clearInterval(interval);
  }, []);

  const handleAction = async (action: 'start' | 'stop' | 'pause' | 'resume') => {
    try {
      const body: Record<string, any> = { action, username };
      if (action === 'start') {
        body.tg = bootTg;
        body.name = bootName || `Tactical Net TG${bootTg}`;
      }
      const res = await fetch('/api/net/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        setBootName("");
        fetchNetDetails();
      } else {
        const err = await res.json();
        alert(err.error || "Action rejected by NCS controller.");
      }
    } catch (e) {
      alert("Error contacting Gunicorn background backend.");
    }
  };

  const handleManualCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!callsign) {
      alert("Callsign is required.");
      return;
    }
    try {
      const res = await fetch('/api/checkins/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callsign,
          dmrId,
          country,
          signalReport: sigReport
        })
      });
      if (res.ok) {
        setCallsign("");
        setDmrId("");
        setCountry("India");
        setSigReport("59");
        fetchNetDetails();
      } else {
        const err = await res.json();
        alert(err.error || "Checkin rejected.");
      }
    } catch (err) {
      alert("Error adding manual checkin.");
    }
  };

  const toggleValidate = async (number: number) => {
    if (!net) return;
    try {
      const res = await fetch('/api/checkins/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number, net_id: net.net_id })
      });
      if (res.ok) {
        fetchNetDetails();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const deleteCheckIn = async (number: number) => {
    if (!confirm("Are you sure you want to remove this station checkin?")) return;
    if (!net) return;
    try {
      const res = await fetch('/api/checkins/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number, net_id: net.net_id })
      });
      if (res.ok) {
        fetchNetDetails();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleExport = (format: 'adif' | 'csv') => {
    if (!net) return;
    window.open(`/api/exports/${format}?net_id=${net.net_id}`, '_blank');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center font-mono py-10 text-gray-500">
        Connecting to Gunicorn Net Scheduler...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-100 pb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 font-sans">
          Worldwide Net Control Center
        </h1>
        <p className="text-sm text-gray-500 mt-1 font-sans">
          Admin portal. Configure tactical NCS Net Checkins, validate logs and generate automated logs of Saturday Nets.
        </p>
      </div>

      {net && (net.status === 'active' || net.status === 'paused') ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active Net Controls / Logging panel */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-150 p-6 space-y-6 shadow-sm">
            <div className="flex justify-between items-center pb-4 border-b border-gray-100">
              <div className="space-y-1">
                <span className="bg-red-50 text-red-600 font-bold border border-red-200 rounded px-2 py-0.5 text-[10px] uppercase font-mono tracking-wider">
                  {net.status} Operations
                </span>
                <h3 className="font-bold text-gray-900 tracking-tight text-lg">{net.net_name}</h3>
                <p className="text-xs text-gray-500 font-mono">Tuned: Talkgroup {net.talkgroup}</p>
              </div>

              {/* Action overriding command switches */}
              <div className="flex gap-2">
                {net.status === 'active' ? (
                  <button
                    onClick={() => handleAction('pause')}
                    className="p-2.5 bg-yellow-50 hover:bg-yellow-100 rounded-lg text-yellow-700 transition cursor-pointer"
                    title="Pause Net log collection"
                  >
                    <Pause className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={() => handleAction('resume')}
                    className="p-2.5 bg-green-50 hover:bg-green-100 rounded-lg text-green-700 transition cursor-pointer"
                    title="Resume Net log collection"
                  >
                    <Play className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => handleAction('stop')}
                  className="p-2.5 bg-red-50 hover:bg-red-100 border border-red-150 rounded-lg text-red-600 transition cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                  title="Terminate Net and generate reports"
                >
                  <Square className="w-4 h-4" />
                  CLOSE NET
                </button>
              </div>
            </div>

            {/* Checkin Registry of active participants */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest font-sans">
                  Active NCS Log Register ({net.checkins.length})
                </h4>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => handleExport('csv')}
                    className="text-xs bg-white border border-gray-200 text-gray-700 px-2.5 py-1.5 rounded-lg font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3 h-3" />
                    CSV
                  </button>
                  <button
                    onClick={() => handleExport('adif')}
                    className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1.5 rounded-lg font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3 h-3" />
                    ADIF
                  </button>
                </div>
              </div>

              <div className="border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-y-auto max-h-[300px]">
                  <table className="w-full text-left divide-y divide-gray-100">
                    <thead className="bg-gray-50 text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3 text-center">No</th>
                        <th className="px-4 py-3">Callsign</th>
                        <th className="px-4 py-3">Origin</th>
                        <th className="px-4 py-3">Signal</th>
                        <th className="px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-xs font-mono text-gray-700">
                      {net.checkins.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-8 text-gray-400">
                            Listening for digital transmissions on TG {net.talkgroup}... Add manual records below.
                          </td>
                        </tr>
                      ) : (
                        net.checkins.map((c) => (
                          <tr key={c.number} className={`hover:bg-gray-50 transition ${!c.validated ? 'opacity-50' : ''}`}>
                            <td className="px-4 py-3 text-center font-bold text-gray-900">{c.number}</td>
                            <td className="px-4 py-3 font-black text-sm text-blue-900">{c.callsign}</td>
                            <td className="px-4 py-3 text-gray-500 font-sans">{c.country}</td>
                            <td className="px-4 py-3 font-bold">{c.signalReport || '59'}</td>
                            <td className="px-4 py-3 flex gap-1 items-center">
                              <button
                                onClick={() => toggleValidate(c.number)}
                                className={`p-1 rounded cursor-pointer ${c.validated ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
                                title={c.validated ? 'Revoke validation report' : 'Mark as active validation'}
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => deleteCheckIn(c.number)}
                                className="p-1 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                                title="Purge station checkin"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Manual Checkin Registry Form */}
          <div className="lg:col-span-1 bg-white rounded-2xl border border-gray-150 p-6 space-y-5 shadow-sm">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest block font-sans">
              Tactical NCS Checkin Logger
            </h3>
            <form onSubmit={handleManualCheckIn} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                  Station Callsign
                </label>
                <input
                  type="text"
                  required
                  value={callsign}
                  onChange={(e) => setCallsign(e.target.value.toUpperCase())}
                  placeholder="e.g. VU3EFZ"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold font-mono uppercase focus:border-blue-500 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                  DMR ID (Gateway)
                </label>
                <input
                  type="text"
                  value={dmrId}
                  onChange={(e) => setDmrId(e.target.value)}
                  placeholder="e.g. 4040444"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono focus:border-blue-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                    Origin Country
                  </label>
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:border-blue-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                    Sig Report
                  </label>
                  <select
                    value={sigReport}
                    onChange={(e) => setSigReport(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold font-mono focus:border-blue-500 outline-none"
                  >
                    <option value="59">59 (Excellent)</option>
                    <option value="57">57 (Good)</option>
                    <option value="55">55 (Fair)</option>
                    <option value="51">51 (Weak)</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2.5 rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                LOG CHECK-IN
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-150 p-8 max-w-xl mx-auto space-y-6 shadow-sm">
          <div className="text-center space-y-2">
            <div className="bg-red-50 p-4 rounded-full text-red-500 inline-block">
              <Clock className="w-8 h-8 animate-pulse" />
            </div>
            <h3 className="font-bold text-gray-950 text-lg">No Active Net Session Located</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto leading-relaxed">
              Log entries are only validated when a tactical Net is manually initialized or on scheduled Saturday 21:30 triggers. Configure a brand new net profile below:
            </p>
          </div>

          <div className="border-t border-gray-50 pt-5 space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                Net Title / Mission Label
              </label>
              <input
                type="text"
                placeholder="e.g. BrandMeister Saturday TG91 Net"
                value={bootName}
                onChange={(e) => setBootName(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-3 text-xs font-bold focus:border-blue-500 outline-none shadow-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                Target Frequency (Talkgroup)
              </label>
              <select
                value={bootTg}
                onChange={(e) => setBootTg(parseInt(e.target.value))}
                className="w-full border border-gray-200 rounded-lg px-3 py-3 text-xs font-black font-mono focus:border-blue-500 outline-none shadow-sm"
              >
                <option value="91">Talkgroup 91 (Worldwide International)</option>
                <option value="404">Talkgroup 404 (India National Net)</option>
                <option value="40480">Talkgroup 40480 (India English Net)</option>
                <option value="3100">Talkgroup 3100 (USA Nationwide)</option>
              </select>
            </div>

            <button
              onClick={() => handleAction('start')}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-3 rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer font-sans"
            >
              <Play className="w-4 h-4 shrink-0" />
              BOOT TARGET NETWORK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
