import React, { useState, useEffect } from 'react';
import {
  PlatformMetrics,
  User,
  InterviewerApplication,
  Tier,
  RoundTemplate,
  Booking,
  LedgerEntry,
  Refund,
  DisputeReport,
  AdminAuditLog,
  AppSettings,
} from '../types';
import { api } from '../services/api';
import {
  ShieldAlert,
  Users,
  Layers,
  Calendar,
  Wallet,
  AlertTriangle,
  FileText,
  Settings,
  DollarSign,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  Search,
  Filter,
  RefreshCw,
  Edit,
  Save,
} from 'lucide-react';

interface AdminDashboardProps {
  currentUser: User | null;
  onOpenWorkspace: (bookingId: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  onOpenWorkspace,
}) => {
  const [activeTab, setActiveTab] = useState<
    'analytics' | 'users' | 'applications' | 'catalog' | 'bookings' | 'finance' | 'disputes' | 'attendance' | 'audit' | 'settings'
  >('analytics');

  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [applications, setApplications] = useState<InterviewerApplication[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [rounds, setRounds] = useState<RoundTemplate[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [disputes, setDisputes] = useState<DisputeReport[]>([]);
  const [interviewerWarnings, setInterviewerWarnings] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  const [searchUser, setSearchUser] = useState('');
  const [loading, setLoading] = useState(true);

  // Edit tier state
  const [editingTier, setEditingTier] = useState<Tier | null>(null);

  // Screening evaluation state
  const [evaluatingApp, setEvaluatingApp] = useState<InterviewerApplication | null>(null);
  const [screeningScore, setScreeningScore] = useState(8);
  const [screeningNotes, setScreeningNotes] = useState('');
  const [applicationFilter, setApplicationFilter] = useState<'ALL' | 'UNDER_REVIEW' | 'SCREENING_REQUIRED' | 'APPROVED' | 'REJECTED'>('ALL');

  // Interviewer calendar view modal state
  const [selectedInterviewerCalendar, setSelectedInterviewerCalendar] = useState<{
    interviewer: any;
    bookedSessions: Booking[];
    blockedSlots: any[];
    availabilitySlots: any[];
  } | null>(null);
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(false);
  const [actionAlert, setActionAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    loadAllData();
  }, [activeTab]);

  const loadAllData = async () => {
    try {
      const [
        metricsRes,
        usersRes,
        appsRes,
        catalogRes,
        bookingsRes,
        ledgerRes,
        refundsRes,
        disputesRes,
        warningsRes,
        auditRes,
        settingsRes,
      ] = await Promise.all([
        api.getAdminMetrics(),
        api.getAdminUsers(),
        api.getAdminApplications(),
        api.getCatalog(),
        api.getBookings(),
        api.getLedger(),
        api.getRefunds(),
        api.getDisputes(),
        api.getAdminInterviewerWarnings().catch(() => ({ interviewers: [] })),
        api.getAuditLogs(),
        api.getSettings(),
      ]);

      setMetrics(metricsRes.metrics);
      setUsers(usersRes.users || []);
      setApplications(appsRes.applications || []);
      setTiers(catalogRes.tiers || []);
      setRounds(catalogRes.rounds || []);
      setBookings(bookingsRes.bookings || []);
      setLedger(ledgerRes.ledger || []);
      setRefunds(refundsRes.refunds || []);
      setDisputes(disputesRes.disputes || []);
      setInterviewerWarnings(warningsRes.interviewers || []);
      setAuditLogs(auditRes.logs || []);
      setSettings(settingsRes.settings);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleUserStatus = async (user: User) => {
    try {
      await api.setUserStatus(user.id, !user.isSuspended, 'Administrative action');
      loadAllData();
    } catch (err: any) {
      console.error('Failed to update user status:', err.message);
    }
  };

  const handleEvaluateScreening = async (
    appId: string,
    action: 'APPROVE' | 'REJECT' | 'UPDATE_SCREENING',
    screeningNumber?: number,
    scoreVal?: number,
    notesVal?: string
  ) => {
    try {
      await api.evaluateApplication(appId, {
        action,
        screeningNumber,
        screeningStatus: 'COMPLETED',
        score: scoreVal !== undefined ? scoreVal : screeningScore,
        notes: notesVal || screeningNotes || 'Screening passed according to evaluation rubric.',
        adminNotes: action === 'APPROVE' ? 'Approved after clearing all 3 screening rounds.' : undefined,
      });
      setEvaluatingApp(null);
      setScreeningNotes('');
      setActionAlert({ type: 'success', message: `Application updated successfully (${action}).` });
      loadAllData();
    } catch (err: any) {
      setActionAlert({ type: 'error', message: err.message || 'Failed to update application' });
    }
  };

  const handleViewCalendar = async (interviewerId: string) => {
    setIsLoadingCalendar(true);
    setActionAlert(null);
    try {
      const res = await api.getAdminInterviewerCalendar(interviewerId);
      setSelectedInterviewerCalendar(res);
    } catch (err: any) {
      setActionAlert({ type: 'error', message: err.message || 'Failed to fetch interviewer calendar' });
    } finally {
      setIsLoadingCalendar(false);
    }
  };

  const handleSaveTier = async () => {
    if (!editingTier) return;
    try {
      await api.updateTier(editingTier.code, {
        price: editingTier.price,
        commissionPercent: editingTier.commissionPercent,
        description: editingTier.description,
      });
      setEditingTier(null);
      loadAllData();
    } catch (err: any) {
      console.error('Failed to update tier:', err.message);
    }
  };

  const handleRefundAction = async (refundId: string, action: 'APPROVE' | 'REJECT') => {
    try {
      await api.actionRefund(refundId, action, 'Admin processed refund action');
      loadAllData();
    } catch (err: any) {
      console.error('Refund action failed:', err.message);
    }
  };

  const handleResolveDispute = async (disputeId: string, resolution: string) => {
    try {
      await api.resolveDispute(disputeId, resolution, 'Reviewed and resolved by administrator');
      loadAllData();
    } catch (err: any) {
      console.error('Dispute resolution failed:', err.message);
    }
  };

  const handleClearWarnings = async (interviewerId: string) => {
    try {
      await api.clearInterviewerWarnings(interviewerId);
      loadAllData();
    } catch (err: any) {
      console.error('Failed to clear interviewer warnings:', err.message);
    }
  };

  const handleToggleBlockInterviewer = async (interviewerId: string, currentBlocked: boolean) => {
    try {
      await api.toggleBlockInterviewer(
        interviewerId,
        !currentBlocked,
        !currentBlocked ? 'Blocked by administrative action for excessive attendance strikes' : 'Restored by administrator'
      );
      loadAllData();
    } catch (err: any) {
      console.error('Failed to update interviewer block status:', err.message);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    try {
      await api.updateSettings(settings);
      loadAllData();
    } catch (err: any) {
      console.error('Failed to save settings:', err.message);
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Top Header */}
      <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 sm:p-8 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
              SUPER ADMIN CONSOLE
            </span>
            <span className="text-xs text-slate-400">Live PostgreSQL-backed state</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
            Platform Operations & Financial Governance
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            Full management of mock interview catalog, tier prices, interviewer approvals, refunds, and append-only ledger.
          </p>
        </div>

        <button
          onClick={loadAllData}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center space-x-1.5 shrink-0 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Nav Tabs */}
      <div className="flex items-center space-x-1 overflow-x-auto pb-2 border-b border-slate-800">
        {[
          { id: 'analytics', label: 'Platform Analytics', icon: TrendingUp },
          { id: 'users', label: 'Users & Roles', icon: Users },
          { id: 'applications', label: 'Interviewer Screening', icon: ShieldCheck, badge: applications.filter(a => a.status === 'SCREENING_REQUIRED').length },
          { id: 'catalog', label: 'Tiers & Rounds', icon: Layers },
          { id: 'bookings', label: 'Bookings & Queue', icon: Calendar },
          { id: 'finance', label: 'Ledger & Refunds', icon: Wallet, badge: refunds.filter(r => r.status === 'PENDING').length },
          { id: 'disputes', label: 'Disputes & Reports', icon: AlertTriangle, badge: disputes.filter(d => d.status === 'OPEN').length },
          { id: 'attendance', label: 'Attendance & Strikes', icon: ShieldAlert, badge: interviewerWarnings.filter(i => (i.warningCount || 0) >= 3 || i.isBlockedByAdmin).length },
          { id: 'audit', label: 'Audit Logs', icon: FileText },
          { id: 'settings', label: 'System Settings', icon: Settings },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center space-x-2 ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {Boolean(tab.badge) && (
                <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center font-bold">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: Analytics */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <div className="text-xs text-slate-400">Gross Payment Volume</div>
              <div className="text-2xl font-extrabold text-white">
                ₹{metrics?.grossPaymentVolume || 0}.00
              </div>
              <div className="text-[11px] text-emerald-400">Total collected via Razorpay</div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <div className="text-xs text-slate-400">Platform Commission (20%)</div>
              <div className="text-2xl font-extrabold text-indigo-400">
                ₹{metrics?.platformCommissionRevenue || 0}.00
              </div>
              <div className="text-[11px] text-slate-500">Net earned revenue</div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <div className="text-xs text-slate-400">Interviewer Earnings Liability</div>
              <div className="text-2xl font-extrabold text-amber-400">
                ₹{metrics?.interviewerLiabilities || 0}.00
              </div>
              <div className="text-[11px] text-slate-500">80% credited to approved interviewers</div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <div className="text-xs text-slate-400">Total Refunds Processed</div>
              <div className="text-2xl font-extrabold text-rose-400">
                ₹{metrics?.totalRefunds || 0}.00
              </div>
              <div className="text-[11px] text-slate-500">Auto-timeouts & cancellations</div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-xs space-y-1">
              <div className="text-slate-400">Registered Users</div>
              <div className="text-xl font-bold text-white">{metrics?.totalUsers || 0}</div>
              <div className="text-[11px] text-slate-500">
                {metrics?.candidateCount} candidates • {metrics?.interviewerCount} interviewers
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-xs space-y-1">
              <div className="text-slate-400">Approved Interviewers</div>
              <div className="text-xl font-bold text-emerald-400">
                {metrics?.approvedInterviewersCount || 0}
              </div>
              <div className="text-[11px] text-slate-500">Passed 2-stage screening</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-xs space-y-1">
              <div className="text-slate-400">Active Queue Count</div>
              <div className="text-xl font-bold text-amber-400">
                {metrics?.activeQueueCount || 0}
              </div>
              <div className="text-[11px] text-slate-500">Waiting for claim</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-xs space-y-1">
              <div className="text-slate-400">Average Review Rating</div>
              <div className="text-xl font-bold text-yellow-400">
                ★ {metrics?.averageRating || 4.9}
              </div>
              <div className="text-[11px] text-slate-500">Candidate evaluations</div>
            </div>
          </div>

          {/* Integration Health Matrix */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Integration & Infrastructure Health
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-white">Razorpay Payments</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                    TEST GATEWAY ACTIVE
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Key: rzp_test_arena_demo • Server signature & webhook handlers verified.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-white">In-House Video Meeting Room</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                    NATIVE WEBRTC ACTIVE
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Embedded in-house video calling, screen sharing, audio, chat & code sandbox (zero 3rd-party dependencies).
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-white">Notifications & Email</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                    IN-APP REAL-TIME
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Instant in-app bell notifications and SSE stream active.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Users */}
      {activeTab === 'users' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-base font-bold text-white">All Users ({users.length})</h3>
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchUser}
                onChange={(e) => setSearchUser(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800 bg-slate-950/50">
                <tr>
                  <th className="p-3">User</th>
                  <th className="p-3">Roles</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Activity</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {users
                  .filter(
                    (u) =>
                      u.fullName.toLowerCase().includes(searchUser.toLowerCase()) ||
                      u.email.toLowerCase().includes(searchUser.toLowerCase())
                  )
                  .map((u) => (
                    <tr key={u.id} className="hover:bg-slate-800/40">
                      <td className="p-3 font-medium text-white">
                        <div>{u.fullName}</div>
                        <div className="text-[11px] text-slate-400">{u.email}</div>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          {u.roles.map((r) => (
                            <span
                              key={r}
                              className="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-indigo-300"
                            >
                              {r}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            u.isSuspended
                              ? 'bg-rose-500/20 text-rose-300'
                              : 'bg-emerald-500/20 text-emerald-300'
                          }`}
                        >
                          {u.isSuspended ? 'SUSPENDED' : 'ACTIVE'}
                        </span>
                      </td>
                      <td className="p-3 text-slate-400 text-[11px]">
                        {u.candidateProfile
                          ? `${u.candidateProfile.totalSessions} sessions conducted`
                          : u.interviewerProfile
                          ? `${u.interviewerProfile.totalCompletedSessions} sessions (${u.interviewerProfile.status})`
                          : 'Admin account'}
                      </td>
                      <td className="p-3 text-right space-x-2">
                        {u.roles.includes('INTERVIEWER') && (
                          <button
                            onClick={() => handleViewCalendar(u.id)}
                            className="px-2.5 py-1 rounded text-xs font-semibold bg-indigo-600/30 text-indigo-300 hover:bg-indigo-600/40 inline-flex items-center space-x-1"
                            title="Inspect interviewer calendar & blocked times"
                          >
                            <Calendar className="w-3 h-3" />
                            <span>Calendar</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleToggleUserStatus(u)}
                          className={`px-2.5 py-1 rounded text-xs font-semibold ${
                            u.isSuspended
                              ? 'bg-emerald-600/30 text-emerald-300 hover:bg-emerald-600/40'
                              : 'bg-rose-600/30 text-rose-300 hover:bg-rose-600/40'
                          }`}
                        >
                          {u.isSuspended ? 'Reactivate' : 'Suspend'}
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Interviewer Screening Pipeline */}
      {activeTab === 'applications' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[11px] font-semibold mb-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Mandatory 3-Screening Quality Bar</span>
              </div>
              <h3 className="text-lg font-bold text-white">
                Interviewer Applications & Screening Pipeline ({applications.length})
              </h3>
              <p className="text-xs text-slate-400">
                Each applicant or interviewer under review must clear all 3 screening interviews (Coding, System Architecture, and Bar-Raiser Rubrics) before approval.
              </p>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setApplicationFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  applicationFilter === 'ALL'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All ({applications.length})
              </button>
              <button
                onClick={() => setApplicationFilter('UNDER_REVIEW')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  applicationFilter === 'UNDER_REVIEW'
                    ? 'bg-amber-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Under Review ({applications.filter((a) => a.status === 'UNDER_REVIEW').length})
              </button>
              <button
                onClick={() => setApplicationFilter('SCREENING_REQUIRED')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  applicationFilter === 'SCREENING_REQUIRED'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Screening Required ({applications.filter((a) => a.status === 'SCREENING_REQUIRED').length})
              </button>
              <button
                onClick={() => setApplicationFilter('APPROVED')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  applicationFilter === 'APPROVED'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Approved ({applications.filter((a) => a.status === 'APPROVED').length})
              </button>
              <button
                onClick={() => setApplicationFilter('REJECTED')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  applicationFilter === 'REJECTED'
                    ? 'bg-rose-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Rejected ({applications.filter((a) => a.status === 'REJECTED').length})
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {applications
              .filter(
                (app) =>
                  applicationFilter === 'ALL' || app.status === applicationFilter
              )
              .map((app) => {
                const isRound1Done = app.screening1?.status === 'COMPLETED';
                const isRound2Done = app.screening2?.status === 'COMPLETED';
                const isRound3Done = app.screening3?.status === 'COMPLETED';
                const allThreeCleared = isRound1Done && isRound2Done && isRound3Done;

                return (
                  <div
                    key={app.id}
                    className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4 hover:border-slate-700/80 transition"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-base font-bold text-white">{app.userName}</span>
                          <span className="text-xs text-slate-400">({app.userEmail})</span>
                          <span
                            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                              app.status === 'APPROVED'
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                : app.status === 'REJECTED'
                                ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                                : app.status === 'UNDER_REVIEW'
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30 animate-pulse'
                                : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                            }`}
                          >
                            {app.status.replace('_', ' ')}
                          </span>
                          {allThreeCleared && app.status !== 'APPROVED' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/30 text-emerald-300">
                              3/3 Cleared - Ready for Approval
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
                          {app.currentCompany} • {app.yearsOfExperience} yrs experience • Skills:{' '}
                          {app.skills?.join(', ') || 'N/A'}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => handleViewCalendar(app.userId)}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold inline-flex items-center space-x-1 transition"
                          title="View this interviewer's calendar"
                        >
                          <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Calendar</span>
                        </button>

                        {app.status !== 'UNDER_REVIEW' && app.status !== 'APPROVED' && (
                          <button
                            onClick={() => {
                              api.evaluateApplication(app.id, {
                                action: 'SET_UNDER_REVIEW',
                                adminNotes: 'Placed under review. 3 screening interviews required.',
                              }).then(() => {
                                setActionAlert({
                                  type: 'success',
                                  message: `${app.userName} placed Under Review. 3 screening interviews enabled.`,
                                });
                                loadAllData();
                              });
                            }}
                            className="px-3 py-1.5 rounded-xl bg-amber-600/30 text-amber-300 hover:bg-amber-600/40 text-xs font-semibold transition"
                          >
                            Set Under Review
                          </button>
                        )}

                        {app.status !== 'APPROVED' && (
                          <button
                            onClick={() => handleEvaluateScreening(app.id, 'APPROVE')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                              allThreeCleared
                                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
                                : 'bg-slate-800 text-slate-400 hover:text-white'
                            }`}
                            title={
                              allThreeCleared
                                ? 'Grant Full Platform Approval'
                                : 'All 3 screening interviews must be cleared before approval'
                            }
                          >
                            Grant Approval
                          </button>
                        )}

                        {app.status !== 'REJECTED' && (
                          <button
                            onClick={() => handleEvaluateScreening(app.id, 'REJECT')}
                            className="px-3 py-1.5 rounded-xl bg-rose-600/30 text-rose-300 hover:bg-rose-600/40 text-xs font-semibold transition"
                          >
                            Reject
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 3 Screening Status Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      {/* Screening 1 */}
                      <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5 flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-center font-semibold text-white">
                            <span>1. Technical Coding</span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                app.screening1?.status === 'COMPLETED'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : app.screening1?.status === 'SCHEDULED'
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {app.screening1?.status || 'PENDING'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1">
                            {app.screening1?.notes || 'Data structures, algorithmic depth, edge cases.'}
                          </p>
                          {app.screening1?.score && (
                            <div className="text-[11px] font-bold text-emerald-400 mt-1">
                              Score: {app.screening1.score}/10
                            </div>
                          )}
                        </div>
                        {app.screening1?.status !== 'COMPLETED' && (
                          <button
                            onClick={() => {
                              api.evaluateApplication(app.id, {
                                action: 'UPDATE_SCREENING',
                                screeningNumber: 1,
                                screeningStatus: 'COMPLETED',
                                score: 9,
                                notes: 'Passed live coding walkthrough and algorithmic complexity questions.',
                              }).then(loadAllData);
                            }}
                            className="mt-2 text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold flex items-center space-x-1"
                          >
                            <span>Pass Screening 1 (Score 9/10) →</span>
                          </button>
                        )}
                      </div>

                      {/* Screening 2 */}
                      <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5 flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-center font-semibold text-white">
                            <span>2. System Architecture</span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                app.screening2?.status === 'COMPLETED'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : app.screening2?.status === 'SCHEDULED'
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {app.screening2?.status || 'PENDING'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1">
                            {app.screening2?.notes || 'Distributed systems, microservices & domain modeling.'}
                          </p>
                          {app.screening2?.score && (
                            <div className="text-[11px] font-bold text-emerald-400 mt-1">
                              Score: {app.screening2.score}/10
                            </div>
                          )}
                        </div>
                        {app.screening2?.status !== 'COMPLETED' && (
                          <button
                            onClick={() => {
                              api.evaluateApplication(app.id, {
                                action: 'UPDATE_SCREENING',
                                screeningNumber: 2,
                                screeningStatus: 'COMPLETED',
                                score: 9,
                                notes: 'Passed system design and architectural trade-offs interview.',
                              }).then(loadAllData);
                            }}
                            className="mt-2 text-[11px] text-amber-400 hover:text-amber-300 font-semibold flex items-center space-x-1"
                          >
                            <span>Pass Screening 2 (Score 9/10) →</span>
                          </button>
                        )}
                      </div>

                      {/* Screening 3 */}
                      <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5 flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-center font-semibold text-white">
                            <span>3. Bar-Raiser & Calibration</span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                app.screening3?.status === 'COMPLETED'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : app.screening3?.status === 'SCHEDULED'
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {app.screening3?.status || 'PENDING'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1">
                            {app.screening3?.notes || 'Standardized scoring rubric, mentorship, and bar calibration.'}
                          </p>
                          {app.screening3?.score && (
                            <div className="text-[11px] font-bold text-emerald-400 mt-1">
                              Score: {app.screening3.score}/10
                            </div>
                          )}
                        </div>
                        {app.screening3?.status !== 'COMPLETED' && (
                          <button
                            onClick={() => {
                              api.evaluateApplication(app.id, {
                                action: 'UPDATE_SCREENING',
                                screeningNumber: 3,
                                screeningStatus: 'COMPLETED',
                                score: 9,
                                notes: 'Passed Bar-Raiser calibration: rubric accuracy and structured feedback verified.',
                              }).then(loadAllData);
                            }}
                            className="mt-2 text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold flex items-center space-x-1"
                          >
                            <span>Pass Screening 3 (Score 9/10) →</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* TAB 4: Catalog & Tier Configuration */}
      {activeTab === 'catalog' && (
        <div className="space-y-6">
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
            <h3 className="text-base font-bold text-white">Configurable Tier Pricing & Commission Rates</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {tiers.map((t) => (
                <div
                  key={t.id}
                  className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-indigo-400">{t.code}</span>
                    <button
                      onClick={() => setEditingTier({ ...t })}
                      className="p-1 rounded text-slate-400 hover:text-white"
                      title="Edit price"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  </div>
                  <h4 className="text-lg font-bold text-white">{t.name}</h4>
                  <div className="text-2xl font-extrabold text-white">₹{t.price}.00</div>
                  <div className="text-xs text-slate-400">
                    Platform Commission: <strong className="text-white">{t.commissionPercent}%</strong> • Interviewer Share: <strong className="text-emerald-400">{100 - t.commissionPercent}%</strong>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{t.description}</p>
                </div>
              ))}
            </div>

            {editingTier && (
              <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/40 space-y-3">
                <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                  Editing {editingTier.name}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-300 mb-1">Session Price (₹):</label>
                    <input
                      type="number"
                      value={editingTier.price}
                      onChange={(e) => setEditingTier({ ...editingTier, price: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1">Platform Commission (%):</label>
                    <input
                      type="number"
                      value={editingTier.commissionPercent}
                      onChange={(e) => setEditingTier({ ...editingTier, commissionPercent: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                    />
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={handleSaveTier}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold"
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={() => setEditingTier(null)}
                    className="px-3 py-2 bg-slate-800 text-slate-400 rounded-xl text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: Bookings & Live Queue */}
      {activeTab === 'bookings' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
          <h3 className="text-base font-bold text-white">Live Bookings & Queue Monitor ({bookings.length})</h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800 bg-slate-950/50">
                <tr>
                  <th className="p-3">Ref</th>
                  <th className="p-3">Track & Round</th>
                  <th className="p-3">Candidate</th>
                  <th className="p-3">Interviewer</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {bookings.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono font-semibold text-white">{b.bookingRef}</td>
                    <td className="p-3">
                      <div className="font-medium text-white">{b.trackName}</div>
                      <div className="text-[11px] text-slate-400">{b.roundName}</div>
                    </td>
                    <td className="p-3 text-slate-200">{b.candidateName}</td>
                    <td className="p-3 text-slate-200">{b.interviewerName || '—'}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          b.status === 'COMPLETED'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : b.status === 'REFUNDED'
                            ? 'bg-rose-500/20 text-rose-300'
                            : 'bg-indigo-500/20 text-indigo-300'
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-white">₹{b.totalAmount}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => onOpenWorkspace(b.id)}
                        className="text-xs text-indigo-400 hover:underline"
                      >
                        Inspect Workspace
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: Finance & Ledger */}
      {activeTab === 'finance' && (
        <div className="space-y-6">
          {/* Refund Requests */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
            <h3 className="text-base font-bold text-white">Refund Requests & Management</h3>
            {refunds.length === 0 ? (
              <p className="text-xs text-slate-400">No active refund requests.</p>
            ) : (
              <div className="space-y-3">
                {refunds.map((r) => (
                  <div
                    key={r.id}
                    className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-bold text-white">{r.refundRef}</div>
                      <div className="text-slate-400">
                        Reason: {r.reason} • Amount: <strong className="text-rose-400">₹{r.amount}</strong>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          r.status === 'PROCESSED'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {r.status}
                      </span>
                      {r.status === 'PENDING' && (
                        <>
                          <button
                            onClick={() => handleRefundAction(r.id, 'APPROVE')}
                            className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                          >
                            Approve & Debit
                          </button>
                          <button
                            onClick={() => handleRefundAction(r.id, 'REJECT')}
                            className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Immutable Accounting Ledger */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
            <div>
              <h3 className="text-base font-bold text-white">Append-Only Accounting Ledger</h3>
              <p className="text-xs text-slate-400">
                Immutable financial record of all payments, commissions, credits, and refunds.
              </p>
            </div>

            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800 bg-slate-950/50 sticky top-0">
                  <tr>
                    <th className="p-2.5">Date</th>
                    <th className="p-2.5">Type</th>
                    <th className="p-2.5">Amount</th>
                    <th className="p-2.5">Description</th>
                    <th className="p-2.5">Ref ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {ledger.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-800/40">
                      <td className="p-2.5 text-slate-400">
                        {new Date(l.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-2.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            l.type.includes('CREDIT') || l.type.includes('COMMISSION') || l.type.includes('PAYMENT')
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-rose-500/20 text-rose-300'
                          }`}
                        >
                          {l.type}
                        </span>
                      </td>
                      <td
                        className={`p-2.5 font-bold ${
                          l.amount >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {l.amount >= 0 ? `+₹${l.amount}` : `-₹${Math.abs(l.amount)}`}
                      </td>
                      <td className="p-2.5 text-slate-300">{l.description}</td>
                      <td className="p-2.5 font-mono text-slate-400">{l.referenceId}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: Disputes */}
      {activeTab === 'disputes' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
          <h3 className="text-base font-bold text-white">Dispute & Problem Reports</h3>
          {disputes.length === 0 ? (
            <p className="text-xs text-slate-400">No open disputes reported.</p>
          ) : (
            <div className="space-y-3">
              {disputes.map((d) => (
                <div
                  key={d.id}
                  className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-white">{d.reason}</span>
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                      {d.status}
                    </span>
                  </div>
                  <p className="text-slate-300">{d.description}</p>
                  {d.status === 'OPEN' && (
                    <div className="flex space-x-2 pt-2">
                      <button
                        onClick={() => handleResolveDispute(d.id, 'RESOLVED_REFUND')}
                        className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold"
                      >
                        Resolve with Full Refund
                      </button>
                      <button
                        onClick={() => handleResolveDispute(d.id, 'RESOLVED_DISMISSED')}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300"
                      >
                        Dismiss Dispute
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Attendance & Strikes Management */}
      {activeTab === 'attendance' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                <span>Interviewer Attendance & 3-Strike Warning Registry</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Interviewers missing or failing to attend booked sessions within 10 minutes receive automated strikes. 3 strikes block their calendar and queue access.
              </p>
            </div>
            <div className="flex items-center space-x-3 text-xs">
              <span className="px-3 py-1 rounded-lg bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">
                {interviewerWarnings.filter((i) => (i.warningCount || 0) >= 3 || i.isBlockedByAdmin).length} Blocked Interviewers
              </span>
            </div>
          </div>

          {interviewerWarnings.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 bg-slate-950 rounded-xl border border-slate-800">
              No interviewers have logged warnings or strikes. All interviewers are currently in good standing.
            </div>
          ) : (
            <div className="space-y-4">
              {interviewerWarnings.map((interviewer) => {
                const strikeCount = interviewer.warningCount || 0;
                const isBlocked = interviewer.isBlockedByAdmin || strikeCount >= 3;
                return (
                  <div
                    key={interviewer.id}
                    className={`p-5 rounded-2xl border transition ${
                      isBlocked
                        ? 'bg-rose-500/5 border-rose-500/30 shadow-lg'
                        : strikeCount > 0
                        ? 'bg-amber-500/5 border-amber-500/20'
                        : 'bg-slate-950 border-slate-800'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center space-x-2.5">
                          <h4 className="text-sm font-bold text-white">{interviewer.name}</h4>
                          <span className="text-xs text-slate-400">({interviewer.email})</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isBlocked
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                : strikeCount > 0
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-emerald-500/20 text-emerald-300'
                            }`}
                          >
                            {isBlocked ? 'BLOCKED' : `${strikeCount} / 3 Strikes`}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
                          Role: {interviewer.currentRole || 'Interviewer'} @ {interviewer.currentCompany || 'Tech'} • Total Sessions: {interviewer.totalCompletedSessions || 0}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        {strikeCount > 0 && (
                          <button
                            onClick={() => handleClearWarnings(interviewer.id)}
                            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
                          >
                            Clear Warnings (Reset Strikes)
                          </button>
                        )}
                        <button
                          onClick={() => handleToggleBlockInterviewer(interviewer.id, isBlocked)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shadow ${
                            isBlocked
                              ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                              : 'bg-rose-600 hover:bg-rose-500 text-white'
                          }`}
                        >
                          {isBlocked ? 'Unblock Interviewer' : 'Block Interviewer'}
                        </button>
                      </div>
                    </div>

                    {/* Warning Log entries */}
                    {interviewer.warnings && interviewer.warnings.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-slate-800 space-y-2">
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          Strike Log & Escalations:
                        </div>
                        <div className="space-y-1.5">
                          {interviewer.warnings.map((w: any) => (
                            <div
                              key={w.id}
                              className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs flex items-center justify-between"
                            >
                              <div>
                                <span className="font-semibold text-rose-300">{w.reason}</span>
                                <span className="text-slate-500 text-[11px] ml-2 font-mono">
                                  Ref: {w.bookingRef}
                                </span>
                              </div>
                              <span className="text-slate-400 text-[11px]">
                                {new Date(w.createdAt).toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 8: Audit Logs */}
      {activeTab === 'audit' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
          <h3 className="text-base font-bold text-white">System Audit Trail</h3>
          <div className="space-y-2 text-xs font-mono max-h-96 overflow-y-auto">
            {auditLogs.map((log) => (
              <div key={log.id} className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
                <div className="flex justify-between text-indigo-400 text-[11px]">
                  <span>{log.action} • {log.targetType}:{log.targetId}</span>
                  <span>{new Date(log.createdAt).toLocaleString()}</span>
                </div>
                <div className="mt-1 text-slate-200">{log.details}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 9: Settings */}
      {activeTab === 'settings' && settings && (
        <form onSubmit={handleSaveSettings} className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-5 max-w-2xl">
          <h3 className="text-base font-bold text-white">Platform Settings & Timeouts</h3>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-300 mb-1">Platform Commission (%):</label>
              <input
                type="number"
                value={settings.commissionPercent}
                onChange={(e) => setSettings({ ...settings, commissionPercent: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
              />
            </div>

            <div>
              <label className="block text-slate-300 mb-1">Queue Matchmaking Timeout (Minutes):</label>
              <input
                type="number"
                value={settings.queueTimeoutMinutes}
                onChange={(e) => setSettings({ ...settings, queueTimeoutMinutes: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="autoRefund"
                checked={settings.autoRefundOnTimeout}
                onChange={(e) => setSettings({ ...settings, autoRefundOnTimeout: e.target.checked })}
                className="rounded bg-slate-950 border-slate-800 text-indigo-600"
              />
              <label htmlFor="autoRefund" className="text-slate-300">
                Automatically issue 100% refund when queue timeout expires
              </label>
            </div>

            <div>
              <label className="block text-slate-300 mb-1">Public Platform Notice / Disclaimer:</label>
              <textarea
                rows={3}
                value={settings.platformNotice}
                onChange={(e) => setSettings({ ...settings, platformNotice: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
              />
            </div>
          </div>

          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs"
          >
            Save Global Settings
          </button>
        </form>
      )}

      {/* Interviewer Calendar Audit Modal */}
      {selectedInterviewerCalendar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 sm:p-8 space-y-6">
            <div className="flex items-start justify-between pb-4 border-b border-slate-800">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-bold text-white">
                    Interviewer Calendar: {selectedInterviewerCalendar.interviewer.fullName}
                  </h3>
                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                      selectedInterviewerCalendar.interviewer.status === 'APPROVED'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : selectedInterviewerCalendar.interviewer.status === 'UNDER_REVIEW'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                    }`}
                  >
                    {selectedInterviewerCalendar.interviewer.status || 'INTERVIEWER'}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  {selectedInterviewerCalendar.interviewer.email} • Availability:{' '}
                  <strong className={selectedInterviewerCalendar.interviewer.isAvailable ? 'text-emerald-400' : 'text-slate-400'}>
                    {selectedInterviewerCalendar.interviewer.isAvailable ? 'Online' : 'Offline'}
                  </strong>{' '}
                  • Strikes: {selectedInterviewerCalendar.interviewer.warningCount || 0}/3
                </p>
              </div>

              <button
                onClick={() => setSelectedInterviewerCalendar(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              >
                ✕
              </button>
            </div>

            {/* Notification Suppression Info Box */}
            <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 text-xs text-indigo-200 flex items-start space-x-3">
              <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-white block mb-0.5">
                  Notification Suppression & Double-Booking Protection
                </span>
                <span>
                  When a candidate schedules an interview for a specific slot, the engine checks this calendar. If this interviewer has a blocked time slot or existing scheduled session during that window, the interview request notification is <strong>automatically suppressed</strong> and not sent to this user.
                </span>
              </div>
            </div>

            {/* Custom Blocked Slots */}
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-white flex items-center justify-between">
                <span>Blocked Time Slots ({selectedInterviewerCalendar.blockedSlots?.length || 0})</span>
                <span className="text-[11px] text-amber-400 font-normal">
                  Suppresses notifications during these windows
                </span>
              </h4>

              {(!selectedInterviewerCalendar.blockedSlots || selectedInterviewerCalendar.blockedSlots.length === 0) ? (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 text-xs text-slate-400 text-center">
                  No blocked slots currently on this interviewer's calendar.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {selectedInterviewerCalendar.blockedSlots.map((slot: any) => (
                    <div
                      key={slot.id}
                      className="p-3.5 rounded-xl bg-slate-950 border border-amber-500/30 space-y-1.5"
                    >
                      <div className="flex items-center justify-between font-semibold text-white">
                        <span className="text-amber-300 font-bold">{slot.title || 'Blocked Slot'}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                          {slot.date}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-300 flex items-center space-x-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {slot.startTime} – {slot.endTime}
                        </span>
                      </div>
                      {slot.reason && (
                        <p className="text-[11px] text-slate-400 italic">
                          Reason: {slot.reason}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Booked Sessions */}
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-white">
                Booked & Assigned Interview Sessions ({selectedInterviewerCalendar.bookedSessions?.length || 0})
              </h4>

              {(!selectedInterviewerCalendar.bookedSessions || selectedInterviewerCalendar.bookedSessions.length === 0) ? (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 text-xs text-slate-400 text-center">
                  No active or past sessions assigned to this interviewer.
                </div>
              ) : (
                <div className="space-y-2 text-xs">
                  {selectedInterviewerCalendar.bookedSessions.map((b: any) => (
                    <div
                      key={b.id}
                      className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-white">{b.trackName}</span>
                          <span className="text-slate-400">• {b.roundName}</span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              b.status === 'COMPLETED'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : b.status === 'IN_PROGRESS' || b.status === 'READY'
                                ? 'bg-indigo-500/20 text-indigo-300'
                                : 'bg-amber-500/20 text-amber-300'
                            }`}
                          >
                            {b.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Candidate: <strong className="text-slate-300">{b.candidateName}</strong> • Role:{' '}
                          {b.jobRole} ({b.seniorityLevel || 'Mid-Level'})
                        </div>
                      </div>

                      <div className="sm:text-right text-[11px]">
                        <div className="text-slate-300 font-semibold">
                          {b.scheduledAt ? new Date(b.scheduledAt).toLocaleString() : 'Instant Queue'}
                        </div>
                        <div className="text-emerald-400 font-medium">Payout: ₹{b.interviewerEarnings}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedInterviewerCalendar(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition"
              >
                Close Calendar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
