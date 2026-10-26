import React, { useState, useEffect } from 'react';
import { User, Booking, QueueEntry } from '../types';
import { api } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import {
  Compass,
  Clock,
  Video,
  CheckCircle2,
  Calendar,
  AlertCircle,
  ExternalLink,
  Star,
  Award,
  ArrowRight,
  TrendingUp,
  FileCheck2,
  Sparkles,
  Zap,
} from 'lucide-react';

interface CandidateDashboardProps {
  currentUser: User | null;
  onNavigateToCatalog: (tier?: string) => void;
  onOpenWorkspace: (bookingId: string) => void;
  onOpenQueueTracker: () => void;
  onOpenFeedback: (bookingId: string) => void;
  onOpenReview: (bookingId: string) => void;
}

export const CandidateDashboard: React.FC<CandidateDashboardProps> = ({
  currentUser,
  onNavigateToCatalog,
  onOpenWorkspace,
  onOpenQueueTracker,
  onOpenFeedback,
  onOpenReview,
}) => {
  const { theme } = useTheme();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [myQueue, setMyQueue] = useState<{
    inQueue: boolean;
    entry?: QueueEntry;
    booking?: Booking;
    position?: number;
    estimatedWaitMins?: number;
  }>({ inQueue: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 6000);
    return () => clearInterval(interval);
  }, [currentUser?.id]);

  const loadData = async () => {
    try {
      const [bookingsRes, queueRes] = await Promise.all([
        api.getBookings(),
        api.getMyQueueStatus(),
      ]);
      setBookings(bookingsRes.bookings || []);
      setMyQueue(queueRes);
    } catch (err) {
      console.error('Failed to load candidate dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const activeBookings = bookings.filter((b) =>
    ['QUEUED', 'CLAIMED', 'SCHEDULED', 'READY', 'IN_PROGRESS'].includes(b.status)
  );
  const completedBookings = bookings.filter((b) => b.status === 'COMPLETED');
  const candProf = currentUser?.candidateProfile;

  return (
    <div className="space-y-8 pb-16">
      {/* Welcome Banner */}
      <div className={`relative overflow-hidden rounded-3xl border p-6 sm:p-8 transition-colors ${
        theme === 'light'
          ? 'bg-gradient-to-r from-indigo-50 via-white to-amber-50/60 border-indigo-100/80 shadow-md text-slate-900'
          : 'bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900 border-indigo-900/40 shadow-2xl text-white'
      }`}>
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-400 dark:text-indigo-300 text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Targeting Top Engineering Roles</span>
          </div>
          <h1 className={`text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
            Welcome back, {currentUser?.fullName || 'Candidate'}!
          </h1>
          <p className={`mt-2 text-sm sm:text-base leading-relaxed ${theme === 'light' ? 'text-slate-600' : 'text-slate-300'}`}>
            Practice live technical rounds with experienced industry interviewers. Select your target company tier, join the real-time queue or schedule, and receive structured rubric feedback.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={() => onNavigateToCatalog('TIER_A')}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-indigo-600/30 transition flex items-center space-x-2"
            >
              <span>Explore Tier A Tracks (₹100)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => onNavigateToCatalog('TIER_B')}
              className="px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 text-xs sm:text-sm font-medium transition"
            >
              Tier B Tracks (₹80)
            </button>
            <button
              onClick={() => onNavigateToCatalog('TIER_C')}
              className="px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 text-xs sm:text-sm font-medium transition"
            >
              Tier C Fundamentals (₹60)
            </button>
          </div>
        </div>

        {/* Profile summary chips */}
        <div className="mt-6 pt-6 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800">
            <div className="text-[11px] text-slate-400">Total Practice Sessions</div>
            <div className="text-xl font-bold text-white mt-0.5">{completedBookings.length} completed</div>
          </div>
          <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800">
            <div className="text-[11px] text-slate-400">Target Role</div>
            <div className="text-sm font-semibold text-indigo-300 truncate mt-1">
              {candProf?.targetRoles?.join(', ') || 'Software Engineer'}
            </div>
          </div>
          <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800">
            <div className="text-[11px] text-slate-400">Preferred Languages</div>
            <div className="text-sm font-semibold text-slate-300 mt-1">
              {candProf?.preferredLanguages?.join(', ') || 'Python, Java'}
            </div>
          </div>
          <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800">
            <div className="text-[11px] text-slate-400">Experience Stage</div>
            <div className="text-sm font-semibold text-emerald-400 mt-1">
              {candProf?.experienceLevel || 'Student / Fresher'}
            </div>
          </div>
        </div>
      </div>

      {/* Active Queue Banner if Candidate is in Queue */}
      {myQueue.inQueue && myQueue.entry && (
        <div className="rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 p-5 sm:p-6 shadow-xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 animate-pulse">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-white text-base sm:text-lg">
                    You are in the Live Matchmaking Queue!
                  </span>
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Position #{myQueue.position || 1}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 mt-1">
                  Track: <strong className="text-white">{myQueue.entry.trackName}</strong> • {myQueue.entry.roundName}
                </p>
                <p className="text-xs text-amber-300/90 mt-1 flex items-center space-x-1.5">
                  <Zap className="w-3.5 h-3.5" />
                  <span>Estimated wait: ~{myQueue.estimatedWaitMins || 3} mins. Interviewers receive real-time alerts.</span>
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3 shrink-0">
              <button
                onClick={onOpenQueueTracker}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm shadow-md transition"
              >
                View Live Radar & Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active & Upcoming Sessions */}
      {activeBookings.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-indigo-400" />
              <span>Active & Assigned Interviews</span>
            </h2>
            <span className="text-xs text-slate-400">{activeBookings.length} in progress</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeBookings.map((b) => (
              <div
                key={b.id}
                className="rounded-2xl bg-slate-900 border border-slate-800 p-5 hover:border-slate-700 transition space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 uppercase tracking-wider">
                      {b.tierCode.replace('_', ' ')}
                    </span>
                    <h3 className="text-base font-bold text-white mt-1">{b.trackName}</h3>
                    <p className="text-xs text-slate-400">{b.roundName}</p>
                  </div>

                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      b.status === 'CLAIMED' || b.status === 'READY'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : b.status === 'IN_PROGRESS'
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30 animate-pulse'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {b.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-800/60 text-xs space-y-1.5 border border-slate-800">
                  <div className="flex justify-between text-slate-300">
                    <span>Interviewer:</span>
                    <span className="font-semibold text-white">
                      {b.interviewerName || 'Searching eligible interviewers...'}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Session Duration:</span>
                    <span className="font-semibold text-white">{b.roundDurationMins} minutes</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Meeting Provider:</span>
                    <span className="font-semibold text-indigo-400">
                      In-House Video Meeting (WebRTC)
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-3 pt-1">
                  <button
                    onClick={() => onOpenWorkspace(b.id)}
                    className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition flex items-center justify-center space-x-1.5"
                  >
                    <Video className="w-4 h-4" />
                    <span>Open Live Workspace</span>
                  </button>
                  {b.meetingUrl && (
                    <a
                      href={b.meetingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                      title="Direct video link"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommended Preparation Pathway */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-indigo-400" />
              <span>Recommended Practice Pathways</span>
            </h2>
            <p className="text-xs text-slate-400">
              Graduated curriculum from fundamentals to full-loop FAANG system design
            </p>
          </div>
          <button
            onClick={() => onNavigateToCatalog()}
            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center space-x-1"
          >
            <span>View All Tracks</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Tier A */}
          <div className="rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 hover:border-indigo-500/50 p-6 flex flex-col justify-between transition group shadow-lg">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold px-2.5 py-1 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  TIER A • FAANG
                </span>
                <span className="text-lg font-extrabold text-white">₹100</span>
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-indigo-300 transition">
                Top-Tier Tech Pathway
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Modeled after Google, Meta, Amazon, Microsoft, and Uber. 3 to 5 rigorous rounds from algorithmic screen to scalable system design.
              </p>
              <div className="text-[11px] text-slate-400 space-y-1 pt-2 border-t border-slate-800">
                <div className="flex items-center space-x-1.5 text-slate-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Coding Screen (DSA & Complexity)</span>
                </div>
                <div className="flex items-center space-x-1.5 text-slate-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Deep Non-Linear Coding (Trees/Graphs)</span>
                </div>
                <div className="flex items-center space-x-1.5 text-slate-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Scalable System Design & STAR Behavioral</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => onNavigateToCatalog('TIER_A')}
              className="mt-6 w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md transition"
            >
              Start Tier A Prep (₹100)
            </button>
          </div>

          {/* Tier B */}
          <div className="rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 hover:border-amber-500/50 p-6 flex flex-col justify-between transition group shadow-lg">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  TIER B • ESTABLISHED
                </span>
                <span className="text-lg font-extrabold text-white">₹80</span>
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-amber-300 transition">
                High-Growth Tech Pathway
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Established product companies, Unicorn startups, and FinTech. 2 to 3 practical rounds focusing on full-stack coding, APIs, and databases.
              </p>
              <div className="text-[11px] text-slate-400 space-y-1 pt-2 border-t border-slate-800">
                <div className="flex items-center space-x-1.5 text-slate-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>CS Fundamentals & SQL Schema</span>
                </div>
                <div className="flex items-center space-x-1.5 text-slate-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Role-specific Technical Interview</span>
                </div>
                <div className="flex items-center space-x-1.5 text-slate-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Past Project Architectural Deep-dive</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => onNavigateToCatalog('TIER_B')}
              className="mt-6 w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs shadow-md transition"
            >
              Start Tier B Prep (₹80)
            </button>
          </div>

          {/* Tier C */}
          <div className="rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 hover:border-emerald-500/50 p-6 flex flex-col justify-between transition group shadow-lg">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  TIER C • FUNDAMENTALS
                </span>
                <span className="text-lg font-extrabold text-white">₹60</span>
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-emerald-300 transition">
                Campus & Entry-Level Prep
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Campus placement drives, IT service firms, and junior engineers. 1 to 2 rounds covering OOP fundamentals, basic logic, and HR readiness.
              </p>
              <div className="text-[11px] text-slate-400 space-y-1 pt-2 border-t border-slate-800">
                <div className="flex items-center space-x-1.5 text-slate-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Foundational Coding & Loops</span>
                </div>
                <div className="flex items-center space-x-1.5 text-slate-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Academic Project Review & Debugging</span>
                </div>
                <div className="flex items-center space-x-1.5 text-slate-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>HR & Behavioral Introduction</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => onNavigateToCatalog('TIER_C')}
              className="mt-6 w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md transition"
            >
              Start Fundamentals (₹60)
            </button>
          </div>
        </div>
      </div>

      {/* Completed Interviews & Rubric Reports */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center space-x-2">
          <FileCheck2 className="w-5 h-5 text-indigo-400" />
          <span>Past Sessions & Performance Reports</span>
        </h2>

        {completedBookings.length === 0 ? (
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-8 text-center space-y-3">
            <Award className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-300">No completed interviews yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Once you complete your first practice interview, detailed scores, strengths, improvement areas, and next-round recommendations will be archived here.
            </p>
            <button
              onClick={() => onNavigateToCatalog()}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition"
            >
              Book Your First Mock Interview
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {completedBookings.map((b) => (
              <div
                key={b.id}
                className="rounded-2xl bg-slate-900 border border-slate-800 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-slate-700 transition"
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                      COMPLETED
                    </span>
                    <span className="text-xs text-slate-400">Ref: {b.bookingRef}</span>
                    <span className="text-xs text-slate-500">•</span>
                    <span className="text-xs text-slate-400">
                      {new Date(b.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-white mt-1">
                    {b.trackName} — {b.roundName}
                  </h4>
                  <p className="text-xs text-slate-400">
                    Interviewer: <span className="text-slate-200 font-medium">{b.interviewerName}</span> • Fee Paid: ₹{b.totalAmount}
                  </p>
                </div>

                <div className="flex items-center space-x-3 shrink-0">
                  <button
                    onClick={() => onOpenFeedback(b.id)}
                    className="px-4 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-xs font-semibold transition flex items-center space-x-1.5"
                  >
                    <FileCheck2 className="w-4 h-4" />
                    <span>View Performance Report</span>
                  </button>
                  <button
                    onClick={() => onOpenReview(b.id)}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-semibold transition flex items-center space-x-1"
                  >
                    <Star className="w-3.5 h-3.5 fill-amber-300" />
                    <span>Rate Interviewer</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
