import React, { useState, useEffect } from 'react';
import { Download, Search, Table, RefreshCw, Radio, Globe, Shield } from 'lucide-react';

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

export default function LiveHeardView() {
  const [data, setData] = useState<LiveHeardItem[]>([]);
  const [search, setSearch] = useState("");
  const [tgFilter, setTgFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchHeard = async () => {
    try {
      const tgParam = tgFilter ? `&tg=${tgFilter}` : '';
      const res = await fetch(`/api/heard?search=${encodeURIComponent(search)}${tgParam}`);
      if (res.ok) {
        const payload = await res.json();
        setData(payload);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHeard();
    // Live update interval
    const intv = setInterval(fetchHeard, 4000);
    return () => clearInterval(intv);
  }, [search, tgFilter]);

  const triggerExport = (format: 'adif' | 'csv') => {
    window.open(`/api/exports/${format}`, '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-100 pb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 font-sans">
            Live Heard Gateway Monitor
          </h1>
          <p className="text-sm text-gray-500 mt-1 font-sans">
            Real-time live logs of amateur radio stations transmitting through this Brandmeister node.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => triggerExport('csv')}
            className="inline-flex items-center gap-1.5 bg-white hover:bg-gray-50 border border-gray-200 px-3.5 py-2 rounded-lg text-xs font-semibold text-gray-700 transition shadow-sm cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            CSV Export
          </button>
          <button
            onClick={() => triggerExport('adif')}
            className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold transition shadow-sm cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            ADIF Log Export
          </button>
        </div>
      </div>

      {/* Filter and search utilities Row */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative max-w-xs w-full">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search callsign, dmr id..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-xs font-sans"
          />
        </div>

        <div className="flex gap-2 items-center w-full sm:w-auto">
          <select
            value={tgFilter}
            onChange={(e) => setTgFilter(e.target.value)}
            className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-sans font-medium outline-none focus:border-blue-500"
          >
            <option value="">All Talkgroups</option>
            <option value="91">Talkgroup 91</option>
            <option value="404">Talkgroup 404</option>
            <option value="40480">Talkgroup 40480</option>
            <option value="3100">Talkgroup 3100</option>
          </select>
          <button
            onClick={fetchHeard}
            className="bg-white hover:bg-gray-50 border border-gray-200 p-2 rounded-xl transition cursor-pointer"
            title="Refresh logs"
          >
            <RefreshCw className="w-3.5 h-3.5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Table grid layout container */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full divide-y divide-gray-100 text-left">
            <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Callsign</th>
                <th className="px-6 py-4">DMR ID</th>
                <th className="px-6 py-4">Country</th>
                <th className="px-6 py-4">Talkgroup</th>
                <th className="px-6 py-4">Last Emission</th>
                <th className="px-6 py-4">TX Count</th>
                <th className="px-6 py-4">Duration</th>
                <th className="px-6 py-4">Participation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs font-sans text-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 font-mono text-gray-400">
                    Loading telemetry entries...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 font-mono text-gray-400">
                    No matching transmission packets detected.
                  </td>
                </tr>
              ) : (
                data.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-200 transition">
                    <td className="px-6 py-4 font-bold font-mono text-gray-900 text-sm flex items-center gap-1.5">
                      <Radio className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      {row.callsign}
                    </td>
                    <td className="px-6 py-4 font-mono text-gray-500">{row.dmrId}</td>
                    <td className="px-6 py-4 flex items-center gap-1 shrink-0 py-4 max-w-[150px] truncate">
                      <Globe className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      {row.country}
                    </td>
                    <td className="px-6 py-4 font-mono">
                      <span className="bg-gray-100 font-bold px-2 py-0.5 rounded border border-gray-200">
                        TG {row.talkgroup}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-gray-500">
                      {new Date(row.lastHeard).toLocaleTimeString()}
                    </td>
                    <td className="px-6 py-4 font-mono text-center font-semibold">{row.txCount}</td>
                    <td className="px-6 py-4 font-mono font-medium text-gray-900">
                      {row.airtime}s
                    </td>
                    <td className="px-6 py-4">
                      {row.netParticipation ? (
                        <span className="bg-red-50 text-red-600 border border-red-200 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                          CHECKED IN
                        </span>
                      ) : (
                        <span className="text-gray-400 text-[10px] uppercase font-mono">
                          Standard TX
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
