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
  UserCheck,
  Award,
  Sparkles,
  FileEdit,
  X,
  AlertTriangle,
  ShieldX,
  Radio,
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
  const [application, setApplication] = useState<any>(null);
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

  // Tab State
  const [activeTab, setActiveTab] = useState<'queue' | 'scheduled' | 'calendar' | 'earnings'>('queue');
  const [scheduledRequests, setScheduledRequests] = useState<(Booking & { isBlockedForMe: boolean; blockedReason?: string })[]>([]);
  const [acceptingScheduledId, setAcceptingScheduledId] = useState<string | null>(null);

  // Calendar State
  const [blockedSlots, setBlockedSlots] = useState<any[]>([]);
  const [bookedCalendarSessions, setBookedCalendarSessions] = useState<Booking[]>([]);
  const [isAddingSlot, setIsAddingSlot] = useState(false);
  const [newSlotForm, setNewSlotForm] = useState({
    title: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '14:00',
    endTime: '16:00',
    reason: '',
  });

  // Profile Questionnaire state
  const [isQuestionnaireOpen, setIsQuestionnaireOpen] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    headline: '',
    bio: '',
    currentCompany: '',
    currentRole: '',
    experienceYears: 5,
    skills: '',
    primaryInterviewDomains: [] as string[],
    preferredTiers: [] as string[],
    upiId: '',
    linkedinUrl: '',
    githubUrl: '',
  });

  // Check-in state
  const [checkingInId, setCheckingInId] = useState<string | null>(null);
  const [checkInNotice, setCheckInNotice] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 4000); // sync live queue & calendar
    return () => clearInterval(interval);
  }, [currentUser?.id]);

  const loadData = async () => {
    try {
      const [profRes, queueRes, earnRes, bookingsRes, calendarRes, schedRes] = await Promise.all([
        api.getInterviewerProfile(),
        api.getQueue(),
        api.getInterviewerEarnings(),
        api.getBookings(),
        api.getInterviewerCalendar().catch(() => ({ bookedSessions: [], blockedSlots: [], availabilitySlots: [] })),
        api.getScheduledRequests().catch(() => ({ scheduledRequests: [] })),
      ]);

      const prof = profRes.profile;
      setProfile(prof);
      if (profRes.application) setApplication(profRes.application);
      setIsAvailable(prof?.isAvailable || false);
      setQueue(queueRes.queue || []);
      setEarnings(earnRes.earnings);
      setPayoutUpi(prof?.upiId || 'sarah.chen@okhdfcbank');
      setBlockedSlots(calendarRes.blockedSlots || []);
      setBookedCalendarSessions(calendarRes.bookedSessions || []);
      setScheduledRequests(schedRes.scheduledRequests || []);

      if (prof) {
        setProfileForm({
          headline: prof.headline || '',
          bio: prof.bio || '',
          currentCompany: prof.currentCompany || '',
          currentRole: prof.currentRole || '',
          experienceYears: prof.experienceYears || 5,
          skills: Array.isArray(prof.skills) ? prof.skills.join(', ') : '',
          primaryInterviewDomains: prof.primaryInterviewDomains || ['System Design', 'Data Structures & Algorithms'],
          preferredTiers: prof.preferredTiers || ['TIER_A', 'TIER_B'],
          upiId: prof.upiId || '',
          linkedinUrl: prof.linkedinUrl || '',
          githubUrl: prof.githubUrl || '',
        });
      }

      const myActive = (bookingsRes.bookings || []).filter(
        (b) => b.interviewerId === currentUser?.id && ['CLAIMED', 'READY', 'IN_PROGRESS'].includes(b.status)
      );
      setActiveBookings(myActive);
    } catch (err) {
      console.error('Failed to load interviewer dashboard data:', err);
    }
  };

  const handleAcceptScheduledSession = async (bookingId: string) => {
    setAcceptingScheduledId(bookingId);
    setClaimError(null);
    try {
      const res = await api.acceptScheduledBooking(bookingId);
      if (res.success) {
        loadData();
        onOpenWorkspace(res.booking.id);
      }
    } catch (err: any) {
      setClaimError(err.message || 'Failed to accept scheduled session.');
      loadData();
    } finally {
      setAcceptingScheduledId(null);
    }
  };

  const handleAddBlockedSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.addInterviewerBlockedSlot(newSlotForm);
      setNewSlotForm({
        title: '',
        date: new Date().toISOString().split('T')[0],
        startTime: '14:00',
        endTime: '16:00',
        reason: '',
      });
      setIsAddingSlot(false);
      loadData();
    } catch (err: any) {
      setClaimError(err.message || 'Failed to add blocked slot.');
    }
  };

  const handleRemoveBlockedSlot = async (slotId: string) => {
    try {
      await api.removeInterviewerBlockedSlot(slotId);
      loadData();
    } catch (err: any) {
      setClaimError(err.message || 'Failed to unblock slot.');
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
      setClaimError(err.message || 'This session was already claimed or calendar blocked.');
      loadData();
    } finally {
      setClaimingId(null);
    }
  };

  const handleInterviewerCheckIn = async (bookingId: string) => {
    setCheckingInId(bookingId);
    try {
      const res = await api.interviewerCheckIn(bookingId);
      setCheckInNotice(res.message);
      loadData();
      setTimeout(() => setCheckInNotice(null), 5000);
    } catch (err: any) {
      setClaimError(err.message || 'Check-in failed');
    } finally {
      setCheckingInId(null);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      const skillsArray = profileForm.skills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await api.updateInterviewerProfile({
        ...profileForm,
        skills: skillsArray,
        experienceYears: Number(profileForm.experienceYears) || 1,
      });

      setProfile(res.profile);
      setIsQuestionnaireOpen(false);
    } catch (err: any) {
      setClaimError(err.message || 'Failed to update interviewer profile');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleToggleDomain = (domain: string) => {
    setProfileForm((prev) => ({
      ...prev,
      primaryInterviewDomains: prev.primaryInterviewDomains.includes(domain)
        ? prev.primaryInterviewDomains.filter((d) => d !== domain)
        : [...prev.primaryInterviewDomains, domain],
    }));
  };

  const handleToggleTierPref = (tierCode: string) => {
    setProfileForm((prev) => ({
      ...prev,
      preferredTiers: prev.preferredTiers.includes(tierCode)
        ? prev.preferredTiers.filter((t) => t !== tierCode)
        : [...prev.preferredTiers, tierCode],
    }));
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
  const isBlocked = profile?.isBlockedByAdmin || (profile?.warningCount || 0) >= 3;
  const isCalendarBlocked = Boolean(profile?.activeSessionId || activeBookings.length > 0);
  const profileCompletion = profile?.profileCompletionPercent || 50;

  return (
    <div className="space-y-8 pb-16">
      {/* Top Header & Availability Radar */}
      <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 sm:p-8 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center space-x-2">
            <span
              className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                isBlocked
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                  : isApproved
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
              }`}
            >
              {isBlocked
                ? 'ACCOUNT BLOCKED'
                : isApproved
                ? 'APPROVED INTERVIEWER'
                : `STATUS: ${profile?.status || 'SUBMITTED'}`}
            </span>
            <span className="text-xs text-indigo-400 font-bold bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
              50% Revenue Share
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
            {currentUser?.fullName} — Interviewer Portal
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
            {profile?.headline || 'Senior Software Engineer'} • {profile?.experienceYears || 5} Years Experience
          </p>

          <div className="mt-3 flex items-center space-x-3">
            <button
              onClick={() => setIsQuestionnaireOpen(true)}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/40 text-indigo-200 border border-indigo-500/30 flex items-center space-x-1.5 transition"
            >
              <FileEdit className="w-3.5 h-3.5" />
              <span>Complete Profile Questionnaire</span>
            </button>
            <span className="text-xs text-slate-400">
              Profile: <span className="font-bold text-white">{profileCompletion}% Complete</span>
            </span>
          </div>
        </div>

        {/* Availability Toggle */}
        <div className="flex items-center space-x-4 bg-slate-950 p-4 rounded-2xl border border-slate-800 shrink-0">
          <div>
            <div className="text-xs font-bold text-white flex items-center space-x-1.5">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isBlocked
                    ? 'bg-rose-500'
                    : isAvailable
                    ? 'bg-emerald-400 animate-pulse'
                    : 'bg-slate-500'
                }`}
              />
              <span>
                {isBlocked
                  ? 'Account Blocked'
                  : isAvailable
                  ? 'Online & Available'
                  : 'Currently Offline'}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {isBlocked
                ? 'Attendance strike limit exceeded'
                : isCalendarBlocked
                ? 'Calendar locked during active session'
                : isAvailable
                ? 'Receiving real-time match requests'
                : 'Toggle on to accept queue requests'}
            </div>
          </div>

          <button
            onClick={handleToggleAvailability}
            disabled={!isApproved || isBlocked}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-md ${
              !isApproved || isBlocked
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

      {/* Account Blocked Alert */}
      {isBlocked && (
        <div className="rounded-2xl bg-rose-500/10 border-2 border-rose-500/40 p-5 space-y-2">
          <div className="flex items-center space-x-3 text-rose-300">
            <ShieldX className="w-6 h-6 shrink-0" />
            <div>
              <h4 className="font-extrabold text-white text-base">Account Suspended / Blocked</h4>
              <p className="text-xs text-rose-200/90 mt-0.5">
                You have accumulated {profile?.warningCount || 3} attendance warnings or were blocked by an administrator for missed sessions. You cannot claim new sessions until an administrator reviews and clears your strikes.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Calendar Block Active Notice */}
      {isCalendarBlocked && !isBlocked && (
        <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-4 flex items-center justify-between gap-4">
          <div className="flex items-center space-x-3 text-amber-300 text-xs">
            <Lock className="w-5 h-5 shrink-0 text-amber-400" />
            <div>
              <span className="font-bold text-white text-sm block">Calendar Block Active (Double-Booking Protection)</span>
              <span>
                You currently have an active booked session. Your calendar is locked so you cannot claim additional sessions until the active mock interview and feedback rubric are finalized.
              </span>
            </div>
          </div>
          <span className="text-[11px] font-bold px-3 py-1 bg-amber-500/20 text-amber-300 rounded-lg shrink-0 border border-amber-500/30">
            Calendar Locked
          </span>
        </div>
      )}

      {/* Check-In Success Notification */}
      {checkInNotice && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{checkInNotice}</span>
        </div>
      )}

      {/* 3-Screening Quality Bar Banner for Interviewers Under Review */}
      {!isApproved && !isBlocked && (
        <div className="rounded-3xl bg-gradient-to-r from-amber-950/40 via-slate-900 to-indigo-950/40 border-2 border-amber-500/30 p-6 sm:p-7 space-y-5 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div className="flex items-start space-x-3.5">
              <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h4 className="font-extrabold text-white text-lg">
                    {profile?.status === 'UNDER_REVIEW'
                      ? 'Interviewer Status: Under Active Review'
                      : 'Interviewer Screening in Progress'}
                  </h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    3 Mandatory Interviews Required
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                  To uphold our top-tier mock interview quality, every interviewer under review must complete and clear all <strong>3 screening interviews</strong> before being approved:
                  <strong className="text-white"> 1. Technical Coding</strong>, <strong className="text-white"> 2. System Architecture</strong>, and <strong className="text-white"> 3. Bar-Raiser & Calibration</strong>.
                </p>
              </div>
            </div>

            <button
              onClick={onNavigateToApplication}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shrink-0 shadow-md transition flex items-center space-x-1.5"
            >
              <span>Track Screening Status</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* 3-Round Progress Tracker */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {/* Round 1 */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
              <div className="flex justify-between items-center font-bold text-white">
                <span>1. Technical Coding</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded ${
                    application?.screening1?.status === 'COMPLETED'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : application?.screening1?.status === 'SCHEDULED'
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {application?.screening1?.status || 'PENDING'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {application?.screening1?.notes || 'Live code walkthrough & algorithmic depth.'}
              </p>
              {application?.screening1?.score && (
                <div className="text-[11px] font-bold text-emerald-400">
                  Score: {application.screening1.score}/10
                </div>
              )}
            </div>

            {/* Round 2 */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
              <div className="flex justify-between items-center font-bold text-white">
                <span>2. System Architecture</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded ${
                    application?.screening2?.status === 'COMPLETED'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : application?.screening2?.status === 'SCHEDULED'
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {application?.screening2?.status || 'PENDING'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {application?.screening2?.notes || 'Distributed systems design & failure trade-offs.'}
              </p>
              {application?.screening2?.score && (
                <div className="text-[11px] font-bold text-emerald-400">
                  Score: {application.screening2.score}/10
                </div>
              )}
            </div>

            {/* Round 3 */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
              <div className="flex justify-between items-center font-bold text-white">
                <span>3. Bar-Raiser & Calibration</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded ${
                    application?.screening3?.status === 'COMPLETED'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : application?.screening3?.status === 'SCHEDULED'
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {application?.screening3?.status || 'PENDING'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {application?.screening3?.notes || 'Standard rubric scoring, feedback accuracy & calibration.'}
              </p>
              {application?.screening3?.score && (
                <div className="text-[11px] font-bold text-emerald-400">
                  Score: {application.screening3.score}/10
                </div>
              )}
            </div>
          </div>
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

      {/* Active Claimed Sessions & Pre-session Check-In */}
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

                <div className="p-3 rounded-xl bg-slate-950 text-xs space-y-1.5 border border-slate-800">
                  <div className="flex justify-between text-slate-300">
                    <span>Candidate:</span>
                    <span className="font-semibold text-white">{b.candidateName}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Role & Language:</span>
                    <span className="text-slate-300">{b.jobRole} • {b.preferredLanguage}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Booking Ref:</span>
                    <span className="font-mono text-slate-400">{b.bookingRef}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-slate-800 text-xs">
                    <span>Attendance Status:</span>
                    {b.interviewerAttendedAt ? (
                      <span className="text-emerald-400 font-bold flex items-center space-x-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Checked-In (On-Time)</span>
                      </span>
                    ) : (
                      <span className="text-amber-400 font-semibold flex items-center space-x-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Check-In Pending (10m rule)</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {!b.interviewerAttendedAt && (
                    <button
                      onClick={() => handleInterviewerCheckIn(b.id)}
                      disabled={checkingInId === b.id}
                      className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition flex items-center space-x-1.5 shrink-0"
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>{checkingInId === b.id ? 'Checking In...' : 'Check-In Now'}</span>
                    </button>
                  )}

                  <button
                    onClick={() => onOpenWorkspace(b.id)}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition flex items-center justify-center space-x-2"
                  >
                    <Video className="w-4 h-4" />
                    <span>Enter Live Meeting Workspace</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Attendance & 3-Strike Warning System Card */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>Attendance & Punctuality Record</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Interviewers must check in at least 10 minutes prior to session start. 3 strikes result in automatic account block and admin review.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-400">Strikes:</span>
            <div className="flex items-center space-x-1">
              {[1, 2, 3].map((num) => {
                const strikeCount = profile?.warningCount || 0;
                const hasStrike = strikeCount >= num;
                return (
                  <span
                    key={num}
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border ${
                      hasStrike
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                        : 'bg-slate-800 text-slate-500 border-slate-700'
                    }`}
                  >
                    {num}
                  </span>
                );
              })}
            </div>
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded ${
                (profile?.warningCount || 0) >= 3
                  ? 'bg-rose-500/20 text-rose-300'
                  : (profile?.warningCount || 0) > 0
                  ? 'bg-amber-500/20 text-amber-300'
                  : 'bg-emerald-500/20 text-emerald-300'
              }`}
            >
              {profile?.warningCount || 0} / 3 Strikes
            </span>
          </div>
        </div>

        {profile?.warnings && profile.warnings.length > 0 ? (
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <div className="text-xs font-semibold text-slate-300">Logged Attendance Warnings:</div>
            {profile.warnings.map((w: any) => (
              <div
                key={w.id}
                className="p-3 rounded-xl bg-slate-950 border border-rose-500/20 text-xs flex items-center justify-between"
              >
                <div>
                  <span className="font-semibold text-rose-300">{w.reason}</span>
                  <span className="text-slate-500 text-[11px] block">
                    Session Ref: {w.bookingRef}
                  </span>
                </div>
                <span className="text-slate-400 text-[11px]">
                  {new Date(w.createdAt).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-emerald-400 flex items-center space-x-1.5 pt-1">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Clean attendance record! Keep attending scheduled mocks on-time to maintain 100% standing.</span>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('queue')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
            activeTab === 'queue'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <Zap className="w-4 h-4 text-amber-400" />
          <span>Real-Time Queue ({queue.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('scheduled')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
            activeTab === 'scheduled'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <Calendar className="w-4 h-4 text-indigo-400" />
          <span>Scheduled Requests ({scheduledRequests.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('calendar')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
            activeTab === 'calendar'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <Clock className="w-4 h-4 text-emerald-400" />
          <span>My Calendar & Blocked Slots ({blockedSlots.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('earnings')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
            activeTab === 'earnings'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <Wallet className="w-4 h-4 text-amber-300" />
          <span>Earnings & Payouts</span>
        </button>
      </div>

      {/* TAB 1: Real-Time Queue */}
      {activeTab === 'queue' && (
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
                        {item.tierCode === 'TIER_A'
                          ? 'FAANG & Elite Unicorn'
                          : item.tierCode === 'TIER_B'
                          ? 'Product & High-Growth'
                          : 'Foundation & Services'}
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
                        <span>Your Payout (50%):</span>
                        <span className="font-extrabold text-emerald-400 text-sm">
                          ₹{item.expectedCompensation}.00
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleClaimSession(item.bookingId)}
                    disabled={
                      !isApproved ||
                      isBlocked ||
                      isCalendarBlocked ||
                      claimingId === item.bookingId
                    }
                    className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold text-xs shadow-md shadow-indigo-600/30 transition flex items-center justify-center space-x-1.5"
                  >
                    {claimingId === item.bookingId ? (
                      <span>Claiming session...</span>
                    ) : isBlocked ? (
                      <span className="flex items-center space-x-1">
                        <ShieldX className="w-3.5 h-3.5" />
                        <span>Account Blocked</span>
                      </span>
                    ) : isCalendarBlocked ? (
                      <span className="flex items-center space-x-1">
                        <Lock className="w-3.5 h-3.5" />
                        <span>Calendar Blocked (Ongoing Session)</span>
                      </span>
                    ) : !isApproved ? (
                      <span className="flex items-center space-x-1">
                        <Lock className="w-3.5 h-3.5" />
                        <span>Approval Required (Clear 3 Screenings)</span>
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
      )}

      {/* TAB 2: Scheduled Requests (Notification & Accept Flow) */}
      {activeTab === 'scheduled' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-indigo-400" />
                <span>Scheduled Interview Requests Waiting for Acceptance ({scheduledRequests.length})</span>
              </h2>
              <p className="text-xs text-slate-400">
                Candidates have scheduled specific slots. If your calendar is free, accept the slot to confirm the booking.
              </p>
            </div>
          </div>

          {scheduledRequests.length === 0 ? (
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-8 text-center space-y-2">
              <Calendar className="w-8 h-8 text-slate-600 mx-auto" />
              <h3 className="text-sm font-semibold text-slate-300">No scheduled requests pending acceptance</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                When candidates schedule upcoming interview slots and your calendar is unblocked, requests will show here and you will receive instant notifications.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {scheduledRequests.map((req) => (
                <div
                  key={req.id}
                  className="rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-500/50 p-5 space-y-4 flex flex-col justify-between shadow-xl transition"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        {req.trackName}
                      </span>
                      <span className="text-xs font-semibold text-emerald-400">
                        Payout: ₹{req.interviewerEarnings}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-base font-bold text-white">{req.roundName}</h4>
                      <div className="text-xs text-slate-300 mt-1">
                        Candidate: <strong className="text-white">{req.candidateName}</strong>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1.5">
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="flex items-center space-x-1">
                          <Clock className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Scheduled Time:</span>
                        </span>
                        <span className="font-bold text-amber-300">
                          {req.scheduledAt ? new Date(req.scheduledAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Flexible'}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-400 text-[11px]">
                        <span>Role & Seniority:</span>
                        <span className="text-white">{req.jobRole} ({req.seniorityLevel || 'Mid-Level'})</span>
                      </div>
                      <div className="flex justify-between text-slate-400 text-[11px]">
                        <span>Duration:</span>
                        <span className="text-white">{req.roundDurationMins} minutes</span>
                      </div>
                    </div>

                    {req.isBlockedForMe && (
                      <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] flex items-center space-x-2">
                        <Lock className="w-3.5 h-3.5 shrink-0" />
                        <span>Calendar Blocked: {req.blockedReason || 'You have a conflicting slot or session.'}</span>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleAcceptScheduledSession(req.id)}
                    disabled={
                      !isApproved ||
                      isBlocked ||
                      req.isBlockedForMe ||
                      acceptingScheduledId === req.id
                    }
                    className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold text-xs shadow-md transition flex items-center justify-center space-x-2"
                  >
                    {acceptingScheduledId === req.id ? (
                      <span>Confirming acceptance...</span>
                    ) : req.isBlockedForMe ? (
                      <span>Slot Blocked on Calendar</span>
                    ) : !isApproved ? (
                      <span>Approval Required</span>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Accept Scheduled Interview (₹{req.interviewerEarnings})</span>
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: My Calendar & Blocked Slots */}
      {activeTab === 'calendar' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                <Clock className="w-5 h-5 text-emerald-400" />
                <span>My Calendar & Availability Management</span>
              </h2>
              <p className="text-xs text-slate-400">
                Block specific time slots for personal commitments. Admins can view your schedule, and candidate scheduling notifications are suppressed when blocked.
              </p>
            </div>

            <button
              onClick={() => setIsAddingSlot(!isAddingSlot)}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition flex items-center space-x-1.5 shadow-md"
            >
              <Calendar className="w-4 h-4" />
              <span>{isAddingSlot ? 'Cancel Block' : '+ Block a Time Slot'}</span>
            </button>
          </div>

          {/* Form to Block a Time Slot */}
          {isAddingSlot && (
            <form onSubmit={handleAddBlockedSlot} className="rounded-2xl bg-slate-950 border border-indigo-500/40 p-5 space-y-4 animate-in fade-in">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Lock className="w-4 h-4 text-amber-400" />
                <span>Block a Time Period on Your Calendar</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Title / Label:</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Doctor Visit / Personal Time"
                    value={newSlotForm.title}
                    onChange={(e) => setNewSlotForm({ ...newSlotForm, title: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Date:</label>
                  <input
                    type="date"
                    required
                    value={newSlotForm.date}
                    onChange={(e) => setNewSlotForm({ ...newSlotForm, date: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Start Time (HH:mm):</label>
                  <input
                    type="time"
                    required
                    value={newSlotForm.startTime}
                    onChange={(e) => setNewSlotForm({ ...newSlotForm, startTime: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">End Time (HH:mm):</label>
                  <input
                    type="time"
                    required
                    value={newSlotForm.endTime}
                    onChange={(e) => setNewSlotForm({ ...newSlotForm, endTime: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1 text-xs">Reason (Optional):</label>
                <input
                  type="text"
                  placeholder="e.g. In-office engineering standup & sprint review"
                  value={newSlotForm.reason}
                  onChange={(e) => setNewSlotForm({ ...newSlotForm, reason: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingSlot(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition"
                >
                  Confirm & Block Slot
                </button>
              </div>
            </form>
          )}

          {/* Blocked Slots Grid */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center justify-between">
              <span>Your Active Blocked Slots ({blockedSlots.length})</span>
              <span className="text-[11px] text-amber-400 font-normal">
                Notifications are suppressed during these periods
              </span>
            </h3>

            {blockedSlots.length === 0 ? (
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-1 text-xs text-slate-400">
                <Clock className="w-6 h-6 text-slate-600 mx-auto mb-2" />
                <p>No blocked slots on your calendar. You are open to receive all interview matching notifications.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {blockedSlots.map((slot: any) => (
                  <div
                    key={slot.id}
                    className="p-4 rounded-2xl bg-slate-900 border border-amber-500/30 space-y-2 flex flex-col justify-between shadow-lg"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-xs">{slot.title || 'Blocked Slot'}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                          {slot.date}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-300 mt-1 flex items-center space-x-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {slot.startTime} – {slot.endTime}
                        </span>
                      </div>
                      {slot.reason && (
                        <p className="text-[11px] text-slate-400 italic mt-1">{slot.reason}</p>
                      )}
                    </div>

                    <button
                      onClick={() => handleRemoveBlockedSlot(slot.id)}
                      className="w-full mt-2 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-300 font-semibold text-[11px] transition"
                    >
                      Unblock Slot
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Booked Sessions Calendar List */}
          <div className="space-y-3 pt-4 border-t border-slate-800">
            <h3 className="text-sm font-bold text-white">
              Upcoming Booked & Scheduled Sessions ({bookedCalendarSessions.length})
            </h3>

            {bookedCalendarSessions.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400 text-center">
                No sessions booked on your schedule yet.
              </div>
            ) : (
              <div className="space-y-2 text-xs">
                {bookedCalendarSessions.map((b) => (
                  <div
                    key={b.id}
                    className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-white">{b.trackName}</span>
                        <span className="text-slate-400">• {b.roundName}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            b.status === 'COMPLETED'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-indigo-500/20 text-indigo-300'
                          }`}
                        >
                          {b.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Candidate: <strong className="text-slate-300">{b.candidateName}</strong> • {b.jobRole}
                      </div>
                    </div>

                    <div className="sm:text-right text-[11px]">
                      <div className="text-amber-300 font-semibold">
                        {b.scheduledAt ? new Date(b.scheduledAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Instant Queue'}
                      </div>
                      <div className="text-emerald-400 font-bold">Earnings: ₹{b.interviewerEarnings}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: Earnings & Financial Accounting */}
      {activeTab === 'earnings' && (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <Wallet className="w-5 h-5 text-emerald-400" />
            <span>Earnings & 50% Payout Ledger</span>
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
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Recent Payout Distributions
            </h3>
            <div className="space-y-2">
              {earnings.payoutHistory.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-xs"
                >
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="font-mono text-slate-300">{p.payoutRef}</span>
                    <span className="text-slate-500">• {p.destination}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-white">₹{p.amount}.00</div>
                    <div className="text-[10px] text-emerald-400">{p.status}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      )}

      {/* Profile Questionnaire Modal */}
      {isQuestionnaireOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl p-6 sm:p-8 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center space-x-2">
                  <UserCheck className="w-5 h-5 text-indigo-400" />
                  <span>Interviewer Professional Questionnaire</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Complete your domain specialization, company history, and payout accounts to achieve 100% profile strength.
                </p>
              </div>
              <button
                onClick={() => setIsQuestionnaireOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Current Employer / Company:
                  </label>
                  <input
                    type="text"
                    required
                    value={profileForm.currentCompany}
                    onChange={(e) => setProfileForm({ ...profileForm, currentCompany: e.target.value })}
                    placeholder="e.g. Google, Microsoft, Uber"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Current Designation / Role:
                  </label>
                  <input
                    type="text"
                    required
                    value={profileForm.currentRole}
                    onChange={(e) => setProfileForm({ ...profileForm, currentRole: e.target.value })}
                    placeholder="e.g. Staff Engineer, Tech Lead"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Total Years of Experience:
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="40"
                    required
                    value={profileForm.experienceYears}
                    onChange={(e) => setProfileForm({ ...profileForm, experienceYears: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    UPI ID for 50% Payouts:
                  </label>
                  <input
                    type="text"
                    required
                    value={profileForm.upiId}
                    onChange={(e) => setProfileForm({ ...profileForm, upiId: e.target.value })}
                    placeholder="e.g. name@okhdfcbank"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Professional Headline:
                </label>
                <input
                  type="text"
                  required
                  value={profileForm.headline}
                  onChange={(e) => setProfileForm({ ...profileForm, headline: e.target.value })}
                  placeholder="e.g. Staff Software Engineer @ Google | 8+ yrs in Distributed Systems"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Primary Interview Domains (Select all that apply):
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    'Data Structures & Algorithms',
                    'System Design & Architecture',
                    'Low-Level & OOP Design',
                    'Frontend & Web Engineering',
                    'Backend & Distributed Systems',
                    'Machine Learning & AI',
                    'DevOps & Cloud Systems',
                    'Engineering Management',
                  ].map((dom) => {
                    const selected = profileForm.primaryInterviewDomains.includes(dom);
                    return (
                      <button
                        type="button"
                        key={dom}
                        onClick={() => handleToggleDomain(dom)}
                        className={`p-2.5 rounded-xl text-[11px] font-medium border text-left transition ${
                          selected
                            ? 'bg-indigo-600/30 border-indigo-500 text-white'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        {selected ? '✓ ' : '+ '}
                        {dom}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Preferred Company Tiers to Conduct:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { code: 'TIER_A', label: 'FAANG & Elite Unicorn' },
                    { code: 'TIER_B', label: 'Product & High-Growth' },
                    { code: 'TIER_C', label: 'Foundation & Services' },
                  ].map((t) => {
                    const checked = profileForm.preferredTiers.includes(t.code);
                    return (
                      <button
                        type="button"
                        key={t.code}
                        onClick={() => handleToggleTierPref(t.code)}
                        className={`p-2.5 rounded-xl text-xs font-medium border text-left transition ${
                          checked
                            ? 'bg-emerald-600/30 border-emerald-500 text-white'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        {checked ? '✓ ' : '+ '}
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Technical Skills & Frameworks (comma-separated):
                </label>
                <input
                  type="text"
                  value={profileForm.skills}
                  onChange={(e) => setProfileForm({ ...profileForm, skills: e.target.value })}
                  placeholder="e.g. Go, Java, Python, Kafka, Redis, Distributed Consensus"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    LinkedIn Profile URL:
                  </label>
                  <input
                    type="url"
                    value={profileForm.linkedinUrl}
                    onChange={(e) => setProfileForm({ ...profileForm, linkedinUrl: e.target.value })}
                    placeholder="https://linkedin.com/in/username"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    GitHub / Portfolio URL:
                  </label>
                  <input
                    type="url"
                    value={profileForm.githubUrl}
                    onChange={(e) => setProfileForm({ ...profileForm, githubUrl: e.target.value })}
                    placeholder="https://github.com/username"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Short Bio / Interviewer Philosophy:
                </label>
                <textarea
                  rows={3}
                  value={profileForm.bio}
                  onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                  placeholder="Share how you structure your interviews, your focus on problem-solving intuition, and feedback methodology..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsQuestionnaireOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/30 transition"
                >
                  {isSavingProfile ? 'Saving...' : 'Save Questionnaire'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payout Modal */}
      {showPayoutModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-white">Request Interviewer Payout (50% Share)</h3>
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
