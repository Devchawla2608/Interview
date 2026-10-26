import React, { useState, useEffect } from 'react';
import { QueueEntry, Booking } from '../types';
import { api } from '../services/api';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  Zap,
  ShieldCheck,
  Video,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

interface QueueTrackerModalProps {
  onClose: () => void;
  onOpenWorkspace: (bookingId: string) => void;
}

export const QueueTrackerModal: React.FC<QueueTrackerModalProps> = ({
  onClose,
  onOpenWorkspace,
}) => {
  const [queueStatus, setQueueStatus] = useState<{
    inQueue: boolean;
    entry?: QueueEntry;
    booking?: Booking;
    position?: number;
    totalInQueue?: number;
    estimatedWaitMins?: number;
  }>({ inQueue: false });
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelledMessage, setCancelledMessage] = useState<string | null>(null);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 3000); // Polling sync
    return () => clearInterval(interval);
  }, []);

  const checkStatus = async () => {
    try {
      const res = await api.getMyQueueStatus();
      setQueueStatus(res);
    } catch (err) {
      console.error('Queue poll error:', err);
    }
  };

  const handleCancelAndRefund = async () => {
    if (!queueStatus.booking) return;
    setIsCancelling(true);
    try {
      await api.cancelBooking(queueStatus.booking.id, 'Candidate cancelled while waiting in queue');
      setCancelledMessage('Your session has been cancelled and a 100% full refund has been initiated to your original payment method.');
    } catch (err: any) {
      alert(err.message || 'Failed to cancel session');
    } finally {
      setIsCancelling(false);
    }
  };

  const isClaimed = queueStatus.booking && ['CLAIMED', 'READY', 'IN_PROGRESS'].includes(queueStatus.booking.status);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg shadow-2xl p-6 relative overflow-hidden">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {cancelledMessage ? (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white">Cancellation & Refund Complete</h3>
            <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">
              {cancelledMessage}
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
            >
              Close Window
            </button>
          </div>
        ) : isClaimed && queueStatus.booking ? (
          /* Match Found! */
          <div className="text-center py-6 space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto animate-bounce">
              <Sparkles className="w-8 h-8" />
            </div>
            <div>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                INTERVIEWER ASSIGNED
              </span>
              <h3 className="text-2xl font-extrabold text-white mt-2">Match Found!</h3>
              <p className="text-xs text-slate-300 mt-1">
                Your session was accepted by <strong className="text-white">{queueStatus.booking.interviewerName}</strong>.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-left text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Track & Round:</span>
                <span className="font-semibold text-white">{queueStatus.booking.trackName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Duration:</span>
                <span className="font-semibold text-white">{queueStatus.booking.roundDurationMins} minutes</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Meeting Room:</span>
                <span className="font-semibold text-indigo-400">Ready</span>
              </div>
            </div>

            <button
              onClick={() => {
                onClose();
                onOpenWorkspace(queueStatus.booking!.id);
              }}
              className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition flex items-center justify-center space-x-2"
            >
              <Video className="w-4 h-4" />
              <span>Enter Live Workspace Now</span>
            </button>
          </div>
        ) : queueStatus.inQueue && queueStatus.entry ? (
          /* Waiting in Live Queue */
          <div className="space-y-6">
            <div className="text-center space-y-2">
              {/* Radar pulse animation */}
              <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-indigo-500/20 animate-ping" />
                <div className="absolute inset-2 rounded-full bg-indigo-600/20 animate-pulse" />
                <div className="relative w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/40 font-bold">
                  #{queueStatus.position || 1}
                </div>
              </div>

              <h3 className="text-xl font-bold text-white">Searching for Interviewer...</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Broadcasting your practice request to verified Tier {queueStatus.entry.tierCode.replace('TIER_', '')} interviewers.
              </p>
            </div>

            {/* Queue Metrics */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-center">
                <div className="text-[11px] text-slate-400">Queue Position</div>
                <div className="text-lg font-bold text-white mt-0.5">#{queueStatus.position || 1} in line</div>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-center">
                <div className="text-[11px] text-slate-400">Estimated Wait</div>
                <div className="text-lg font-bold text-amber-400 mt-0.5">
                  ~{queueStatus.estimatedWaitMins || 3} mins
                </div>
              </div>
            </div>

            {/* Session info */}
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-1.5 text-slate-300">
              <div className="flex justify-between">
                <span>Target Track:</span>
                <span className="font-semibold text-white">{queueStatus.entry.trackName}</span>
              </div>
              <div className="flex justify-between">
                <span>Round:</span>
                <span className="font-semibold text-white">{queueStatus.entry.roundName}</span>
              </div>
              <div className="flex justify-between">
                <span>Language:</span>
                <span className="font-semibold text-white">{queueStatus.entry.preferredLanguage}</span>
              </div>
            </div>

            {/* Cancel with 100% refund action */}
            <div className="pt-2 border-t border-slate-800/80 space-y-3">
              <button
                onClick={handleCancelAndRefund}
                disabled={isCancelling}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-rose-950/40 hover:border-rose-500/30 border border-slate-700 text-slate-300 hover:text-rose-300 text-xs font-semibold transition"
              >
                {isCancelling ? 'Processing refund...' : 'Leave Queue & Get 100% Instant Refund'}
              </button>
              <p className="text-[10px] text-center text-slate-500">
                You will not be charged if an interviewer is not assigned.
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 space-y-3">
            <AlertCircle className="w-10 h-10 text-slate-500 mx-auto" />
            <h3 className="text-base font-bold text-white">No Active Queue Session</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              You do not have an active waiting queue entry right now. Browse tracks to start a mock interview.
            </p>
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold"
            >
              Browse Catalog
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
