import React, { useState, useEffect } from 'react';
import { Search, Terminal, Download, RefreshCw } from 'lucide-react';

export default function LogViewer() {
  const [logType, setLogType] = useState("mmdvm");
  const [logContent, setLogContent] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/logs?type=${logType}`);
      if (res.ok) {
        const text = await res.text();
        setLogContent(text);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [logType]);

  const handleDownload = () => {
    const blob = new Blob([logContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `dmr_ncs_${logType}_log.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Filter log lines on client side
  const filteredLines = logContent.split("\n").filter(line => 
    line.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-100 pb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 font-sans">
            System Log Analyzer
          </h1>
          <p className="text-sm text-gray-500 mt-1 font-sans">
            Live inspect diagnostic logs originating from Apache, systemd, and MMDVM_Bridge.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchLogs}
            className="p-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 rounded-xl transition cursor-pointer"
            title="Reload logs"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-xl text-xs font-semibold transition shadow-sm cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Download Log File
          </button>
        </div>
      </div>

      {/* Tabs list with search bar */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 border-b border-gray-100 pb-3">
        <div className="flex gap-1.5 w-full sm:w-auto overflow-x-auto whitespace-nowrap">
          <button
            onClick={() => setLogType("mmdvm")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              logType === "mmdvm"
                ? "bg-red-50 border border-red-200 text-red-600"
                : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            MMDVM Logs
          </button>
          <button
            onClick={() => setLogType("apache")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              logType === "apache"
                ? "bg-red-50 border border-red-200 text-red-600"
                : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            Apache VirtualHost
          </button>
          <button
            onClick={() => setLogType("system")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              logType === "system"
                ? "bg-red-50 border border-red-200 text-red-600"
                : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            Gunicorn Service
          </button>
        </div>

        <div className="relative w-full sm:max-w-xs">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search within logs..."
            className="w-full pl-9 pr-4 py-1.5 rounded-xl border border-gray-200 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-xs font-sans"
          />
        </div>
      </div>

      {/* UNIX-Term style terminal window code box */}
      <div className="bg-gray-950 rounded-2xl p-4 md:p-6 border border-gray-850 shadow-lg flex flex-col space-y-4">
        {/* Term header */}
        <div className="flex gap-1.5 items-center text-gray-500 border-b border-gray-900 pb-3">
          <Terminal className="w-4 h-4 text-gray-400" />
          <span className="font-mono text-xs select-none">root@dmr-ncs-east-1:/var/log/{logType === 'mmdvm' ? 'mmdvm' : logType === 'apache' ? 'apache2' : 'gunicorn'}</span>
        </div>

        {/* Live console */}
        <div className="font-mono text-xs text-green-400 leading-relaxed overflow-x-auto whitespace-pre min-h-[300px] max-h-[450px] overflow-y-auto pr-2 select-text">
          {loading ? (
            <p className="animate-pulse text-gray-500 text-center py-20">[SYSTEM] Buffering log data streams...</p>
          ) : filteredLines.length === 0 ? (
            <p className="text-gray-600 text-center py-20">[EMPTY] No diagnostics found matching search keyword.</p>
          ) : (
            filteredLines.map((line, i) => (
              <div key={i} className="py-0.5 hover:bg-gray-900/60 rounded">
                <span className="text-gray-500 select-none mr-2">{(i+1).toString().padStart(3, '0')} |</span>
                {line}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
