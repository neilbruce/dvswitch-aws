import React, { useState, useEffect } from 'react';
import { Power, RotateCw, Play, Square, Terminal, Eye, ShieldCheck } from 'lucide-react';

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

interface ServiceControlViewProps {
  isAdmin: boolean;
  username: string;
}

export default function ServiceControlView({ isAdmin, username }: ServiceControlViewProps) {
  const [terminalOutput, setTerminalOutput] = useState("");
  const [audits, setAudits] = useState<AuditRecord[]>([]);
  const [runningAction, setRunningAction] = useState<string | null>(null);

  const fetchAudits = async () => {
    try {
      const res = await fetch('/api/audits');
      if (res.ok) {
        const data = await res.json();
        setAudits(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchAudits();
    const interval = setInterval(fetchAudits, 5000);
    return () => clearInterval(interval);
  }, []);

  const triggerServiceAction = async (service: string, action: 'start' | 'stop' | 'restart') => {
    if (!isAdmin) {
      alert("Unauthorized: Administrator permissions are mandatory to invoke hardware kernel scripts.");
      return;
    }

    const itemKey = `${service}_${action}`;
    setRunningAction(itemKey);
    setTerminalOutput(`[root@dmr-ncs ~]# systemctl ${action} ${service} ...`);

    try {
      const res = await fetch('/api/services/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service, action, username })
      });
      if (res.ok) {
        const payload = await res.json();
        setTerminalOutput(payload.console_output || "Action succeeded.");
        fetchAudits();
      } else {
        const err = await res.json();
        setTerminalOutput(`[root@dmr-ncs ~]# FAILED\n\nERROR details: ${err.error}`);
      }
    } catch (e) {
      setTerminalOutput("[root@dmr-ncs ~]# network timeout connecting to kernel command-daemon.");
    } finally {
      setRunningAction(null);
    }
  };

  const triggerReboot = async () => {
    if (!isAdmin) {
      alert("Admin privileges are required.");
      return;
    }
    if (!confirm("Are you sure you want to trigger immediate reboot of the AWS EC2 Host system?")) return;

    setTerminalOutput("[root@dmr-ncs ~]# sudo reboot");
    try {
      const res = await fetch('/api/services/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: 'system_reboot', action: 'restart', username })
      });
      if (res.ok) {
        const payload = await res.json();
        setTerminalOutput(payload.console_output);
        fetchAudits();
      }
    } catch (err) {
      setTerminalOutput("[root@dmr-ncs ~]# Host reboot initiated successfully.");
    }
  };

  const service_cards = [
    { id: "analogBridge", name: "Analog_Bridge", desc: "Transcoding logic" },
    { id: "mmdvmBridge", name: "MMDVM_Bridge", desc: "DMR gateway core" },
    { id: "dvswitch", name: "DVSwitch Script", desc: "Tuner channel routers" },
    { id: "gunicorn", name: "Gunicorn WSGI", desc: "DMR NCS console server" },
    { id: "apache", name: "Apache Web", desc: "Let's Encrypt reverse proxy" }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-100 pb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 font-sans">
            Server Services & SSH Controls
          </h1>
          <p className="text-sm text-gray-500 mt-1 font-sans">
            Superuser Control deck. Restart MMDVM pipelines, restart systemd units, toggle decoders or trigger reboot sequences.
          </p>
        </div>

        {/* Global actions */}
        <button
          onClick={triggerReboot}
          className="bg-red-600 hover:bg-red-700 hover:shadow-md text-white font-bold text-xs py-2 px-4 rounded-xl transition cursor-pointer inline-flex items-center gap-1.5"
        >
          <Power className="w-3.5 h-3.5" />
          FORCE FULL SYSTEM REBOOT
        </button>
      </div>

      {/* Grid: Service actions cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {service_cards.map((s) => (
          <div key={s.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm flex flex-col justify-between space-y-4">
            <div className="space-y-1">
              <span className="font-bold font-sans text-gray-950 text-sm block">{s.name}</span>
              <span className="text-[10px] text-gray-400 block leading-tight">{s.desc}</span>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-3 gap-1 pt-2 border-t border-gray-50">
              <button
                onClick={() => triggerServiceAction(s.id, 'start')}
                disabled={runningAction !== null}
                className="p-2 hover:bg-gray-100 text-green-600 rounded flex justify-center transition cursor-pointer"
                title="Start service"
              >
                <Play className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => triggerServiceAction(s.id, 'stop')}
                disabled={runningAction !== null}
                className="p-2 hover:bg-gray-100 text-yellow-600 rounded flex justify-center transition cursor-pointer"
                title="Stop service"
              >
                <Square className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => triggerServiceAction(s.id, 'restart')}
                disabled={runningAction !== null}
                className="p-2 hover:bg-gray-100 text-indigo-600 rounded flex justify-center transition cursor-pointer"
                title="Restart service"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Grid: Output Console and Security audits logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Terminal console */}
        <div className="lg:col-span-2 bg-gray-950 border border-gray-850 rounded-2xl p-5 shadow-lg flex flex-col space-y-4">
          <div className="flex gap-2 items-center text-gray-500 border-b border-gray-900 pb-3">
            <Terminal className="w-4 h-4 text-gray-400" />
            <span className="font-mono text-xs text-gray-400 select-none">EC2 Root Operations Daemon Console</span>
          </div>

          <div className="font-mono text-xs text-green-400 whitespace-pre-wrap leading-relaxed min-h-[160px] select-all">
            {terminalOutput || "[NCS SSH DAEMON READY]\nSelect any systemd action card to override running services."}
          </div>
        </div>

        {/* Security Audit panel logs list */}
        <div className="lg:col-span-1 bg-white border border-gray-100 shadow-sm rounded-xl p-5 flex flex-col justify-between overflow-hidden">
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest block font-sans flex items-center gap-1">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              NCS Superuser Control Audits
            </h3>
            
            <div className="divide-y divide-gray-100 max-h-[150px] overflow-y-auto pr-1">
              {audits.map((a) => (
                <div key={a.id} className="py-2.5 text-xs">
                  <div className="flex justify-between items-center text-gray-900 font-bold">
                    <span className="text-indigo-600 font-mono text-[11px] font-extrabold">{a.action}</span>
                    <span className="text-[10px] text-gray-400 font-normal">{new Date(a.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div className="text-[10px] text-gray-500 font-sans mt-0.5 flex justify-between">
                    <span>Target: {a.target} | User: {a.user}</span>
                    <span className={a.status === 'success' ? 'text-green-600 font-bold' : 'text-red-500 font-bold'}>
                      {a.status.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
