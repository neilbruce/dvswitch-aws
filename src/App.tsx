import React, { useState, useEffect } from 'react';
import Navigation from './components/Navigation';
import DashboardView from './components/DashboardView';
import TalkgroupDirectoryView from './components/TalkgroupDirectoryView';
import LiveHeardView from './components/LiveHeardView';
import TalkgroupMonitorView from './components/TalkgroupMonitorView';
import CheckInBoard from './components/CheckInBoard';
import NetControlView from './components/NetControlView';
import AnalyticsView from './components/AnalyticsView';
import AprsDashboard from './components/AprsDashboard';
import LogViewer from './components/LogViewer';
import ServiceControlView from './components/ServiceControlView';
import SetupExporterView from './components/SetupExporterView';
import { ShieldAlert, LogIn, Lock, User, Terminal, X } from 'lucide-react';

export default function App() {
  const [currentView, setCurrentView] = useState("dashboard");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState("anonymous");
  const [userRoles, setUserRoles] = useState<string[]>(["ReadOnly"]);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Sign In inputs state
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Sync session on load
  const syncSession = async () => {
    try {
      const res = await fetch('/api/auth/session');
      if (res.ok) {
        const data = await res.json();
        setIsLoggedIn(data.is_logged_in);
        setUsername(data.username);
        setUserRoles(data.roles);
      }
    } catch (e) {
      console.error("Session sync failed:", e);
    }
  };

  useEffect(() => {
    syncSession();
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError("");
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUser, password: loginPass })
      });
      if (res.ok) {
        const data = await res.json();
        setIsLoggedIn(true);
        setUsername(data.username);
        setUserRoles(data.roles);
        setShowLoginModal(false);
        setLoginUser("");
        setLoginPass("");
        setRefreshTrigger(prev => prev + 1);
        // Switch to Net management immediately on successful logins
        setCurrentView("netcontrol");
      } else {
        const err = await res.json();
        setLoginError(err.error || "Authentication failed. Validate credentials.");
      }
    } catch (err) {
      setLoginError("Error connecting to full-stack server backend.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        setIsLoggedIn(false);
        setUsername("anonymous");
        setUserRoles(["ReadOnly"]);
        setCurrentView("dashboard");
        setRefreshTrigger(prev => prev + 1);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleNewTune = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-between">
      {/* Upper Navigation Bar */}
      <Navigation
        currentView={currentView}
        onViewChange={setCurrentView}
        isLoggedIn={isLoggedIn}
        username={username}
        isAdminMode={userRoles.includes("Admin")}
        onToggleAdmin={() => setShowLoginModal(true)}
        onLogout={handleLogout}
      />

      {/* Main Page Layout Wrapper */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow">
        {currentView === "dashboard" && (
          <DashboardView onViewChange={setCurrentView} isLoggedIn={isLoggedIn} triggerRefresh={refreshTrigger} />
        )}
        {currentView === "directory" && (
          <TalkgroupDirectoryView isLoggedIn={isLoggedIn} username={username} onTuneSuccess={handleNewTune} />
        )}
        {currentView === "liveheard" && (
          <LiveHeardView />
        )}
        {currentView === "monitor" && (
          <TalkgroupMonitorView />
        )}
        {currentView === "checkinboard" && (
          <CheckInBoard />
        )}
        {currentView === "aprs" && (
          <AprsDashboard />
        )}
        
        {/* Secure Admin/Operators pages (Guarded via isLoggedIn flags) */}
        {isLoggedIn ? (
          <>
            {currentView === "netcontrol" && (
              <NetControlView isLoggedIn={isLoggedIn} username={username} />
            )}
            {currentView === "analytics" && (
              <AnalyticsView />
            )}
            {currentView === "logs" && (
              <LogViewer />
            )}
            {currentView === "services" && (
              <ServiceControlView isAdmin={userRoles.includes("Admin")} username={username} />
            )}
            {currentView === "exporter" && (
              <SetupExporterView />
            )}
          </>
        ) : (
          (currentView === "netcontrol" || currentView === "analytics" || currentView === "logs" || currentView === "services" || currentView === "exporter") && (
            <div className="bg-white border border-gray-200 rounded-2xl p-8 max-w-md mx-auto text-center space-y-4 shadow-sm my-12">
              <ShieldAlert className="w-10 h-10 text-red-500 mx-auto" />
              <h3 className="text-lg font-bold text-gray-950">Security Gate Block</h3>
              <p className="text-xs text-gray-500 leading-relaxed font-sans">
                You are currently viewing this terminal under ReadOnly guest authorization. Sign in to access manual controller tuners, automatic net sessions and server reboots.
              </p>
              <button
                onClick={() => setShowLoginModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2.5 px-6 rounded-lg transition"
              >
                Sign In Authorized Profile
              </button>
            </div>
          )
        )}
      </main>

      {/* Footer Area */}
      <footer className="bg-white border-t border-gray-100 py-5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center text-xs text-gray-400 font-mono gap-4">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            <span>DMR Network Control Station Console • AWS t3.medium</span>
          </div>
          <span>UTC Time: {new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC</span>
        </div>
      </footer>

      {/* SECURE ADMIN SIGN IN MODAL WINDOW */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm border border-gray-100 shadow-2xl p-6.5 space-y-5 relative">
            <button
              onClick={() => {
                setShowLoginModal(false);
                setLoginError("");
              }}
              className="absolute right-4 top-4 p-1.5 text-gray-400 hover:text-gray-900 rounded-lg transition hover:bg-gray-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1 text-center">
              <div className="bg-blue-50 text-blue-600 p-2.5 rounded-full inline-block">
                <Lock className="w-5 h-5 mx-auto" />
              </div>
              <h3 className="font-bold text-gray-950 text-base">Authorized Log In</h3>
              <p className="text-xs text-gray-500 font-sans leading-tight">
                Authenticating against security credentials.
              </p>
            </div>

            {loginError && (
              <div className="bg-red-50 border border-red-100 rounded-lg p-2.5 text-xs text-red-600 font-mono text-center">
                {loginError}
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                  Secure Username
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={loginUser}
                    onChange={(e) => setLoginUser(e.target.value)}
                    placeholder="Enter user name..."
                    className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                  Access Key Passphrase
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    value={loginPass}
                    onChange={(e) => setLoginPass(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2.5 rounded-lg transition flex items-center justify-center gap-1 cursor-pointer"
              >
                {loginLoading ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <>
                    <LogIn className="w-3.5 h-3.5" />
                    AUTHENTICATE
                  </>
                )}
              </button>
            </form>

            <div className="border-t border-gray-50 pt-3 text-[10px] text-gray-400 text-center font-mono">
              Use the administrator account created from <code className="font-bold text-gray-700">INITIAL_ADMIN_USERNAME</code> and <code className="font-bold text-gray-700">INITIAL_ADMIN_PASSWORD</code>.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
