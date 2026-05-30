import React from 'react';
import { 
  Radio, 
  Activity, 
  BookOpen, 
  Clock, 
  Sliders, 
  Shield, 
  LogOut, 
  LogIn,
  MapPin,
  FileText,
  TrendingUp,
  Projector,
  Settings
} from 'lucide-react';

interface NavigationProps {
  currentView: string;
  onViewChange: (view: string) => void;
  isAdminMode: boolean;
  onToggleAdmin: () => void;
  isLoggedIn: boolean;
  username: string;
  onLogout: () => void;
}

export default function Navigation({
  currentView,
  onViewChange,
  isAdminMode,
  onToggleAdmin,
  isLoggedIn,
  username,
  onLogout
}: NavigationProps) {
  
  // Navigation tabs definition
  const publicTabs = [
    { id: 'dashboard', name: 'Dashboard', icon: Activity },
    { id: 'directory', name: 'Talkgroup Directory', icon: BookOpen },
    { id: 'liveheard', name: 'Live Heard', icon: Clock },
    { id: 'monitor', name: 'TG Monitor', icon: Radio },
    { id: 'checkinboard', name: 'HUD Board', icon: Projector },
    { id: 'aprs', name: 'APRS Telemetry', icon: MapPin },
  ];

  const privateTabs = [
    { id: 'netcontrol', name: 'Net Management', icon: Sliders },
    { id: 'analytics', name: 'Station Analytics', icon: TrendingUp },
    { id: 'logs', name: 'System Logs', icon: FileText },
    { id: 'services', name: 'Service Control', icon: Shield },
    { id: 'exporter', name: 'Deployment Setup', icon: Settings },
  ];

  return (
    <nav className="bg-gray-900 text-white sticky top-0 z-40 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center gap-8">
            {/* Logo area */}
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => onViewChange('dashboard')}>
              <div className="bg-red-600 p-2 rounded-lg text-white animate-pulse">
                <Radio className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-lg tracking-tight font-sans">DMR NCS Platform</span>
                <span className="text-xs text-gray-400 block font-mono -mt-1">BrandMeister / DVSwitch</span>
              </div>
            </div>

            {/* Desktop Navigation Links */}
            <div className="hidden lg:flex space-x-1">
              {publicTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => onViewChange(tab.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition cursor-pointer ${
                      currentView === tab.id
                        ? 'bg-gray-800 text-white border-b-2 border-red-500 rounded-none'
                        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Secure Admin section switch */}
          <div className="flex items-center gap-4">
            {isLoggedIn && (
              <div className="hidden md:flex items-center gap-2 border-r border-gray-800 pr-4 mr-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-ping"></span>
                <span className="text-xs font-mono text-gray-400">
                  {username.toUpperCase()} [{username === 'admin' ? 'ADMIN' : 'OBSERVER'}]
                </span>
              </div>
            )}

            {/* Admin toggle tabs */}
            {isLoggedIn && (
              <div className="hidden lg:flex space-x-1 mr-4">
                {privateTabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => onViewChange(tab.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                        currentView === tab.id
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {tab.name}
                    </button>
                  );
                })}
              </div>
            )}

            {isLoggedIn ? (
              <button
                onClick={onLogout}
                className="inline-flex items-center gap-1.5 bg-gray-800 hover:bg-red-900 border border-gray-700 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer text-red-200"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            ) : (
              <button
                onClick={onToggleAdmin}
                className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 hover:shadow-lg text-white px-4 py-2 rounded-lg text-xs font-bold tracking-wider transition cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                ADMIN LOGIN
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Links Row (Horizontal scrolling on small screens to keep layout incredibly usable) */}
      <div className="flex lg:hidden overflow-x-auto bg-gray-950 px-2 py-1.5 border-t border-gray-800 whitespace-nowrap scrollbar-none">
        <div className="flex space-x-1.5 mx-auto">
          {publicTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => onViewChange(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
                  currentView === tab.id
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-400 hover:bg-gray-900 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.name}
              </button>
            );
          })}
          {isLoggedIn && privateTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => onViewChange(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                  currentView === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-blue-400 hover:bg-gray-900 hover:text-blue-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.name}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
