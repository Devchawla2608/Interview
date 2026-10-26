import React, { useState, useEffect } from 'react';
import { User, Booking, QueueEntry, InterviewFeedback } from '../types';
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
  DollarSign,
  ShieldAlert,
  RotateCcw,
  MessageSquare,
  Building,
  UserCheck,
  Briefcase,
  Layers,
  Check,
  X,
  AlertTriangle,
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

  // Questionnaire / Profile Completion State
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileForm, setProfileForm] = useState({
    fullName: currentUser?.fullName || '',
    bio: currentUser?.candidateProfile?.bio || '',
    targetRoles: currentUser?.candidateProfile?.targetRoles?.join(', ') || 'Software Engineer',
    experienceLevel: currentUser?.candidateProfile?.experienceLevel || 'FRESHER',
    collegeOrEmployer: currentUser?.candidateProfile?.collegeOrEmployer || '',
    targetCompanies: currentUser?.candidateProfile?.targetCompanies?.join(', ') || 'Google, Uber, Swiggy',
    targetSalaryBracket: currentUser?.candidateProfile?.targetSalaryBracket || '18–35 LPA',
    preferredLanguages: currentUser?.candidateProfile?.preferredLanguages?.join(', ') || 'Python, Java',
    primaryFocusAreas: currentUser?.candidateProfile?.primaryFocusAreas?.join(', ') || 'Data Structures, System Design',
    resumeUrl: currentUser?.candidateProfile?.resumeUrl || '',
    linkedinUrl: currentUser?.candidateProfile?.linkedinUrl || '',
    githubUrl: currentUser?.candidateProfile?.githubUrl || '',
  });

  // Scorecard Modal State
  const [scorecardBooking, setScorecardBooking] = useState<Booking | null>(null);
  const [scorecardFeedback, setScorecardFeedback] = useState<InterviewFeedback | null>(null);
  const [loadingScorecard, setLoadingScorecard] = useState(false);

  // Dispute / Complaint Modal State
  const [isDisputeModalOpen, setIsDisputeModalOpen] = useState(false);
  const [disputeBookingId, setDisputeBookingId] = useState<string | null>(null);
  const [disputeCategory, setDisputeCategory] = useState('INTERVIEWER_ABSENT');
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeResolution, setDisputeResolution] = useState('REFUND');
  const [disputeSubmitting, setDisputeSubmitting] = useState(false);

  // Refund Modal State
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [refundBookingId, setRefundBookingId] = useState<string | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [refundSubmitting, setRefundSubmitting] = useState(false);

  // Action status message
  const [actionAlert, setActionAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
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
  const pastBookings = bookings.filter((b) =>
    ['COMPLETED', 'CANCELLED', 'REFUNDED', 'NO_SHOW_CANDIDATE', 'NO_SHOW_INTERVIEWER'].includes(b.status)
  );
  const completedBookings = bookings.filter((b) => b.status === 'COMPLETED');
  const candProf = currentUser?.candidateProfile;

  // Compute profile completion percentage
  const calculateCompletion = () => {
    if (candProf?.profileCompletionPercent) return candProf.profileCompletionPercent;
    let score = 20;
    if (currentUser?.fullName) score += 10;
    if (candProf?.bio) score += 10;
    if (candProf?.collegeOrEmployer) score += 15;
    if (candProf?.targetRoles?.length) score += 15;
    if (candProf?.targetCompanies?.length) score += 15;
    if (candProf?.targetSalaryBracket) score += 15;
    return Math.min(score, 100);
  };
  const completionPercent = calculateCompletion();

  // Financial calculations
  const totalSpent = bookings
    .filter((b) => b.paymentStatus === 'PAID')
    .reduce((sum, b) => sum + b.totalAmount, 0);

  const totalRefunded = bookings
    .filter((b) => b.paymentStatus === 'REFUNDED')
    .reduce((sum, b) => sum + b.totalAmount, 0);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setActionAlert(null);

    try {
      const targetRoles = profileForm.targetRoles.split(',').map((s) => s.trim()).filter(Boolean);
      const targetCompanies = profileForm.targetCompanies.split(',').map((s) => s.trim()).filter(Boolean);
      const preferredLanguages = profileForm.preferredLanguages.split(',').map((s) => s.trim()).filter(Boolean);
      const primaryFocusAreas = profileForm.primaryFocusAreas.split(',').map((s) => s.trim()).filter(Boolean);

      const res = await api.updateCandidateProfile({
        fullName: profileForm.fullName,
        bio: profileForm.bio,
        targetRoles,
        experienceLevel: profileForm.experienceLevel,
        collegeOrEmployer: profileForm.collegeOrEmployer,
        targetCompanies,
        targetSalaryBracket: profileForm.targetSalaryBracket,
        preferredLanguages,
        primaryFocusAreas,
        resumeUrl: profileForm.resumeUrl,
        linkedinUrl: profileForm.linkedinUrl,
        githubUrl: profileForm.githubUrl,
      });

      if (currentUser) {
        currentUser.fullName = profileForm.fullName;
        currentUser.candidateProfile = res.candidateProfile;
      }

      setIsProfileModalOpen(false);
      setActionAlert({ type: 'success', message: 'Candidate profile and preparation preferences saved successfully!' });
    } catch (err: any) {
      setActionAlert({ type: 'error', message: err.message || 'Failed to update candidate profile' });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleOpenScorecard = async (booking: Booking) => {
    setScorecardBooking(booking);
    setLoadingScorecard(true);
    try {
      const res = await api.getBookingDetails(booking.id);
      setScorecardFeedback(res.feedback || null);
    } catch (err) {
      console.error('Failed to load scorecard:', err);
    } finally {
      setLoadingScorecard(false);
    }
  };

  const handleReportAbsent = async (bookingId: string) => {
    if (!window.confirm('Confirm escalation: Has the assigned interviewer failed to attend or check-in for this session? This will register an official strike warning and escalate to platform admin.')) {
      return;
    }

    try {
      const res = await api.reportInterviewerAbsent(bookingId, 'Candidate escalated: Interviewer absent or did not check-in 10 minutes prior to session');
      setActionAlert({
        type: 'success',
        message: `Attendance warning #${res.warningCount} issued to interviewer. Admin notified. ${res.isBlocked ? 'Interviewer automatically blocked after 3 strikes.' : ''}`,
      });
      loadData();
    } catch (err: any) {
      setActionAlert({ type: 'error', message: err.message || 'Failed to report interviewer absence' });
    }
  };

  const handleOpenRefundModal = (bookingId: string) => {
    setRefundBookingId(bookingId);
    setRefundReason('Interviewer did not attend session / Session cancelled');
    setIsRefundModalOpen(true);
  };

  const handleSubmitRefund = async () => {
    if (!refundBookingId) return;
    setRefundSubmitting(true);
    setActionAlert(null);

    try {
      const res = await api.requestBookingRefund(refundBookingId, refundReason);
      setIsRefundModalOpen(false);
      setActionAlert({ type: 'success', message: res.message || 'Refund successfully processed to your account!' });
      loadData();
    } catch (err: any) {
      setActionAlert({ type: 'error', message: err.message || 'Refund request failed' });
    } finally {
      setRefundSubmitting(false);
    }
  };

  const handleOpenDisputeModal = (bookingId: string) => {
    setDisputeBookingId(bookingId);
    setDisputeReason('');
    setIsDisputeModalOpen(true);
  };

  const handleSubmitDispute = async () => {
    if (!disputeBookingId || !disputeReason.trim()) {
      alert('Please explain the reason for your complaint.');
      return;
    }
    setDisputeSubmitting(true);
    setActionAlert(null);

    try {
      const res = await api.fileBookingDispute(disputeBookingId, disputeCategory, disputeReason.trim(), disputeResolution);
      setIsDisputeModalOpen(false);
      setActionAlert({ type: 'success', message: res.message || 'Complaint filed and registered with platform administration.' });
      loadData();
    } catch (err: any) {
      setActionAlert({ type: 'error', message: err.message || 'Failed to submit complaint' });
    } finally {
      setDisputeSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Action Notification Alert */}
      {actionAlert && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between transition-all ${
            actionAlert.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center space-x-2 text-xs font-semibold">
            {actionAlert.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
            <span>{actionAlert.message}</span>
          </div>
          <button onClick={() => setActionAlert(null)} className="text-xs opacity-75 hover:opacity-100">
            ✕
          </button>
        </div>
      )}

      {/* Profile Completion Bar Banner */}
      <div className="p-5 rounded-2xl bg-indigo-950/30 border border-indigo-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5 flex-1">
          <div className="flex items-center justify-between max-w-md">
            <span className="text-xs font-bold text-indigo-300 flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Candidate Profile & Preparation Readiness</span>
            </span>
            <span className="text-xs font-extrabold text-indigo-400">{completionPercent}% Complete</span>
          </div>
          <div className="w-full max-w-md h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-500"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-400">
            {completionPercent < 100
              ? 'Complete your dream companies, target CTC, and focus areas to get tailored interviewer matching.'
              : 'Your profile is fully completed and optimized for top technical interview matching!'}
          </p>
        </div>

        <button
          onClick={() => setIsProfileModalOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/30 transition flex items-center space-x-2 shrink-0 self-start sm:self-center"
        >
          <Briefcase className="w-4 h-4" />
          <span>{completionPercent < 100 ? 'Complete Profile Questionnaire' : 'Edit Profile & Goals'}</span>
        </button>
      </div>

      {/* Financial & Spending Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <div className="text-[11px] font-semibold text-slate-400 flex items-center space-x-1.5">
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            <span>Total Spent</span>
          </div>
          <div className="text-2xl font-extrabold text-white">₹{totalSpent}</div>
          <p className="text-[10px] text-slate-500">Practice session investments</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <div className="text-[11px] font-semibold text-slate-400 flex items-center space-x-1.5">
            <Award className="w-3.5 h-3.5 text-indigo-400" />
            <span>Completed Sessions</span>
          </div>
          <div className="text-2xl font-extrabold text-white">{completedBookings.length}</div>
          <p className="text-[10px] text-slate-500">With detailed rubrics & feedback</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <div className="text-[11px] font-semibold text-slate-400 flex items-center space-x-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Active Queue & Up Next</span>
          </div>
          <div className="text-2xl font-extrabold text-white">{activeBookings.length}</div>
          <p className="text-[10px] text-slate-500">{myQueue.inQueue ? 'Currently waiting in queue' : 'No pending queue wait'}</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <div className="text-[11px] font-semibold text-slate-400 flex items-center space-x-1.5">
            <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
            <span>Processed Refunds</span>
          </div>
          <div className="text-2xl font-extrabold text-white">₹{totalRefunded}</div>
          <p className="text-[10px] text-slate-500">100% money-back guarantee</p>
        </div>
      </div>

      {/* Active Queue Banner if Candidate is in Queue */}
      {myQueue.inQueue && myQueue.entry && (
        <div className="rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 p-5 sm:p-6 shadow-xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                <span>Real-Time Matching Queue Active</span>
              </div>
              <h3 className="text-xl font-extrabold text-white">
                Queue Position #{myQueue.position || 1} • {myQueue.entry.trackName}
              </h3>
              <p className="text-xs text-slate-300">
                Round: <span className="font-semibold text-white">{myQueue.entry.roundName}</span> • Estimated claim wait: ~{myQueue.estimatedWaitMins || 2} mins.
              </p>
            </div>

            <div className="flex items-center space-x-3 shrink-0">
              <button
                onClick={onOpenQueueTracker}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs shadow-lg transition flex items-center space-x-1.5"
              >
                <Zap className="w-4 h-4 fill-slate-950" />
                <span>Open Live Queue Tracker</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upcoming / Next Scheduled Interviews */}
      {activeBookings.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center space-x-2">
              <Clock className="w-5 h-5 text-indigo-400" />
              <span>Upcoming & Active Sessions ({activeBookings.length})</span>
            </h2>
            <span className="text-xs text-slate-400">Real-time WebRTC Meeting Space</span>
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
                      {b.interviewerName || 'Searching eligible interviewers in queue...'}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Session Duration:</span>
                    <span className="font-semibold text-white">{b.roundDurationMins} minutes</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Interviewer Check-In:</span>
                    <span className={b.interviewerAttendedAt ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
                      {b.interviewerAttendedAt ? 'Checked In & Ready' : 'Pending 10-Min Check-In'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    onClick={() => onOpenWorkspace(b.id)}
                    className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition flex items-center justify-center space-x-1.5"
                  >
                    <Video className="w-4 h-4" />
                    <span>Join Workspace Room</span>
                  </button>

                  {/* 10-Min Pre-Session Late/No-Show Escalation */}
                  {b.interviewerId && (
                    <button
                      onClick={() => handleReportAbsent(b.id)}
                      className="px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-300 text-xs font-semibold transition flex items-center space-x-1"
                      title="If interviewer has not attended within 10 minutes of session"
                    >
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                      <span>Report Absent (&gt;10 min)</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleOpenRefundModal(b.id)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition text-xs"
                    title="Request Refund"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Previous Interviews & Scorecard Archive */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <FileCheck2 className="w-5 h-5 text-indigo-400" />
            <span>Previous Interviews & Performance Scorecards</span>
          </h2>
          <span className="text-xs text-slate-400">{pastBookings.length} total recorded</span>
        </div>

        {pastBookings.length === 0 ? (
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-8 text-center space-y-3">
            <Award className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-300">No past interviews recorded yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Once you complete your practice interviews, detailed evaluation rubrics, overall scores, and scorecard archives will be shown here.
            </p>
            <button
              onClick={() => onNavigateToCatalog()}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition"
            >
              Browse Tracks & Book Mock Interview
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {pastBookings.map((b) => (
              <div
                key={b.id}
                className="rounded-2xl bg-slate-900 border border-slate-800 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-slate-700 transition"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        b.status === 'COMPLETED'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : b.status === 'REFUNDED'
                          ? 'bg-rose-500/20 text-rose-300'
                          : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      {b.status.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-slate-400">Ref: {b.bookingRef}</span>
                    <span className="text-xs text-slate-500">•</span>
                    <span className="text-xs text-slate-400">
                      {new Date(b.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-white">
                    {b.trackName} — {b.roundName}
                  </h4>
                  <p className="text-xs text-slate-400">
                    Interviewer: <span className="text-slate-200 font-medium">{b.interviewerName || 'Assigned Interviewer'}</span> • Amount: ₹{b.totalAmount}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {b.status === 'COMPLETED' && (
                    <button
                      onClick={() => handleOpenScorecard(b)}
                      className="px-4 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-xs font-semibold transition flex items-center space-x-1.5"
                    >
                      <FileCheck2 className="w-4 h-4" />
                      <span>View Scorecard & Rubrics</span>
                    </button>
                  )}

                  {b.status === 'COMPLETED' && (
                    <button
                      onClick={() => onOpenReview(b.id)}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-semibold transition flex items-center space-x-1"
                    >
                      <Star className="w-3.5 h-3.5 fill-amber-300" />
                      <span>Rate</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleOpenDisputeModal(b.id)}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition flex items-center space-x-1"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-rose-400" />
                    <span>Report / Dispute</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Candidate Profile Questionnaire Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Complete Candidate Profile Questionnaire</h3>
                  <p className="text-xs text-slate-400">Share your goals to get matched with the most relevant interviewers</p>
                </div>
              </div>
              <button onClick={() => setIsProfileModalOpen(false)} className="text-slate-400 hover:text-white text-lg">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Full Legal Name:</label>
                  <input
                    type="text"
                    required
                    value={profileForm.fullName}
                    onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Experience Level:</label>
                  <select
                    value={profileForm.experienceLevel}
                    onChange={(e) => setProfileForm({ ...profileForm, experienceLevel: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="STUDENT">Student / Campus</option>
                    <option value="FRESHER">Fresher / Graduate</option>
                    <option value="1-3_YEARS">1–3 Years Experience (SDE 1)</option>
                    <option value="3-5_YEARS">3–5 Years Experience (SDE 2 / Mid)</option>
                    <option value="5+_YEARS">5+ Years Experience (Senior / Staff)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Target Engineering Roles:</label>
                  <input
                    type="text"
                    placeholder="e.g. Software Engineer, Backend, Full-Stack"
                    value={profileForm.targetRoles}
                    onChange={(e) => setProfileForm({ ...profileForm, targetRoles: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Target CTC / Salary Bracket:</label>
                  <select
                    value={profileForm.targetSalaryBracket}
                    onChange={(e) => setProfileForm({ ...profileForm, targetSalaryBracket: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Under 8 LPA">Under 8 LPA (Entry / Campus / Services)</option>
                    <option value="8–18 LPA">8–18 LPA (Standard Product Role)</option>
                    <option value="18–35 LPA">18–35 LPA (High-Growth Unicorn)</option>
                    <option value="35+ LPA">35+ LPA (Top-Tier Tech / Senior Role)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Current College or Employer:</label>
                  <input
                    type="text"
                    placeholder="e.g. IIT Delhi, BITS Pilani, or current firm"
                    value={profileForm.collegeOrEmployer}
                    onChange={(e) => setProfileForm({ ...profileForm, collegeOrEmployer: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Dream Target Companies:</label>
                  <input
                    type="text"
                    placeholder="e.g. Google, Uber, Swiggy, Razorpay, Stripe"
                    value={profileForm.targetCompanies}
                    onChange={(e) => setProfileForm({ ...profileForm, targetCompanies: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Preferred Languages for Coding:</label>
                  <input
                    type="text"
                    placeholder="e.g. Python, Java, C++, TypeScript, Go"
                    value={profileForm.preferredLanguages}
                    onChange={(e) => setProfileForm({ ...profileForm, preferredLanguages: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Target Focus / Weakness Areas:</label>
                  <input
                    type="text"
                    placeholder="e.g. Dynamic Programming, Graphs, Low-Level Design"
                    value={profileForm.primaryFocusAreas}
                    onChange={(e) => setProfileForm({ ...profileForm, primaryFocusAreas: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Resume Link (Drive/Dropbox):</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={profileForm.resumeUrl}
                    onChange={(e) => setProfileForm({ ...profileForm, resumeUrl: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">LinkedIn Profile:</label>
                  <input
                    type="url"
                    placeholder="https://linkedin.com/in/..."
                    value={profileForm.linkedinUrl}
                    onChange={(e) => setProfileForm({ ...profileForm, linkedinUrl: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">GitHub / Portfolio:</label>
                  <input
                    type="url"
                    placeholder="https://github.com/..."
                    value={profileForm.githubUrl}
                    onChange={(e) => setProfileForm({ ...profileForm, githubUrl: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Short Candidate Bio / Overview:</label>
                <textarea
                  rows={2}
                  placeholder="Tell your interviewer about your background and what you are preparing for..."
                  value={profileForm.bio}
                  onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/30 transition flex items-center space-x-1.5"
                >
                  {profileSaving ? <span>Saving Profile...</span> : <span>Save Candidate Profile</span>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detailed Scorecard Modal */}
      {scorecardBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                  VERIFIED EVALUATION
                </span>
                <h3 className="text-lg font-bold text-white mt-1">
                  Scorecard: {scorecardBooking.trackName} — {scorecardBooking.roundName}
                </h3>
                <p className="text-xs text-slate-400">Ref: {scorecardBooking.bookingRef} • Evaluator: {scorecardBooking.interviewerName}</p>
              </div>
              <button onClick={() => setScorecardBooking(null)} className="text-slate-400 hover:text-white text-lg">
                ✕
              </button>
            </div>

            {loadingScorecard ? (
              <div className="p-8 text-center text-slate-400">Loading comprehensive evaluation rubrics...</div>
            ) : scorecardFeedback ? (
              <div className="space-y-4 text-xs">
                {/* Overall Score */}
                <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Overall Performance</div>
                    <div className="text-2xl font-extrabold text-white mt-0.5">{scorecardFeedback.overallScore} / 5.0</div>
                  </div>
                  <div className="px-3 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold">
                    {scorecardFeedback.practiceReadiness || 'JOB_READY'}
                  </div>
                </div>

                {/* Rubrics Criteria Breakdown */}
                {scorecardFeedback.criteriaScores && scorecardFeedback.criteriaScores.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-bold text-slate-300">Rubric Criteria Breakdown:</h4>
                    <div className="space-y-1.5">
                      {scorecardFeedback.criteriaScores.map((c: any, i: number) => (
                        <div key={i} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                          <span className="font-medium text-slate-200">{c.criteriaName || c.name || `Criterion ${i + 1}`}</span>
                          <span className="font-extrabold text-indigo-400">{c.score} / 5.0</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Qualitative Feedback */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <div className="font-bold text-emerald-400">Key Strengths:</div>
                  <p className="text-slate-300 leading-relaxed">{scorecardFeedback.strengths}</p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <div className="font-bold text-amber-400">Areas to Improve:</div>
                  <p className="text-slate-300 leading-relaxed">{scorecardFeedback.improvementAreas}</p>
                </div>

                {scorecardFeedback.recommendedTopics && scorecardFeedback.recommendedTopics.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                    <div className="font-bold text-indigo-400">Recommended Topics to Study:</div>
                    <div className="flex flex-wrap gap-1.5">
                      {scorecardFeedback.recommendedTopics.map((t: string, i: number) => (
                        <span key={i} className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px]">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 text-center text-slate-400">
                Evaluation feedback has not yet been submitted by the interviewer for this session.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dispute / Complaint Modal */}
      {isDisputeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-5 h-5 text-rose-400" />
                <h3 className="text-base font-bold text-white">File Interview Dispute / Complaint</h3>
              </div>
              <button onClick={() => setIsDisputeModalOpen(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Issue Category:</label>
                <select
                  value={disputeCategory}
                  onChange={(e) => setDisputeCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="INTERVIEWER_ABSENT">Interviewer Did Not Attend / Absent</option>
                  <option value="AUDIO_VIDEO_ISSUE">Meeting Audio / Video Technical Failure</option>
                  <option value="LOW_FEEDBACK_QUALITY">Unsatisfactory / Incomplete Evaluation Feedback</option>
                  <option value="UNPROFESSIONAL_BEHAVIOR">Unprofessional Conduct</option>
                  <option value="OTHER">Other Issue</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Detailed Description:</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Explain what went wrong in detail..."
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Requested Resolution:</label>
                <select
                  value={disputeResolution}
                  onChange={(e) => setDisputeResolution(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="REFUND">Full Payment Refund (100% money back)</option>
                  <option value="RESCHEDULE">Free Session Reschedule with Senior Interviewer</option>
                </select>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsDisputeModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={disputeSubmitting || !disputeReason.trim()}
                  onClick={handleSubmitDispute}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs shadow-md transition"
                >
                  {disputeSubmitting ? 'Filing Complaint...' : 'Submit to Admin Review'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Refund Request Modal */}
      {isRefundModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <RotateCcw className="w-5 h-5 text-rose-400" />
                <h3 className="text-base font-bold text-white">Request Session Refund</h3>
              </div>
              <button onClick={() => setIsRefundModalOpen(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-300">
                Under Interview Arena's 100% money-back guarantee, unfulfilled or no-show practice sessions are eligible for a full refund back to your original payment method.
              </p>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Reason for Refund:</label>
                <input
                  type="text"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsRefundModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={refundSubmitting}
                  onClick={handleSubmitRefund}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs shadow-md transition"
                >
                  {refundSubmitting ? 'Processing Refund...' : 'Confirm Full Refund'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
