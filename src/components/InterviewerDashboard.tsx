import React, { useState, useEffect } from 'react';
import { User, QueueEntry, Booking, InterviewerEarnings } from '../types';
import { api } from '../services/api';
import {
  Briefcase,
  Zap,
  Clock,
  CheckCircle2,
  AlertCircle,
  Video,
  DollarSign,
  TrendingUp,
  Calendar,
  Lock,
  ArrowRight,
  ShieldAlert,
  Wallet,
  Building,
} from 'lucide-react';

interface InterviewerDashboardProps {
  currentUser: User | null;
  onOpenWorkspace: (bookingId: string) => void;
  onNavigateToApplication: () => void;
}

export const InterviewerDashboard: React.FC<InterviewerDashboardProps> = ({
  currentUser,
  onOpenWorkspace,
  onNavigateToApplication,
}) => {
  const [profile, setProfile] = useState<any>(null);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [earnings, setEarnings] = useState<InterviewerEarnings | null>(null);
  const [activeBookings, setActiveBookings] = useState<Booking[]>([]);
  const [isAvailable, setIsAvailable] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutUpi, setPayoutUpi] = useState('');
  const [isProcessingPayout, setIsProcessingPayout] = useState(false);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 4000); // sync live queue
    return () => clearInterval(interval);
  }, [currentUser?.id]);

  const loadData = async () => {
    try {
      const [profRes, queueRes, earnRes, bookingsRes] = await Promise.all([
        api.getInterviewerProfile(),
        api.getQueue(),
        api.getInterviewerEarnings(),
        api.getBookings(),
      ]);

      setProfile(profRes.profile);
      setIsAvailable(profRes.profile?.isAvailable || false);
      setQueue(queueRes.queue || []);
      setEarnings(earnRes.earnings);
      setPayoutUpi(profRes.profile?.upiId || 'sarah.chen@okhdfcbank');

      const myActive = (bookingsRes.bookings || []).filter(
        (b) => b.interviewerId === currentUser?.id && ['CLAIMED', 'READY', 'IN_PROGRESS'].includes(b.status)
      );
      setActiveBookings(myActive);
    } catch (err) {
      console.error('Failed to load interviewer dashboard data:', err);
    }
  };

  const handleToggleAvailability = async () => {
    try {
      const res = await api.toggleAvailability();
      setIsAvailable(res.isAvailable);
    } catch (err: any) {
      setClaimError(err.message || 'Failed to toggle availability');
    }
  };

  const handleClaimSession = async (bookingId: string) => {
    setClaimingId(bookingId);
    setClaimError(null);
    try {
      const res = await api.claimQueueEntry(bookingId);
      if (res.success) {
        onOpenWorkspace(res.booking.id);
      }
    } catch (err: any) {
      setClaimError(err.message || 'This session was already claimed by another interviewer.');
      // refresh queue
      loadData();
    } finally {
      setClaimingId(null);
    }
  };

  const handleRequestPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(payoutAmount);
    if (!amt || amt <= 0) return;

    setIsProcessingPayout(true);
    try {
      const res = await api.requestPayout(amt, payoutUpi);
      setEarnings(res.earnings);
      setShowPayoutModal(false);
      setPayoutAmount('');
    } catch (err: any) {
      setClaimError(err.message || 'Payout request failed');
    } finally {
      setIsProcessingPayout(false);
    }
  };

  const isApproved = profile?.status === 'APPROVED';

  return (
    <div className="space-y-8 pb-16">
      {/* Top Header & Availability Radar */}
      <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 sm:p-8 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center space-x-2">
            <span
              className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                isApproved
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
              }`}
            >
              {isApproved ? 'APPROVED INTERVIEWER' : `STATUS: ${profile?.status || 'SUBMITTED'}`}
            </span>
            <span className="text-xs text-slate-400">80% Revenue Share</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
            {currentUser?.fullName} — Interviewer Portal
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
            {profile?.headline || 'Senior Software Engineer'} • {profile?.experienceYears || 5} Years Experience
          </p>
        </div>

        {/* Availability Toggle */}
        <div className="flex items-center space-x-4 bg-slate-950 p-4 rounded-2xl border border-slate-800 shrink-0">
          <div>
            <div className="text-xs font-bold text-white flex items-center space-x-1.5">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isAvailable ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                }`}
              />
              <span>{isAvailable ? 'Online & Available' : 'Currently Offline'}</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {isAvailable ? 'Receiving real-time match requests' : 'Toggle on to accept queue requests'}
            </div>
          </div>

          <button
            onClick={handleToggleAvailability}
            disabled={!isApproved}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-md ${
              !isApproved
                ? 'opacity-40 cursor-not-allowed bg-slate-800 text-slate-400'
                : isAvailable
                ? 'bg-rose-600 hover:bg-rose-500 text-white'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {isAvailable ? 'Go Offline' : 'Go Online'}
          </button>
        </div>
      </div>

      {!isApproved && (
        <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start space-x-3 text-amber-300">
            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-white text-sm">Screening In Progress</h4>
              <p className="text-xs text-amber-200/90 mt-0.5">
                To guarantee high mock interview quality, each applicant must complete 2 screening sessions evaluated against structured rubrics before accepting paid sessions.
              </p>
            </div>
          </div>
          <button
            onClick={onNavigateToApplication}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shrink-0 transition"
          >
            Track Screening Status
          </button>
        </div>
      )}

      {/* Claim Error Alert */}
      {claimError && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{claimError}</span>
          </div>
          <button
            onClick={() => setClaimError(null)}
            className="text-xs text-rose-400 underline font-semibold ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Active Claimed Sessions */}
      {activeBookings.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <Video className="w-5 h-5 text-emerald-400" />
            <span>Your Claimed Active Sessions ({activeBookings.length})</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeBookings.map((b) => (
              <div
                key={b.id}
                className="rounded-2xl bg-slate-900 border-2 border-emerald-500/30 p-5 space-y-4 shadow-xl"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                      SESSION IN PROGRESS
                    </span>
                    <h3 className="text-base font-bold text-white mt-1">{b.trackName}</h3>
                    <p className="text-xs text-slate-400">{b.roundName}</p>
                  </div>
                  <span className="text-base font-extrabold text-emerald-400">
                    +₹{b.interviewerEarnings}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 text-xs space-y-1 border border-slate-800">
                  <div className="flex justify-between text-slate-300">
                    <span>Candidate:</span>
                    <span className="font-semibold text-white">{b.candidateName}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Role & Language:</span>
                    <span className="text-slate-300">{b.jobRole} • {b.preferredLanguage}</span>
                  </div>
                </div>

                <button
                  onClick={() => onOpenWorkspace(b.id)}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition flex items-center justify-center space-x-2"
                >
                  <Video className="w-4 h-4" />
                  <span>Enter Live Workspace & Conduct Mock</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live Incoming Queue Radar */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center space-x-2">
              <Zap className="w-5 h-5 text-amber-400" />
              <span>Incoming Queue Requests ({queue.length})</span>
            </h2>
            <p className="text-xs text-slate-400">
              Real-time waiting candidates. 1-click atomic acceptance locks the session exclusively for you.
            </p>
          </div>
          <span className="text-xs text-slate-400">FIFO Ordering</span>
        </div>

        {queue.length === 0 ? (
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-8 text-center space-y-2">
            <Clock className="w-8 h-8 text-slate-600 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-300">No candidates in queue right now</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              New requests will automatically pop up here as candidates complete checkout. Keep your availability online.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {queue.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 hover:border-indigo-500/50 p-5 space-y-4 flex flex-col justify-between shadow-lg transition"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        item.tierCode === 'TIER_A'
                          ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {item.tierCode.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-slate-400 flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{item.durationMins} mins</span>
                    </span>
                  </div>

                  <div>
                    <h4 className="text-base font-bold text-white leading-tight">{item.trackName}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">{item.roundName}</p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950 text-xs space-y-1 border border-slate-800/80">
                    <div className="flex justify-between text-slate-300">
                      <span>Target Role:</span>
                      <span className="font-medium text-white">{item.jobRole}</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Coding Language:</span>
                      <span className="font-medium text-white">{item.preferredLanguage}</span>
                    </div>
                    <div className="flex justify-between text-slate-300 pt-1 border-t border-slate-800">
                      <span>Your Earnings (80%):</span>
                      <span className="font-extrabold text-emerald-400 text-sm">
                        ₹{item.expectedCompensation}.00
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleClaimSession(item.bookingId)}
                  disabled={!isApproved || claimingId === item.bookingId}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold text-xs shadow-md shadow-indigo-600/30 transition flex items-center justify-center space-x-1.5"
                >
                  {claimingId === item.bookingId ? (
                    <span>Claiming session...</span>
                  ) : !isApproved ? (
                    <span className="flex items-center space-x-1">
                      <Lock className="w-3.5 h-3.5" />
                      <span>Approval Required</span>
                    </span>
                  ) : (
                    <>
                      <span>Accept & Claim Session (₹{item.expectedCompensation})</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Earnings & Financial Accounting */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <Wallet className="w-5 h-5 text-emerald-400" />
            <span>Earnings & Payout Ledger</span>
          </h2>

          {earnings && earnings.availableBalance > 0 && (
            <button
              onClick={() => setShowPayoutModal(true)}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition"
            >
              Withdraw Earnings (₹{earnings.availableBalance})
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
            <div className="text-xs text-slate-400">Available Balance</div>
            <div className="text-2xl font-extrabold text-emerald-400">
              ₹{earnings?.availableBalance || 0}.00
            </div>
            <div className="text-[11px] text-slate-500">Ready for instant UPI payout</div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
            <div className="text-xs text-slate-400">Pending Review</div>
            <div className="text-2xl font-extrabold text-amber-400">
              ₹{earnings?.pendingBalance || 0}.00
            </div>
            <div className="text-[11px] text-slate-500">Awaiting feedback submission</div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
            <div className="text-xs text-slate-400">Total Paid Out</div>
            <div className="text-2xl font-extrabold text-slate-200">
              ₹{earnings?.paidBalance || 0}.00
            </div>
            <div className="text-[11px] text-slate-500">Transferred to UPI / Bank</div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
            <div className="text-xs text-slate-400">Lifetime Earnings</div>
            <div className="text-2xl font-extrabold text-white">
              ₹{earnings?.totalEarned || 0}.00
            </div>
            <div className="text-[11px] text-slate-500">{profile?.totalCompletedSessions || 0} completed interviews</div>
          </div>
        </div>

        {/* Payout History */}
        {earnings && earnings.payoutHistory.length > 0 && (
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Recent Payout Transfers
            </h3>
            <div className="divide-y divide-slate-800 text-xs">
              {earnings.payoutHistory.map((p) => (
                <div key={p.id} className="py-2.5 flex items-center justify-between text-slate-300">
                  <div>
                    <div className="font-semibold text-white">{p.payoutRef}</div>
                    <div className="text-[10px] text-slate-500">
                      Destination: {p.destination} • Ref: {p.referenceCode}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-emerald-400 text-sm">₹{p.amount}.00</span>
                    <div className="text-[10px] text-slate-400">
                      {new Date(p.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Payout Modal */}
      {showPayoutModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-white">Request Interviewer Payout</h3>
              <button
                onClick={() => setShowPayoutModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRequestPayout} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Withdrawal Amount (Max: ₹{earnings?.availableBalance}):
                </label>
                <input
                  type="number"
                  min="1"
                  max={earnings?.availableBalance}
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  placeholder={`e.g. ${earnings?.availableBalance}`}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  UPI ID or Bank Account:
                </label>
                <input
                  type="text"
                  value={payoutUpi}
                  onChange={(e) => setPayoutUpi(e.target.value)}
                  placeholder="e.g. name@okhdfcbank"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400">
                Processed via simulated NEFT / IMPS gateway. Updates the append-only financial ledger immediately.
              </div>

              <button
                type="submit"
                disabled={isProcessingPayout}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs shadow-md transition"
              >
                {isProcessingPayout ? 'Processing transfer...' : 'Confirm Transfer'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
