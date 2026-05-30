import React, { useState, useEffect } from 'react';
import { Search, Globe, ChevronRight, Check, SlidersHorizontal, RotateCcw, Radio, ShieldCheck, RefreshCw } from 'lucide-react';

interface TalkgroupItem {
  number: number;
  name: string;
  country: string;
  description: string;
  category: string;
  language: string;
  region: string;
}

interface TalkgroupDirectoryViewProps {
  isLoggedIn: boolean;
  username: string;
  onTuneSuccess: () => void;
}

export default function TalkgroupDirectoryView({ isLoggedIn, username, onTuneSuccess }: TalkgroupDirectoryViewProps) {
  const [talkgroups, setTalkgroups] = useState<TalkgroupItem[]>([]);
  const [search, setSearch] = useState("");
  const [filterRegion, setFilterRegion] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterLanguage, setFilterLanguage] = useState("");
  const [filterCountry, setFilterCountry] = useState("");
  const [currentTg, setCurrentTg] = useState<number | null>(null);
  const [tuningTg, setTuningTg] = useState<number | null>(null);
  const [successTg, setSuccessTg] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");

  // Auto-deduplicated filters from current list
  const [regions, setRegions] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [countries, setCountries] = useState<string[]>([]);

  // Fetch all talkgroups initially to gather dynamic distinct filters
  const fetchFilterMeta = async () => {
    try {
      const res = await fetch('/api/talkgroups');
      if (res.ok) {
        const data: TalkgroupItem[] = await res.json();
        const uniqueRegions = Array.from(new Set(data.map(item => item.region).filter(Boolean))).sort();
        const uniqueCategories = Array.from(new Set(data.map(item => item.category).filter(Boolean))).sort();
        const uniqueLanguages = Array.from(new Set(data.map(item => item.language).filter(Boolean))).sort();
        const uniqueCountries = Array.from(new Set(data.map(item => item.country).filter(Boolean))).sort();
        
        setRegions(uniqueRegions);
        setCategories(uniqueCategories);
        setLanguages(uniqueLanguages);
        setCountries(uniqueCountries);
      }
    } catch (e) {
      console.error("Failed to load filter metadata:", e);
    }
  };

  // Fetch current live status
  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        if (data && data.current_tg) {
          setCurrentTg(data.current_tg);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchFilteredTalkgroups = async () => {
    try {
      const queryParams = new URLSearchParams();
      if (search) queryParams.append('q', search);
      if (filterRegion) queryParams.append('region', filterRegion);
      if (filterCategory) queryParams.append('category', filterCategory);
      if (filterLanguage) queryParams.append('language', filterLanguage);
      if (filterCountry) queryParams.append('country', filterCountry);

      const res = await fetch(`/api/talkgroups?${queryParams.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTalkgroups(data);
      }
    } catch (e) {
      console.error("Failed fetching talkgroups:", e);
    }
  };

  useEffect(() => {
    fetchFilterMeta();
    fetchStatus();
    // Poll status index every 4 seconds to catch active TG changes live
    const interval = setInterval(fetchStatus, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchFilteredTalkgroups();
  }, [search, filterRegion, filterCategory, filterLanguage, filterCountry]);

  const handleTune = async (tgNum: number) => {
    if (!isLoggedIn) {
      alert("Verification Rejected: Please log in with Administrator credentials to tune the station transmitter.");
      return;
    }
    setTuningTg(tgNum);
    try {
      const res = await fetch('/api/talkgroup/tune', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tg: tgNum, username })
      });
      if (res.ok) {
        setSuccessTg(tgNum);
        setCurrentTg(tgNum);
        onTuneSuccess();
        setTimeout(() => setSuccessTg(null), 2500);
      } else {
        const errorData = await res.json().catch(() => ({}));
        alert(errorData.error || "Tuner exception: Station gateway authority control rejected the signal switch.");
      }
    } catch (e) {
      alert("Error contacting the digital tuner backend daemon.");
    } finally {
      setTuningTg(null);
    }
  };


  const handleSyncTalkgroups = async () => {
    if (!isLoggedIn) {
      alert("Please sign in with Operator or Administrator access to synchronize BrandMeister talkgroups.");
      return;
    }
    setSyncing(true);
    setSyncMessage("");
    try {
      const res = await fetch('/api/talkgroups/sync', { method: 'POST' });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'BrandMeister sync failed');
      setSyncMessage(`Synchronized ${payload.count} talkgroups from BrandMeister.`);
      await fetchFilterMeta();
      await fetchFilteredTalkgroups();
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : 'BrandMeister sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleResetFilters = () => {
    setSearch("");
    setFilterRegion("");
    setFilterCategory("");
    setFilterLanguage("");
    setFilterCountry("");
  };

  return (
    <div className="space-y-6">
      {/* Title & Status Summary */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-5">
        <div>
          <span className="text-[10px] bg-blue-500/10 text-blue-400 font-black px-2 py-0.5 rounded-md uppercase tracking-wider">
            Network Master Controller
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-white font-sans mt-1">
            Talkgroup Directory & Gateway Controls
          </h1>
          <p className="text-sm text-slate-400 mt-1 font-sans">
            Filter, search, and instantly change live transmissions. Connected to MMDVM dynamic router.
          </p>
        </div>

        {/* Live Indicator Pill Box */}
        <div className="flex flex-wrap gap-3">
          <div className="bg-slate-900 border border-slate-850 px-4 py-2.5 rounded-xl flex items-center gap-3">
            <div className="bg-blue-500/10 p-2 rounded-lg text-blue-400 flex items-center justify-center">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase">Current Hub TG</div>
              <div className="font-mono text-base font-bold text-slate-200">
                {currentTg ? `TG ${currentTg}` : "OFFLINE / DISCONNECTED"}
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-850 px-4 py-2.5 rounded-xl flex items-center gap-3">
            <div className={`p-2 rounded-lg flex items-center justify-center ${isLoggedIn ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-500'}`}>
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase">Authentication</div>
              <div className="text-xs font-bold text-slate-200 uppercase">
                {isLoggedIn ? `Admin (${username})` : 'READONLY (Observer)'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Filter Box */}
      <div className="bg-slate-900/60 border border-slate-850 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-300 font-bold">
            <SlidersHorizontal className="w-4 h-4 text-blue-400" />
            <h2>Multi-Column Advanced Filters</h2>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleSyncTalkgroups}
              disabled={syncing || !isLoggedIn}
              className="text-xs text-slate-300 hover:text-white transition flex items-center gap-1 bg-blue-600/20 hover:bg-blue-600/30 px-3 py-1.5 rounded-lg border border-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              Sync BrandMeister
            </button>
            <button 
              onClick={handleResetFilters}
              className="text-xs text-slate-400 hover:text-white transition flex items-center gap-1 bg-slate-800 hover:bg-slate-750 px-3 py-1.5 rounded-lg border border-slate-700/50 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Custom Filters
            </button>
          </div>
        </div>
        {syncMessage && <p className="text-xs text-slate-400">{syncMessage}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Region Location</label>
            <select
              value={filterRegion}
              onChange={(e) => setFilterRegion(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500 transition"
            >
              <option value="">All Regions</option>
              {regions.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Language Specific</label>
            <select
              value={filterLanguage}
              onChange={(e) => setFilterLanguage(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500 transition"
            >
              <option value="">All Languages</option>
              {languages.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Category Channel</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500 transition"
            >
              <option value="">All Categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Country Origin</label>
            <select
              value={filterCountry}
              onChange={(e) => setFilterCountry(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500 transition"
            >
              <option value="">All Countries</option>
              {countries.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Modern Search bar */}
      <div className="relative max-w-md w-full">
        <Search className="w-5 h-5 text-slate-500 absolute left-3.5 top-3" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Smart search by target number, description, name..."
          className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-11 pr-4 py-2.5 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 text-sm text-slate-100 placeholder-slate-500"
        />
      </div>

      {/* Grid distributions of available channels */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {talkgroups.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-slate-900/30 border border-slate-850 rounded-2xl">
            <SlidersHorizontal className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-slate-400 font-semibold text-sm">No synchronized talkgroups matched your filtering matrix.</p>
            <p className="text-xs text-slate-500 mt-1">Refine filters or click "Reset Custom Filters" above.</p>
          </div>
        ) : (
          talkgroups.map((tg) => {
            const isCurrentlyTuned = currentTg === tg.number;
            return (
              <div 
                key={tg.number} 
                className={`bg-slate-900 rounded-2xl border transition flex flex-col justify-between p-5 relative overflow-hidden ${isCurrentlyTuned ? 'border-emerald-500/30 shadow-lg shadow-emerald-500/5' : 'border-slate-800 hover:border-slate-700'}`}
              >
                {/* Visual Highlight top header for tuned channel */}
                {isCurrentlyTuned && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500"></div>
                )}

                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <span className="font-mono text-lg font-bold text-white bg-slate-950 px-3 py-1 rounded-xl border border-slate-800">
                      TG {tg.number}
                    </span>
                    <span className="text-[10px] bg-slate-950 text-blue-400 font-black border border-blue-500/10 px-2.5 py-1 rounded-md uppercase tracking-wider">
                      {tg.category}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="font-bold text-white font-sans tracking-tight text-base">{tg.name}</h3>
                    <p className="text-xs text-slate-400 font-sans leading-relaxed">{tg.description}</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-850 mt-5 flex items-center justify-between text-xs font-sans text-slate-400">
                  <div className="space-y-1 select-none">
                    <span className="flex items-center gap-1 text-[11px] text-slate-350 font-semibold">
                      <Globe className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      {tg.country}
                    </span>
                    <span className="text-[10px] text-slate-500 block font-mono">
                      {tg.region} / {tg.language}
                    </span>
                  </div>

                  {/* Active Tune Controls */}
                  {isCurrentlyTuned ? (
                    <div className="bg-emerald-500/10 text-emerald-400 font-bold px-3 py-2 rounded-xl inline-flex items-center gap-1 border border-emerald-500/20 select-none">
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      TUNED
                    </div>
                  ) : successTg === tg.number ? (
                    <button className="bg-emerald-500 text-white font-bold px-3 py-2 rounded-xl inline-flex items-center gap-1 shadow-sm" disabled>
                      <Check className="w-3.5 h-3.5 animate-bounce" />
                      SET SUCCESS
                    </button>
                  ) : (
                    <button
                      onClick={() => handleTune(tg.number)}
                      disabled={tuningTg !== null}
                      className={`px-3 py-2 rounded-xl font-bold transition flex items-center gap-1 border cursor-pointer ${
                        isLoggedIn 
                          ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600 shadow-sm shadow-blue-600/10'
                          : 'bg-slate-800 text-slate-500 border-slate-750 cursor-not-allowed hover:bg-slate-800'
                      }`}
                    >
                      {tuningTg === tg.number ? (
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block"></span>
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                      TUNE FREQ
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
