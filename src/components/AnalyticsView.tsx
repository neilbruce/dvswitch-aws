import React, { useState, useEffect } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  LineChart, 
  Line 
} from 'recharts';
import { TrendingUp, Users, Radio, Globe, Award } from 'lucide-react';

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

export default function AnalyticsView() {
  const [stations, setStations] = useState<StationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStations = async () => {
      try {
        const res = await fetch('/api/stations');
        if (res.ok) {
          const data = await res.json();
          setStations(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStations();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center font-mono py-10 text-gray-500">
        Assembling analytics matrices...
      </div>
    );
  }

  // Analytics Computation Row
  // 1. Airtime by Station
  const sortedByAirtime = [...stations]
    .sort((a, b) => b.totalAirtime - a.totalAirtime)
    .slice(0, 5)
    .map(s => ({
      name: s.callsign,
      airtime_minutes: Math.ceil(s.totalAirtime / 60),
      transmissions: s.totalTx
    }));

  // 2. Transmissions by Country
  const countryCounts: Record<string, number> = {};
  stations.forEach(s => {
    countryCounts[s.country] = (countryCounts[s.country] || 0) + s.totalTx;
  });
  
  const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#6366f1', '#8b5cf6'];
  const countryData = Object.entries(countryCounts).map(([key, val]) => ({
    name: key,
    value: val
  })).sort((a, b) => b.value - a.value).slice(0, 5);

  // 3. Simulated Hourly Volume Chart
  const hourlyData = [
    { hour: "00:00", transmissions: 420 },
    { hour: "04:00", transmissions: 180 },
    { hour: "08:00", transmissions: 650 },
    { hour: "12:00", transmissions: 1200 },
    { hour: "16:00", transmissions: 840 },
    { hour: "20:00", transmissions: 1540 },
  ];

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-100 pb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 font-sans">
          Station Activity Analytics
        </h1>
        <p className="text-sm text-gray-500 mt-1 font-sans">
          Historical trends, country participation charts and transmitter metrics parsed from logs.
        </p>
      </div>

      {/* Aggregate Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Metric 1 */}
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="bg-blue-50 p-3 rounded-lg text-blue-600">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-400 block font-sans">Tracked Operators</span>
            <span className="text-2xl font-bold font-mono text-gray-900 block">{stations.length}</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="bg-red-50 p-3 rounded-lg text-red-600">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-400 block font-sans">Active Airtime</span>
            <span className="text-2xl font-bold font-mono text-gray-900 block">
              {Math.ceil(stations.reduce((acc, current) => acc + current.totalAirtime, 0) / 60)}m
            </span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="bg-green-50 p-3 rounded-lg text-green-600">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-400 block font-sans">Participating Nations</span>
            <span className="text-2xl font-bold font-mono text-gray-900 block">
              {Array.from(new Set(stations.map(s => s.country))).length}
            </span>
          </div>
        </div>
      </div>

      {/* Recharts graphs panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Graph 1: Top stations by airtime */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm space-y-4">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest block font-sans flex items-center gap-1.5">
            <Award className="w-4 h-4 text-red-500" />
            Top 5 Operators by Airtime (Minutes)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sortedByAirtime}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="name" stroke="#9ca3af" fontSize={11} fontStyle="font-mono" />
                <YAxis stroke="#9ca3af" fontSize={11} />
                <Tooltip />
                <Bar dataKey="airtime_minutes" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Graph 2: Country Distribution */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm space-y-4">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest block font-sans flex items-center gap-1.5">
            <Globe className="w-4 h-4 text-emerald-500" />
            Country Participation (TX Counts)
          </h3>
          <div className="h-64 flex flex-col sm:flex-row items-center justify-around gap-4">
            <div className="h-full w-full sm:w-1/2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={countryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {countryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            {/* Color indicators */}
            <div className="space-y-1.5 text-xs">
              {countryData.map((d, index) => (
                <div key={d.name} className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                  <span className="font-medium text-gray-700">{d.name}:</span>
                  <span className="font-bold text-gray-900 font-mono">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Graph 3: Simulated Activity peaks */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm space-y-4 lg:col-span-2">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest block font-sans flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-indigo-500" />
            Hourly Volume Traffic Pattern (Transmissions)
          </h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="hour" stroke="#9ca3af" fontSize={11} />
                <YAxis stroke="#9ca3af" fontSize={11} />
                <Tooltip />
                <Line type="monotone" dataKey="transmissions" stroke="#ef4444" strokeWidth={3} dot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
