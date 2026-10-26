import React, { useState, useEffect } from 'react';
import { Booking, InterviewFeedback, CandidateReview, User } from '../types';
import { api } from '../services/api';
import { InHouseMeetingRoom } from './InHouseMeetingRoom';
import {
  Video,
  Clock,
  CheckSquare,
  FileText,
  ShieldAlert,
  Star,
  ExternalLink,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  Lock,
  MessageSquare,
  ArrowLeft,
  Cast,
} from 'lucide-react';

interface SessionWorkspaceProps {
  bookingId: string;
  currentUser: User | null;
  onBack: () => void;
  onOpenFeedbackModal: (bookingId: string) => void;
  onOpenReviewModal: (bookingId: string) => void;
}

export const SessionWorkspace: React.FC<SessionWorkspaceProps> = ({
  bookingId,
  currentUser,
  onBack,
  onOpenFeedbackModal,
  onOpenReviewModal,
}) => {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [feedback, setFeedback] = useState<InterviewFeedback | null>(null);
  const [review, setReview] = useState<CandidateReview | null>(null);
  const [loading, setLoading] = useState(true);

  const [isInCall, setIsInCall] = useState(false);

  // Timer
  const [secondsRemaining, setSecondsRemaining] = useState(45 * 60);
  const [timerRunning, setTimerRunning] = useState(false);

  // Notes
  const [privateNotes, setPrivateNotes] = useState('');
  const [sharedNotes, setSharedNotes] = useState(
    '// Problem Scratchpad / Live Code Space\n\nfunction solve(input) {\n  // Candidate & Interviewer shared workspace\n  return true;\n}'
  );

  // Checklist
  const [checklist, setChecklist] = useState([
    { id: 1, text: 'Confirm audio/video connectivity & candidate identity', done: true },
    { id: 2, text: 'Introduce round format, expectations & 45-min duration', done: true },
    { id: 3, text: 'Present algorithmic coding / system design problem', done: false },
    { id: 4, text: 'Evaluate clarifying questions & time complexity analysis', done: false },
    { id: 5, text: 'Inspect edge cases, modularity, and test runs', done: false },
    { id: 6, text: 'Reserve 5 mins for candidate Q&A and verbal debrief', done: false },
  ]);

  // Dispute modal state
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState('Candidate No-Show');
  const [disputeDescription, setDisputeDescription] = useState('');
  const [disputeSuccess, setDisputeSuccess] = useState(false);

  useEffect(() => {
    loadSession();
  }, [bookingId]);

  useEffect(() => {
    let interval: any = null;
    if (timerRunning && secondsRemaining > 0) {
      interval = setInterval(() => {
        setSecondsRemaining((prev) => prev - 1);
      }, 1000);
    } else if (secondsRemaining === 0) {
      setTimerRunning(false);
    }
    return () => clearInterval(interval);
  }, [timerRunning, secondsRemaining]);

  const loadSession = async () => {
    try {
      const res = await api.getBookingDetails(bookingId);
      setBooking(res.booking);
      setFeedback(res.feedback || null);
      setReview(res.review || null);
      if (res.booking) {
        setSecondsRemaining(res.booking.roundDurationMins * 60);
      }
    } catch (err) {
      console.error('Failed to load session workspace:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleChecklist = (id: number) => {
    setChecklist((prev) =>
      prev.map((c) => (c.id === id ? { ...c, done: !c.done } : c))
    );
  };

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  const isInterviewer = currentUser?.id === booking?.interviewerId;
  const isCandidate = currentUser?.id === booking?.candidateId;

  const handleDisputeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!booking) return;

    try {
      await api.reportDispute(booking.id, disputeReason, disputeDescription);
      setDisputeSuccess(true);
      setTimeout(() => setShowDisputeModal(false), 2000);
    } catch (err: any) {
      console.error('Failed to file dispute report:', err.message);
    }
  };

  if (loading || !booking) {
    return (
      <div className="py-20 text-center text-slate-400">
        Loading interview workspace...
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                {booking.tierCode.replace('_', ' ')}
              </span>
              <span className="text-xs text-slate-400">Ref: {booking.bookingRef}</span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  booking.status === 'COMPLETED'
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-indigo-500/20 text-indigo-300'
                }`}
              >
                {booking.status.replace('_', ' ')}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white mt-1">
              {booking.trackName} — {booking.roundName}
            </h1>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowDisputeModal(true)}
            className="px-3 py-2 rounded-xl border border-rose-500/30 text-rose-300 hover:bg-rose-500/10 text-xs font-semibold transition flex items-center space-x-1.5"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Report Problem</span>
          </button>

          {isInterviewer && booking.status !== 'COMPLETED' && (
            <button
              onClick={() => onOpenFeedbackModal(booking.id)}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/30 transition flex items-center space-x-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Submit Structured Feedback</span>
            </button>
          )}

          {isCandidate && booking.status === 'COMPLETED' && !review && (
            <button
              onClick={() => onOpenReviewModal(booking.id)}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-md transition flex items-center space-x-2"
            >
              <Star className="w-4 h-4" />
              <span>Rate Interviewer</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Video/Meeting Link + Timer + Scratchpads */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Meeting room & details */}
        <div className="lg:col-span-7 space-y-6">
          {isInCall ? (
            <InHouseMeetingRoom
              booking={booking}
              currentUser={currentUser}
              onEndCall={() => setIsInCall(false)}
            />
          ) : (
            /* Meeting Room Card */
            <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-5 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-indigo-600 text-white flex items-center justify-center shadow-lg">
                    <Video className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">In-House Video Meeting</h3>
                    <p className="text-xs text-slate-400">
                      Zero 3rd party apps required • Embedded WebRTC & Live Problem Runner
                    </p>
                  </div>
                </div>

                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  READY TO CONNECT
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/30 to-indigo-950/30 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-xs font-bold text-white flex items-center space-x-1.5">
                    <Cast className="w-4 h-4 text-emerald-400" />
                    <span>Arena Meet Built-in Video Call</span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Dual video streams, microphone controls, screen sharing, in-call chat, and live code sandbox.
                  </p>
                </div>

                <button
                  onClick={() => setIsInCall(true)}
                  className="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-lg shadow-emerald-600/30 transition flex items-center justify-center space-x-2 shrink-0 animate-pulse"
                >
                  <Video className="w-4 h-4" />
                  <span>Launch In-House Call</span>
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <div className="text-slate-400">Room Identifier:</div>
                  <div className="font-mono text-indigo-300 font-bold">{booking.bookingRef}</div>
                </div>
                <div className="text-right text-slate-400">
                  <div>Security:</div>
                  <div className="text-emerald-400 font-semibold">Peer-to-Peer Encrypted</div>
                </div>
              </div>

            {/* Participants Info */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs">
                <div className="text-[11px] text-slate-400">Candidate</div>
                <div className="font-bold text-white mt-0.5">{booking.candidateName}</div>
                <div className="text-[11px] text-indigo-400 mt-0.5">{booking.jobRole}</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs">
                <div className="text-[11px] text-slate-400">Assigned Interviewer</div>
                <div className="font-bold text-white mt-0.5">{booking.interviewerName || 'Unassigned'}</div>
                <div className="text-[11px] text-emerald-400 mt-0.5">Verified Industry Bar</div>
              </div>
            </div>
          </div>
        )}

          {/* Shared Problem Scratchpad */}
          <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-3 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                <span>Shared Code & Problem Scratchpad</span>
              </h3>
              <span className="text-[10px] text-slate-400">Language: {booking.preferredLanguage}</span>
            </div>
            <textarea
              rows={12}
              value={sharedNotes}
              onChange={(e) => setSharedNotes(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 font-mono text-xs text-indigo-200 focus:outline-none focus:border-indigo-500 leading-relaxed"
            />
          </div>
        </div>

        {/* Right Column: Timer, Checklist, Private Notes, Feedback */}
        <div className="lg:col-span-5 space-y-6">
          {/* Live Countdown Timer */}
          <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>Interview Clock</span>
              </span>
              <span className="text-[11px] text-slate-400">{booking.roundDurationMins}m Target</span>
            </div>

            <div className="text-center py-2">
              <div
                className={`text-5xl font-mono font-extrabold tracking-tight ${
                  secondsRemaining < 300 ? 'text-rose-400 animate-pulse' : 'text-white'
                }`}
              >
                {formatTimer(secondsRemaining)}
              </div>
            </div>

            <div className="flex items-center justify-center space-x-3">
              <button
                onClick={() => setTimerRunning(!timerRunning)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
                  timerRunning
                    ? 'bg-amber-600 hover:bg-amber-500 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                }`}
              >
                {timerRunning ? (
                  <>
                    <Pause className="w-3.5 h-3.5" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    <span>Start Timer</span>
                  </>
                )}
              </button>

              <button
                onClick={() => {
                  setTimerRunning(false);
                  setSecondsRemaining(booking.roundDurationMins * 60);
                }}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                title="Reset timer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Interview Checklist */}
          <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-3 shadow-xl">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <CheckSquare className="w-4 h-4 text-indigo-400" />
              <span>Interview Execution Checklist</span>
            </h3>

            <div className="space-y-2">
              {checklist.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleToggleChecklist(item.id)}
                  className={`p-2.5 rounded-xl border text-xs cursor-pointer flex items-center space-x-2.5 transition ${
                    item.done
                      ? 'bg-slate-950 border-slate-800 text-slate-400 line-through'
                      : 'bg-slate-800/60 border-slate-700 text-slate-200'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={() => {}}
                    className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0"
                  />
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Private Interviewer Scratchpad */}
          {isInterviewer && (
            <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-3 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-amber-300 flex items-center space-x-2">
                  <Lock className="w-4 h-4" />
                  <span>Private Interviewer Notes</span>
                </h3>
                <span className="text-[10px] text-slate-500">Not visible to candidate</span>
              </div>
              <textarea
                rows={5}
                placeholder="Jot down rough observations: e.g. 'missed empty array edge case initially, recovered nicely when hinted about two pointers'..."
                value={privateNotes}
                onChange={(e) => setPrivateNotes(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>
          )}

          {/* Existing Feedback Summary if submitted */}
          {feedback && (
            <div className="rounded-3xl bg-slate-900 border border-emerald-500/30 p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>Performance Rubric Summary</span>
                </h3>
                <span className="text-lg font-extrabold text-emerald-400">
                  {feedback.overallScore}/5.0
                </span>
              </div>

              <div className="text-xs text-slate-300 space-y-2">
                <div>
                  <strong className="text-white">Strengths:</strong> {feedback.strengths}
                </div>
                <div>
                  <strong className="text-white">Areas to Improve:</strong> {feedback.improvementAreas}
                </div>
                <div>
                  <strong className="text-white">Next Round Recommendation:</strong>{' '}
                  <span className="text-indigo-300">{feedback.recommendedNextRound}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Problem / Dispute Modal */}
      {showDisputeModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md p-6 space-y-5 shadow-2xl">
            <h3 className="text-base font-bold text-white">Report Problem or Technical Issue</h3>

            {disputeSuccess ? (
              <div className="p-4 rounded-xl bg-emerald-500/10 text-emerald-300 text-xs text-center">
                Dispute report logged. An administrator will review session logs and issue a refund or adjustment if applicable.
              </div>
            ) : (
              <form onSubmit={handleDisputeSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Issue Category:</label>
                  <select
                    value={disputeReason}
                    onChange={(e) => setDisputeReason(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-xs text-white rounded-xl p-2.5"
                  >
                    <option value="Candidate No-Show">Candidate No-Show</option>
                    <option value="Interviewer No-Show">Interviewer No-Show</option>
                    <option value="Audio / Video Glitch">Audio / Video Technical Glitch</option>
                    <option value="Inappropriate Conduct">Inappropriate Conduct</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Description:</label>
                  <textarea
                    rows={4}
                    value={disputeDescription}
                    onChange={(e) => setDisputeDescription(e.target.value)}
                    placeholder="Provide details of what occurred..."
                    required
                    className="w-full bg-slate-950 border border-slate-800 text-xs text-white rounded-xl p-2.5"
                  />
                </div>

                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowDisputeModal(false)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
                  >
                    Submit Report
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
