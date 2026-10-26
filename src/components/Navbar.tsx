import React, { useState, useEffect } from 'react';
import { User, NotificationItem, UserRole } from '../types';
import { api } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import {
  ShieldAlert,
  Compass,
  Briefcase,
  Layers,
  Bell,
  ChevronDown,
  LogOut,
  HelpCircle,
  FileText,
  Sun,
  Moon,
  Sparkles,
  User as UserIcon,
  CheckCircle2,
  LogIn,
} from 'lucide-react';

interface NavbarProps {
  currentUser: User | null;
  onUserChange: (user: User | null) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeQueueCount: number;
  onOpenPolicies: (policy: 'terms' | 'refund' | 'privacy' | 'faq') => void;
  onOpenQueueTracker: () => void;
  hasActiveQueue: boolean;
  onOpenAuth: (mode?: 'signin' | 'register') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  onUserChange,
  activeTab,
  setActiveTab,
  activeQueueCount,
  onOpenPolicies,
  onOpenQueueTracker,
  hasActiveQueue,
  onOpenAuth,
}) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    if (currentUser) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 10000);
      return () => clearInterval(interval);
    } else {
      setNotifications([]);
    }
  }, [currentUser?.id]);

  const fetchNotifications = async () => {
    try {
      const res = await api.getNotifications();
      setNotifications(res.notifications || []);
    } catch {
      // ignore
    }
  };

  const handleRoleSwitch = async (role: UserRole) => {
    try {
      const res = await api.switchRole(role);
      onUserChange(res.user);
      if (role === 'CANDIDATE') setActiveTab('candidate-dashboard');
      else if (role === 'INTERVIEWER') setActiveTab('interviewer-dashboard');
      else if (role === 'ADMIN') setActiveTab('admin-dashboard');
      setShowUserMenu(false);
    } catch (err: any) {
      console.error('Role switch failed:', err.message);
    }
  };

  const handleSignOut = async () => {
    try {
      await api.logout();
    } finally {
      onUserChange(null);
      setActiveTab('catalog');
      setShowUserMenu(false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleMarkAllRead = async () => {
    await api.markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  return (
    <header className={`sticky top-0 z-40 backdrop-blur border-b transition-colors ${
      theme === 'light'
        ? 'bg-white/95 border-slate-200 text-slate-900 shadow-xs'
        : 'bg-slate-900/95 border-slate-800 text-slate-100'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <div className="flex items-center space-x-6">
          <button
            onClick={() => {
              if (currentUser) {
                if (currentUser.activeRole === 'ADMIN') setActiveTab('admin-dashboard');
                else if (currentUser.activeRole === 'INTERVIEWER') setActiveTab('interviewer-dashboard');
                else setActiveTab('candidate-dashboard');
              } else {
                setActiveTab('catalog');
              }
            }}
            className="flex items-center space-x-3 text-left focus:outline-none cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-amber-500 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
              IA
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className={`font-extrabold text-lg tracking-tight ${
                  theme === 'light'
                    ? 'text-slate-900'
                    : 'bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent'
                }`}>
                  Interview Arena
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  LIVE
                </span>
              </div>
              <p className={`text-[11px] hidden sm:block ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                Tier-based Mock Interviews • Real Matchmaking
              </p>
            </div>
          </button>

          {/* Role-Guarded Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1">
            {/* Always visible: Catalog */}
            <button
              onClick={() => setActiveTab('catalog')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition cursor-pointer ${
                activeTab === 'catalog'
                  ? theme === 'light'
                    ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-xs'
                    : 'bg-slate-800 text-indigo-400'
                  : theme === 'light'
                  ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <span className="flex items-center space-x-1.5">
                <Layers className="w-4 h-4" />
                <span>Interview Tracks</span>
              </span>
            </button>

            {/* Candidate Dashboard: Only when logged in as Candidate or Admin */}
            {currentUser && (currentUser.activeRole === 'CANDIDATE' || currentUser.roles.includes('CANDIDATE')) && (
              <button
                onClick={() => setActiveTab('candidate-dashboard')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition cursor-pointer ${
                  activeTab === 'candidate-dashboard'
                    ? theme === 'light'
                      ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-xs'
                      : 'bg-slate-800 text-indigo-400'
                    : theme === 'light'
                    ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <span className="flex items-center space-x-1.5">
                  <Compass className="w-4 h-4" />
                  <span>Candidate Arena</span>
                </span>
              </button>
            )}

            {/* Interviewer Dashboard: Only when logged in as Interviewer or Admin */}
            {currentUser && (currentUser.activeRole === 'INTERVIEWER' || currentUser.roles.includes('INTERVIEWER')) && (
              <button
                onClick={() => setActiveTab('interviewer-dashboard')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition cursor-pointer ${
                  activeTab === 'interviewer-dashboard'
                    ? theme === 'light'
                      ? 'bg-amber-50 text-amber-800 font-semibold shadow-xs'
                      : 'bg-slate-800 text-amber-400'
                    : theme === 'light'
                    ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <span className="flex items-center space-x-1.5">
                  <Briefcase className="w-4 h-4" />
                  <span>Interviewer Portal</span>
                </span>
              </button>
            )}

            {/* Admin Panel: STRICTLY for users with ADMIN role */}
            {currentUser && currentUser.roles.includes('ADMIN') && (
              <button
                onClick={() => setActiveTab('admin-dashboard')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition cursor-pointer ${
                  activeTab === 'admin-dashboard'
                    ? theme === 'light'
                      ? 'bg-rose-50 text-rose-700 font-semibold shadow-xs'
                      : 'bg-slate-800 text-rose-400'
                    : theme === 'light'
                    ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <span className="flex items-center space-x-1.5">
                  <ShieldAlert className="w-4 h-4 text-rose-500" />
                  <span className="font-bold">Admin Panel</span>
                </span>
              </button>
            )}
          </nav>
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center space-x-3">
          {/* Active Queue Tracker Pill (if in queue) */}
          {hasActiveQueue ? (
            <button
              onClick={onOpenQueueTracker}
              className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 text-xs font-semibold animate-pulse transition cursor-pointer"
            >
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>You are in Queue</span>
            </button>
          ) : activeQueueCount > 0 && currentUser?.roles.includes('INTERVIEWER') ? (
            <div className="hidden lg:flex items-center space-x-2 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
              <span>{activeQueueCount} in Queue</span>
            </div>
          ) : null}

          {/* Theme Toggle (Light / Dark) */}
          <button
            onClick={toggleTheme}
            className={`p-2 rounded-xl transition cursor-pointer ${
              theme === 'light'
                ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} theme`}
          >
            {theme === 'dark' ? (
              <Sun className="w-5 h-5 text-amber-400" />
            ) : (
              <Moon className="w-5 h-5 text-indigo-600" />
            )}
          </button>

          {/* Notifications Bell (Only when logged in) */}
          {currentUser && (
            <div className="relative">
              <button
                onClick={() => setShowNotifMenu(!showNotifMenu)}
                className={`relative p-2 rounded-xl transition cursor-pointer ${
                  theme === 'light'
                    ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
                title="Notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500" />
                )}
              </button>

              {showNotifMenu && (
                <div className={`absolute right-0 mt-2 w-80 rounded-2xl shadow-2xl border py-2 z-50 ${
                  theme === 'light'
                    ? 'bg-white border-slate-200 text-slate-900 shadow-slate-200/50'
                    : 'bg-slate-900 border-slate-800 text-slate-100 shadow-black/80'
                }`}>
                  <div className="px-4 py-2 border-b border-inherit flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Notifications
                    </span>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>

                  <div className="max-h-72 overflow-y-auto divide-y divide-inherit">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400">
                        No notifications yet.
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`p-3 text-xs transition ${
                            !n.isRead ? 'bg-indigo-50/50 dark:bg-indigo-950/20' : ''
                          }`}
                        >
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {n.title}
                          </div>
                          <div className="text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                            {n.message}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-1">
                            {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* User Account State: Unauthenticated vs Authenticated */}
          {!currentUser ? (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => onOpenAuth('signin')}
                className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition cursor-pointer flex items-center space-x-1.5 ${
                  theme === 'light'
                    ? 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                    : 'text-slate-200 hover:text-white hover:bg-slate-800'
                }`}
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In</span>
              </button>

              <button
                onClick={() => onOpenAuth('register')}
                className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/25 transition cursor-pointer flex items-center space-x-1.5"
              >
                <Sparkles className="w-4 h-4" />
                <span>Get Started</span>
              </button>
            </div>
          ) : (
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className={`flex items-center space-x-2.5 p-1.5 rounded-xl border transition cursor-pointer ${
                  theme === 'light'
                    ? 'border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-900'
                    : 'border-slate-800 hover:border-slate-700 bg-slate-800/60 hover:bg-slate-800 text-slate-100'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center uppercase shadow-sm">
                  {currentUser.fullName.slice(0, 2)}
                </div>
                <div className="text-left hidden sm:block pr-1">
                  <div className="text-xs font-bold leading-tight truncate max-w-[120px]">
                    {currentUser.fullName}
                  </div>
                  <div className={`text-[10px] font-bold uppercase tracking-wider ${
                    currentUser.activeRole === 'ADMIN'
                      ? 'text-rose-500'
                      : currentUser.activeRole === 'INTERVIEWER'
                      ? 'text-amber-500'
                      : 'text-indigo-500'
                  }`}>
                    {currentUser.activeRole}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {showUserMenu && (
                <div className={`absolute right-0 mt-2 w-72 rounded-2xl shadow-2xl border py-2 z-50 ${
                  theme === 'light'
                    ? 'bg-white border-slate-200 text-slate-900 shadow-slate-200/50'
                    : 'bg-slate-900 border-slate-800 text-slate-100 shadow-black/80'
                }`}>
                  <div className="px-4 py-3 border-b border-inherit">
                    <div className="text-sm font-bold">{currentUser.fullName}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{currentUser.email}</div>
                    <div className="mt-2 flex items-center space-x-1.5">
                      <span className="text-[10px] text-slate-400">Active Role:</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        currentUser.activeRole === 'ADMIN'
                          ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800'
                          : currentUser.activeRole === 'INTERVIEWER'
                          ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                          : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800'
                      }`}>
                        {currentUser.activeRole}
                      </span>
                    </div>
                  </div>

                  {/* Switch Active Perspective (Only if multi-role, e.g. Admin or dual candidate/interviewer) */}
                  {currentUser.roles.length > 1 && (
                    <div className="px-3 py-2 border-b border-inherit">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 px-1">
                        Switch Perspective
                      </div>
                      <div className="space-y-1">
                        {currentUser.roles.includes('CANDIDATE') && (
                          <button
                            onClick={() => handleRoleSwitch('CANDIDATE')}
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between cursor-pointer ${
                              currentUser.activeRole === 'CANDIDATE'
                                ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <span>Candidate View</span>
                            {currentUser.activeRole === 'CANDIDATE' && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
                          </button>
                        )}

                        {currentUser.roles.includes('INTERVIEWER') && (
                          <button
                            onClick={() => handleRoleSwitch('INTERVIEWER')}
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between cursor-pointer ${
                              currentUser.activeRole === 'INTERVIEWER'
                                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 font-bold'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <span>Interviewer View</span>
                            {currentUser.activeRole === 'INTERVIEWER' && <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />}
                          </button>
                        )}

                        {currentUser.roles.includes('ADMIN') && (
                          <button
                            onClick={() => handleRoleSwitch('ADMIN')}
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between cursor-pointer ${
                              currentUser.activeRole === 'ADMIN'
                                ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-bold'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <span className="font-bold">Super Admin Panel</span>
                            {currentUser.activeRole === 'ADMIN' && <CheckCircle2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Apply as interviewer link (if candidate only) */}
                  {!currentUser.roles.includes('INTERVIEWER') && (
                    <div className="px-3 py-1.5 border-b border-inherit">
                      <button
                        onClick={() => {
                          setActiveTab('become-interviewer');
                          setShowUserMenu(false);
                        }}
                        className="w-full text-center py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-500 transition cursor-pointer"
                      >
                        Apply as Interviewer (Earn 80%)
                      </button>
                    </div>
                  )}

                  {/* Policies & Support */}
                  <div className="px-3 py-1.5 border-b border-inherit">
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        onOpenPolicies('refund');
                      }}
                      className="w-full text-left px-2 py-1.5 rounded-lg text-xs hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center space-x-2 text-slate-600 dark:text-slate-400 cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Refund & Cancellation Policy</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        onOpenPolicies('faq');
                      }}
                      className="w-full text-left px-2 py-1.5 rounded-lg text-xs hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center space-x-2 text-slate-600 dark:text-slate-400 cursor-pointer"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>FAQ & Support</span>
                    </button>
                  </div>

                  {/* Real Sign Out Button */}
                  <div className="p-1.5">
                    <button
                      onClick={handleSignOut}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center space-x-2 cursor-pointer transition"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
