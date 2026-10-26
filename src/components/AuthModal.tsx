import React, { useState } from 'react';
import { User } from '../types';
import { api } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import {
  X,
  Mail,
  Lock,
  User as UserIcon,
  ShieldCheck,
  Briefcase,
  GraduationCap,
  Sparkles,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: User) => void;
  initialMode?: 'signin' | 'register';
  redirectMessage?: string;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialMode = 'signin',
  redirectMessage,
}) => {
  const { theme } = useTheme();
  const [mode, setMode] = useState<'signin' | 'register'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'CANDIDATE' | 'INTERVIEWER'>('CANDIDATE');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'signin') {
        const res = await api.login(email, password);
        onSuccess(res.user);
        onClose();
      } else {
        const res = await api.register(fullName, email, password, role);
        onSuccess(res.user);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const fillSuperAdmin = () => {
    setEmail('deepanshu.chawla2608@gmail.com');
    setPassword('RamRam2608@');
    setMode('signin');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        className={`relative w-full max-w-md rounded-2xl shadow-2xl border transition-all duration-200 overflow-hidden ${
          theme === 'light'
            ? 'bg-white border-slate-200 text-slate-900 shadow-slate-200/50'
            : 'bg-slate-900 border-slate-800 text-slate-100 shadow-black/80'
        }`}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className={`absolute top-4 right-4 p-2 rounded-xl transition-colors ${
            theme === 'light'
              ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
              : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800'
          }`}
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="p-6 pb-4 border-b border-inherit">
          <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400 mb-2">
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/50">
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="font-bold text-sm tracking-wide uppercase">Interview Arena Auth</span>
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight">
            {mode === 'signin' ? 'Welcome Back' : 'Create Your Account'}
          </h2>
          <p className="text-sm mt-1 text-slate-500 dark:text-slate-400">
            {redirectMessage || (mode === 'signin'
              ? 'Sign in to access your practice sessions, queue, or dashboards.'
              : 'Join as a candidate to master interviews or as an interviewer to earn.')}
          </p>

          {/* Mode Switch Tabs */}
          <div className="flex rounded-xl p-1 mt-4 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setError(null);
              }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                mode === 'signin'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                mode === 'register'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Create Account
            </button>
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 flex items-start space-x-2 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <UserIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Deepanshu Chawla"
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${
                    theme === 'light'
                      ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:bg-white'
                      : 'bg-slate-800/70 border-slate-700 text-slate-100 placeholder-slate-500 focus:bg-slate-800'
                  }`}
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${
                  theme === 'light'
                    ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:bg-white'
                    : 'bg-slate-800/70 border-slate-700 text-slate-100 placeholder-slate-500 focus:bg-slate-800'
                }`}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${
                  theme === 'light'
                    ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:bg-white'
                    : 'bg-slate-800/70 border-slate-700 text-slate-100 placeholder-slate-500 focus:bg-slate-800'
                }`}
              />
            </div>
          </div>

          {mode === 'register' && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                I Want To Join As
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole('CANDIDATE')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    role === 'CANDIDATE'
                      ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 ring-2 ring-indigo-600/30'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <GraduationCap className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span className="font-bold text-sm">Candidate</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Book & practice realistic mock interviews
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setRole('INTERVIEWER')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    role === 'INTERVIEWER'
                      ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/40 ring-2 ring-emerald-600/30'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <Briefcase className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="font-bold text-sm">Interviewer</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Conduct rounds, give feedback & earn up to ₹80/session
                  </p>
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 rounded-xl font-bold text-sm text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center space-x-2 shadow-lg shadow-indigo-600/25 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Processing...</span>
              </>
            ) : mode === 'signin' ? (
              <span>Sign In</span>
            ) : (
              <span>Create Account & Continue</span>
            )}
          </button>

          {/* Super admin quick autofill helper */}
          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={fillSuperAdmin}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center space-x-1"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Fill Super Admin (deepanshu.chawla2608@gmail.com)</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
