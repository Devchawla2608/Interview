import {
  User,
  CandidateProfile,
  InterviewerProfile,
  InterviewerApplication,
  Tier,
  CompanyTrack,
  RoundTemplate,
  Booking,
  QueueEntry,
  InterviewerAvailabilitySlot,
  PaymentOrder,
  Refund,
  LedgerEntry,
  InterviewerEarnings,
  PayoutRecord,
  InterviewFeedback,
  CandidateReview,
  DisputeReport,
  NotificationItem,
  AdminAuditLog,
  AppSettings,
  PlatformMetrics,
  TierCode,
  InterviewerAttendanceWarning,
  CalendarBlockedSlot,
} from '../types';
import { hashPassword } from './auth';
import {
  mongoSaveUser,
  mongoSaveCandidateProfile,
  mongoSaveInterviewerProfile,
  mongoSaveBooking,
  mongoSaveQueueEntry,
  mongoSaveFeedback,
  mongoSaveReview,
  mongoSaveLedgerEntry,
  mongoLoadAll,
} from '../db/mongodb';

class MemoryStore {
  users: Map<string, User> = new Map();
  userCredentials: Map<string, { hash: string; salt: string }> = new Map();
  candidateProfiles: Map<string, CandidateProfile> = new Map();
  interviewerProfiles: Map<string, InterviewerProfile> = new Map();
  interviewerApplications: Map<string, InterviewerApplication> = new Map();
  tiers: Map<string, Tier> = new Map();
  companyTracks: Map<string, CompanyTrack> = new Map();
  roundTemplates: Map<string, RoundTemplate> = new Map();
  bookings: Map<string, Booking> = new Map();
  queueEntries: Map<string, QueueEntry> = new Map();
  availability: Map<string, InterviewerAvailabilitySlot> = new Map();
  calendarBlockedSlots: Map<string, CalendarBlockedSlot> = new Map();
  paymentOrders: Map<string, PaymentOrder> = new Map();
  refunds: Map<string, Refund> = new Map();
  ledger: LedgerEntry[] = [];
  earnings: Map<string, InterviewerEarnings> = new Map();
  feedback: Map<string, InterviewFeedback> = new Map();
  reviews: Map<string, CandidateReview> = new Map();
  disputes: Map<string, DisputeReport> = new Map();
  notifications: NotificationItem[] = [];
  auditLogs: AdminAuditLog[] = [];
  settings: AppSettings;

  // Lock for atomic operations (e.g. claim queue)
  private claimLocks: Set<string> = new Set();

  // Event listeners for SSE
  private listeners: Set<(event: { type: string; data: unknown }) => void> = new Set();

  constructor() {
    this.settings = {
      commissionPercent: 50,
      queueTimeoutMinutes: 15,
      claimTimeoutMinutes: 5,
      autoRefundOnTimeout: true,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_arena_demo',
      razorpayKeySecretConfigured: Boolean(process.env.RAZORPAY_KEY_SECRET),
      inHouseMeetingEnabled: true,
      emailConfigured: Boolean(process.env.RESEND_API_KEY || process.env.EMAIL_API_KEY),
      platformNotice:
        'Practice interviews are educational simulations conducted by approved peers or industry professionals. Not affiliated with or endorsed by referenced companies.',
    };

    this.seedCatalog();
    this.seedUsers();
    // Zero dummy mock bookings: production SaaS starts with a clean slate!
  }

  // Load existing data from MongoDB on startup
  async syncFromMongoDB(): Promise<void> {
    try {
      const data = await mongoLoadAll();
      if (!data) return;

      if (data.users && data.users.length > 0) {
        for (const u of data.users) {
          this.users.set(u.id, u);
          if (u.passwordHash && u.salt) {
            this.userCredentials.set(u.id, { hash: u.passwordHash, salt: u.salt });
          }
        }
      }
      if (data.candidateProfiles) {
        for (const cp of data.candidateProfiles) {
          this.candidateProfiles.set(cp.userId, cp);
        }
      }
      if (data.interviewerProfiles) {
        for (const ip of data.interviewerProfiles) {
          this.interviewerProfiles.set(ip.userId, ip);
        }
      }
      if (data.bookings) {
        for (const b of data.bookings) {
          this.bookings.set(b.id, b);
        }
      }
      if (data.queueEntries) {
        for (const q of data.queueEntries) {
          this.queueEntries.set(q.bookingId, q);
        }
      }
      if (data.feedback) {
        for (const f of data.feedback) {
          this.feedback.set(f.bookingId, f);
        }
      }
      if (data.reviews) {
        for (const r of data.reviews) {
          this.reviews.set(r.bookingId, r);
        }
      }
      if (data.ledger && data.ledger.length > 0) {
        this.ledger = data.ledger;
      }
      console.log(`[Interview Arena] Successfully synced ${this.users.size} users and ${this.bookings.size} bookings from MongoDB.`);
    } catch (err) {
      console.error('[Interview Arena] MongoDB sync error:', err);
    }
  }

  // SSE Broadcaster
  subscribe(fn: (event: { type: string; data: unknown }) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  broadcast(type: string, data: unknown) {
    for (const listener of this.listeners) {
      try {
        listener({ type, data });
      } catch (err) {
        console.error('SSE broadcast error:', err);
      }
    }
  }

  addNotification(userId: string, title: string, message: string, type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ALERT' = 'INFO', link?: string) {
    const item: NotificationItem = {
      id: 'notif_' + Math.random().toString(36).substring(2, 9),
      userId,
      title,
      message,
      type,
      isRead: false,
      link,
      createdAt: new Date().toISOString(),
    };
    this.notifications.unshift(item);
    this.broadcast('NEW_NOTIFICATION', { userId, notification: item });
    return item;
  }

  logAudit(
    adminId: string,
    adminEmail: string,
    action: string,
    targetType: string,
    targetId: string,
    details: string,
    ipAddress: string = '127.0.0.1'
  ): AdminAuditLog {
    const log: AdminAuditLog = {
      id: 'audit_' + Math.random().toString(36).substring(2, 9),
      adminId,
      adminEmail,
      action,
      targetType,
      targetId,
      details,
      ipAddress,
      createdAt: new Date().toISOString(),
    };
    this.auditLogs.unshift(log);
    return log;
  }

  addLedgerEntry(entry: Omit<LedgerEntry, 'id' | 'createdAt' | 'balanceAfter'>): LedgerEntry {
    const prevBalance = this.ledger.length > 0 ? this.ledger[0].balanceAfter : 0;
    const newBalance = prevBalance + entry.amount;
    const item: LedgerEntry = {
      ...entry,
      id: 'ledg_' + Math.random().toString(36).substring(2, 9),
      balanceAfter: newBalance,
      createdAt: new Date().toISOString(),
    };
    this.ledger.unshift(item);
    mongoSaveLedgerEntry(item);
    return item;
  }

  // Calendar Management
  addBlockedSlot(slot: Omit<CalendarBlockedSlot, 'id' | 'createdAt'>): CalendarBlockedSlot {
    const id = 'blk_' + Math.random().toString(36).substring(2, 9);
    const newSlot: CalendarBlockedSlot = {
      ...slot,
      id,
      createdAt: new Date().toISOString(),
    };
    this.calendarBlockedSlots.set(id, newSlot);
    return newSlot;
  }

  removeBlockedSlot(slotId: string, interviewerId: string): boolean {
    const slot = this.calendarBlockedSlots.get(slotId);
    if (!slot || slot.interviewerId !== interviewerId) return false;
    return this.calendarBlockedSlots.delete(slotId);
  }

  getInterviewerBlockedSlots(interviewerId: string): CalendarBlockedSlot[] {
    return Array.from(this.calendarBlockedSlots.values()).filter(
      (s) => s.interviewerId === interviewerId
    );
  }

  // Check if an interviewer is calendar-blocked at a given target ISO time / date
  isInterviewerCalendarBlocked(
    interviewerId: string,
    scheduledAtIsoOrDateStr: string,
    durationMins: number = 60
  ): { isBlocked: boolean; reason?: string } {
    const prof = this.interviewerProfiles.get(interviewerId);
    if (!prof) return { isBlocked: true, reason: 'Profile not found' };

    if (prof.isBlockedByAdmin || (prof.warningCount || 0) >= 3) {
      return { isBlocked: true, reason: 'Interviewer account blocked by admin' };
    }

    if (!scheduledAtIsoOrDateStr) {
      if (prof.activeSessionId) {
        return { isBlocked: true, reason: 'Active live session in progress' };
      }
      return { isBlocked: false };
    }

    const targetDate = new Date(scheduledAtIsoOrDateStr);
    if (isNaN(targetDate.getTime())) {
      return { isBlocked: false };
    }

    const targetStartMs = targetDate.getTime();
    const targetEndMs = targetStartMs + durationMins * 60000;
    const targetYear = targetDate.getFullYear();
    const targetMonth = String(targetDate.getMonth() + 1).padStart(2, '0');
    const targetDay = String(targetDate.getDate()).padStart(2, '0');
    const localDateStr = `${targetYear}-${targetMonth}-${targetDay}`;
    const utcDateStr = targetDate.toISOString().split('T')[0];
    const targetTimeHours = targetDate.getHours();
    const targetTimeMinutes = targetDate.getMinutes();
    const targetTimeTotalMinutes = targetTimeHours * 60 + targetTimeMinutes;

    // 1. Check existing booked sessions
    for (const b of this.bookings.values()) {
      if (
        b.interviewerId === interviewerId &&
        ['CLAIMED', 'IN_PROGRESS', 'READY', 'SCHEDULED'].includes(b.status)
      ) {
        if (b.scheduledAt) {
          const bStart = new Date(b.scheduledAt).getTime();
          const bEnd = bStart + (b.roundDurationMins || 45) * 60000;
          if (targetStartMs < bEnd && targetEndMs > bStart) {
            return {
              isBlocked: true,
              reason: `Already booked for session ${b.bookingRef} at this time`,
            };
          }
        } else if (prof.activeSessionId === b.id) {
          return { isBlocked: true, reason: 'Currently inside active interview session' };
        }
      }
    }

    // 2. Check custom blocked calendar slots
    for (const slot of this.calendarBlockedSlots.values()) {
      if (
        slot.interviewerId === interviewerId &&
        (slot.date === localDateStr || slot.date === utcDateStr)
      ) {
        const [startH, startM] = slot.startTime.split(':').map(Number);
        const [endH, endM] = slot.endTime.split(':').map(Number);
        const slotStartMin = startH * 60 + (startM || 0);
        const slotEndMin = endH * 60 + (endM || 0);
        const sessionEndMin = targetTimeTotalMinutes + durationMins;

        if (targetTimeTotalMinutes < slotEndMin && sessionEndMin > slotStartMin) {
          return {
            isBlocked: true,
            reason: `Calendar blocked: "${slot.title || 'Personal time'}" (${slot.startTime} - ${slot.endTime})`,
          };
        }
      }
    }

    return { isBlocked: false };
  }

  // Notify matching interviewers when a candidate books a scheduled interview (with calendar suppression)
  notifyMatchingInterviewersForScheduledSession(booking: Booking): number {
    let notifiedCount = 0;
    const approvedInterviewers = Array.from(this.interviewerProfiles.values()).filter(
      (p) =>
        p.status === 'APPROVED' &&
        !p.isBlockedByAdmin &&
        (p.warningCount || 0) < 3 &&
        (!p.preferredTiers || p.preferredTiers.length === 0 || p.preferredTiers.includes(booking.tierCode))
    );

    const scheduledTime = booking.scheduledAt
      ? new Date(booking.scheduledAt).toLocaleString([], {
          dateStyle: 'medium',
          timeStyle: 'short',
        })
      : 'Requested slot';

    for (const prof of approvedInterviewers) {
      const blockCheck = this.isInterviewerCalendarBlocked(
        prof.userId,
        booking.scheduledAt || booking.createdAt,
        booking.roundDurationMins || 45
      );

      // If NOT blocked, dispatch notification!
      if (!blockCheck.isBlocked) {
        this.addNotification(
          prof.userId,
          `New Scheduled Interview Request (${booking.trackName})`,
          `Candidate ${booking.candidateName} scheduled ${booking.roundName} for ${scheduledTime}. Role: ${booking.jobRole} (${booking.seniorityLevel || 'Mid-Level'}). Payout: ₹${booking.interviewerEarnings}. Accept now to claim!`,
          'INFO',
          `/interviewer?scheduled=${booking.id}`
        );
        notifiedCount++;
      }
    }

    return notifiedCount;
  }

  // Accept a scheduled booking
  async acceptScheduledBookingAtomic(bookingId: string, interviewerUserId: string): Promise<{ success: boolean; message: string; booking?: Booking }> {
    if (this.claimLocks.has(bookingId)) {
      return { success: false, message: 'This interview request is currently being processed by another interviewer.' };
    }

    this.claimLocks.add(bookingId);
    try {
      const booking = this.bookings.get(bookingId);
      if (!booking) return { success: false, message: 'Booking not found' };

      if (booking.status !== 'SCHEDULED' || booking.interviewerId) {
        return { success: false, message: 'This scheduled session is already claimed or assigned.' };
      }

      const interviewer = this.users.get(interviewerUserId);
      if (!interviewer) return { success: false, message: 'Interviewer not found' };

      const prof = this.interviewerProfiles.get(interviewerUserId);
      if (!prof || prof.status !== 'APPROVED') {
        return { success: false, message: 'Only approved interviewers can accept scheduled sessions.' };
      }

      const blockCheck = this.isInterviewerCalendarBlocked(
        interviewerUserId,
        booking.scheduledAt || booking.createdAt,
        booking.roundDurationMins || 45
      );
      if (blockCheck.isBlocked) {
        return { success: false, message: `Cannot accept: ${blockCheck.reason || 'Your calendar is blocked at this time.'}` };
      }

      booking.interviewerId = interviewerUserId;
      booking.interviewerName = interviewer.fullName;
      booking.meetingUrl = `/workspace/${booking.id}`;
      booking.meetingProvider = 'IN_HOUSE_MEET';
      booking.updatedAt = new Date().toISOString();

      mongoSaveBooking(booking);

      this.addNotification(
        booking.candidateId,
        'Scheduled Interview Accepted!',
        `Your scheduled session for ${booking.trackName} has been confirmed by interviewer ${interviewer.fullName}. Meeting link generated.`,
        'SUCCESS',
        `/workspace/${booking.id}`
      );

      this.addNotification(
        interviewerUserId,
        'Scheduled Session Confirmed',
        `You have confirmed the scheduled session with ${booking.candidateName} for ${booking.trackName}.`,
        'SUCCESS',
        `/workspace/${booking.id}`
      );

      this.broadcast('BOOKING_UPDATED', booking);

      return { success: true, message: 'Scheduled interview confirmed!', booking };
    } finally {
      this.claimLocks.delete(bookingId);
    }
  }

  // Atomic queue claim using row-level locking simulation
  async claimQueueEntryAtomic(bookingId: string, interviewerUserId: string): Promise<{ success: boolean; message: string; booking?: Booking }> {
    if (this.claimLocks.has(bookingId)) {
      return { success: false, message: 'This interview request is currently being claimed by another interviewer.' };
    }

    this.claimLocks.add(bookingId);
    try {
      const booking = this.bookings.get(bookingId);
      if (!booking) {
        return { success: false, message: 'Booking not found.' };
      }

      if (booking.status !== 'QUEUED') {
        return {
          success: false,
          message: `Cannot claim: session is already ${booking.status.toLowerCase().replace('_', ' ')}.`,
        };
      }

      const interviewer = this.users.get(interviewerUserId);
      if (!interviewer) {
        return { success: false, message: 'Interviewer user not found.' };
      }

      const interviewerProf = this.interviewerProfiles.get(interviewerUserId);
      if (!interviewerProf || interviewerProf.status !== 'APPROVED') {
        return { success: false, message: 'Only approved interviewers can accept paid sessions.' };
      }

      // Check if blocked by admin due to 3 warnings rule
      if (interviewerProf.isBlockedByAdmin) {
        return { success: false, message: 'Your interviewer account is suspended by administrator due to attendance strikes. Please contact support.' };
      }

      // Check qualifications
      if (!interviewerProf.preferredTiers.includes(booking.tierCode)) {
        return { success: false, message: `You are not qualified or registered for ${booking.tierCode}.` };
      }

      // Check overlapping active sessions (calendar blocking)
      const hasActive = Array.from(this.bookings.values()).some(
        (b) =>
          b.interviewerId === interviewerUserId &&
          ['CLAIMED', 'IN_PROGRESS', 'READY'].includes(b.status) &&
          b.id !== bookingId
      );
      if (hasActive || interviewerProf.activeSessionId) {
        return { success: false, message: 'Calendar Blocked: You already have an active claimed interview. Please complete your current session before claiming another.' };
      }

      // Update Booking
      booking.interviewerId = interviewerUserId;
      booking.interviewerName = interviewer.fullName;
      booking.status = 'CLAIMED';
      booking.updatedAt = new Date().toISOString();

      // Lock interviewer calendar
      interviewerProf.isAvailable = false;
      interviewerProf.activeSessionId = booking.id;
      mongoSaveInterviewerProfile(interviewerProf);

      // Meeting provisioning: 100% In-house WebRTC meeting room
      booking.meetingProvider = 'IN_HOUSE_MEET';
      booking.meetingUrl = `/workspace/${booking.id}`;

      // Update Queue Entry
      const queueEntry = this.queueEntries.get(bookingId);
      if (queueEntry) {
        queueEntry.status = 'CLAIMED';
        queueEntry.claimedBy = interviewerUserId;
        queueEntry.claimedAt = new Date().toISOString();
        mongoSaveQueueEntry(queueEntry);
      }

      mongoSaveBooking(booking);

      // Notifications
      this.addNotification(
        booking.candidateId,
        'Interviewer Assigned!',
        `Your ${booking.trackName} (${booking.roundName}) session was accepted by ${interviewer.fullName}. Meeting workspace is ready.`,
        'SUCCESS',
        `/workspace/${booking.id}`
      );
      this.addNotification(
        interviewerUserId,
        'Session Claimed Successfully',
        `You have been assigned to interview ${booking.candidateName} for ${booking.trackName}. Meeting link has been generated.`,
        'SUCCESS',
        `/workspace/${booking.id}`
      );

      this.broadcast('BOOKING_CLAIMED', { bookingId, interviewerId: interviewerUserId });
      this.broadcast('QUEUE_UPDATED', Array.from(this.queueEntries.values()));

      return { success: true, message: 'Interview session claimed successfully!', booking };
    } finally {
      this.claimLocks.delete(bookingId);
    }
  }

  // Live platform metrics
  getPlatformMetrics(): PlatformMetrics {
    const bookingsList = Array.from(this.bookings.values());
    const completed = bookingsList.filter((b) => b.status === 'COMPLETED');
    const waiting = Array.from(this.queueEntries.values()).filter((q) => q.status === 'WAITING');
    const timeouts = Array.from(this.queueEntries.values()).filter((q) => q.status === 'TIMEOUT');
    const noShows = bookingsList.filter((b) => b.status === 'NO_SHOW_CANDIDATE' || b.status === 'NO_SHOW_INTERVIEWER');

    const grossVolume = bookingsList
      .filter((b) => b.paymentStatus === 'PAID')
      .reduce((sum, b) => sum + b.totalAmount, 0);

    const commissionRevenue = bookingsList
      .filter((b) => b.status === 'COMPLETED')
      .reduce((sum, b) => sum + b.platformFee, 0);

    const interviewerLiabilities = bookingsList
      .filter((b) => b.status === 'COMPLETED')
      .reduce((sum, b) => sum + b.interviewerEarnings, 0);

    const totalRefunds = Array.from(this.refunds.values())
      .filter((r) => r.status === 'PROCESSED')
      .reduce((sum, r) => sum + r.amount, 0);

    const allReviews = Array.from(this.reviews.values());
    const avgRating = allReviews.length > 0
      ? Number((allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length).toFixed(1))
      : 5.0;

    const approvedCount = Array.from(this.interviewerProfiles.values()).filter((p) => p.status === 'APPROVED').length;

    return {
      totalUsers: this.users.size,
      candidateCount: Array.from(this.users.values()).filter((u) => u.roles.includes('CANDIDATE')).length,
      interviewerCount: Array.from(this.users.values()).filter((u) => u.roles.includes('INTERVIEWER')).length,
      approvedInterviewersCount: approvedCount,
      totalBookings: bookingsList.length,
      completedSessions: completed.length,
      activeQueueCount: waiting.length,
      grossPaymentVolume: grossVolume,
      platformCommissionRevenue: commissionRevenue,
      interviewerLiabilities,
      totalRefunds,
      averageRating: avgRating,
      timeoutRate: bookingsList.length > 0 ? Number(((timeouts.length / bookingsList.length) * 100).toFixed(1)) : 0,
      noShowRate: bookingsList.length > 0 ? Number(((noShows.length / bookingsList.length) * 100).toFixed(1)) : 0,
    };
  }

  private seedCatalog() {
    // Tiers
    const tierA: Tier = {
      id: 'tier_a',
      code: 'TIER_A',
      name: 'FAANG & Elite Unicorn Tier',
      badge: 'Elite Tier • Top Bar',
      price: 100,
      description:
        'Rigorous mock interview track modeled on hiring bars of Google, Meta, Amazon, Microsoft, Uber, and Netflix. Deep algorithmic optimization, hard DP, distributed systems, and structured design.',
      commissionPercent: 50,
      defaultRoundCount: 5,
      order: 1,
      isActive: true,
    };

    const tierB: Tier = {
      id: 'tier_b',
      code: 'TIER_B',
      name: 'Product & High-Growth Tier',
      badge: 'Growth Tier • Scaleups',
      price: 80,
      description:
        'Targeted preparation for established tech leaders, high-growth startups, and mid-market product firms. Practical data structures, database queries, framework architecture, and real-world system engineering.',
      commissionPercent: 50,
      defaultRoundCount: 3,
      order: 2,
      isActive: true,
    };

    const tierC: Tier = {
      id: 'tier_c',
      code: 'TIER_C',
      name: 'Foundation & Services Tier',
      badge: 'Foundation Tier • Entry Level',
      price: 60,
      description:
        'Focused on campus recruitment, junior engineer roles, and service tech companies. Strong foundation in OOP, SQL, basic algorithmic patterns, clean coding, and behavioral confidence.',
      commissionPercent: 50,
      defaultRoundCount: 2,
      order: 3,
      isActive: true,
    };

    this.tiers.set('TIER_A', tierA);
    this.tiers.set('TIER_B', tierB);
    this.tiers.set('TIER_C', tierC);

    const supportedCompanyRoles = [
      'Software Engineer',
      'Data Scientist',
      'AI Engineer',
      'AI / Machine Learning Engineer',
      'Frontend Engineer',
      'Backend Engineer',
      'Full-Stack Engineer',
      'Data Engineer',
      'DevOps / Cloud Engineer',
      'Engineering Manager',
    ];

    const supportedCompanyLevels = [
      'Junior / Entry-Level (L3 / SDE-1)',
      'Mid-Level (L4 / SDE-2)',
      'Senior Engineer (L5 / Senior)',
      'Staff / Principal Engineer (L6 / Staff)',
    ];

    // Company Tracks
    const tracks: CompanyTrack[] = [
      // Tier A
      { id: 'track_google', tierCode: 'TIER_A', name: 'Google Track', slug: 'google-track', badge: 'Elite Tier', description: 'Algorithmic efficiency, graph theory, distributed system thinking, and Googleyness.', recommendedRounds: 5, roles: supportedCompanyRoles, levels: supportedCompanyLevels, isActive: true },
      { id: 'track_meta', tierCode: 'TIER_A', name: 'Meta Track', slug: 'meta-track', badge: 'Elite Tier', description: 'Fast-paced algorithmic coding, live debugging, product architecture, and behavioral impact.', recommendedRounds: 4, roles: supportedCompanyRoles, levels: supportedCompanyLevels, isActive: true },
      { id: 'track_amazon', tierCode: 'TIER_A', name: 'Amazon Track', slug: 'amazon-track', badge: 'Elite Tier', description: 'Coding & system design grounded strictly in Amazon Leadership Principles (Customer Obsession, Ownership).', recommendedRounds: 4, roles: supportedCompanyRoles, levels: supportedCompanyLevels, isActive: true },
      { id: 'track_microsoft', tierCode: 'TIER_A', name: 'Microsoft Track', slug: 'microsoft-track', badge: 'Elite Tier', description: 'Strong computer science foundations, tree/graph algorithms, scalable cloud architecture, and growth mindset.', recommendedRounds: 4, roles: supportedCompanyRoles, levels: supportedCompanyLevels, isActive: true },
      { id: 'track_uber', tierCode: 'TIER_A', name: 'Uber Track', slug: 'uber-track', badge: 'Elite Tier', description: 'Real-time spatial data structures, concurrency, low-latency API design, and trade-offs under scale.', recommendedRounds: 4, roles: supportedCompanyRoles, levels: supportedCompanyLevels, isActive: true },
      { id: 'track_ai_labs', tierCode: 'TIER_A', name: 'AI & Machine Learning Labs Track', slug: 'ai-ml-labs', badge: 'Elite AI Tier', description: 'Deep learning math, Transformer architecture, PyTorch distributed training, vector search, and LLM inference pipelines.', recommendedRounds: 4, roles: supportedCompanyRoles, levels: supportedCompanyLevels, isActive: true },

      // Tier B
      { id: 'track_swiggy_zomato', tierCode: 'TIER_B', name: 'High-Growth Tech Track', slug: 'high-growth-tech', badge: 'Growth Tier', description: 'Full-stack problem solving, event-driven architecture, caching strategies, and REST API design.', recommendedRounds: 3, roles: supportedCompanyRoles, levels: supportedCompanyLevels, isActive: true },
      { id: 'track_fintech', tierCode: 'TIER_B', name: 'FinTech Engineering Track', slug: 'fintech-engineering', badge: 'Growth Tier', description: 'ACID transactions, idempotency, distributed locks, database indexing, and secure design.', recommendedRounds: 3, roles: supportedCompanyRoles, levels: supportedCompanyLevels, isActive: true },
      { id: 'track_saas', tierCode: 'TIER_B', name: 'Enterprise SaaS Track', slug: 'enterprise-saas', badge: 'Growth Tier', description: 'Multi-tenant architecture, backend concurrency, observability, and clean OOP abstractions.', recommendedRounds: 3, roles: supportedCompanyRoles, levels: supportedCompanyLevels, isActive: true },
      { id: 'track_data_science', tierCode: 'TIER_B', name: 'Data Science & Analytics Track', slug: 'data-science-analytics', badge: 'Growth Tier', description: 'Hypothesis testing, A/B experiment design, tabular ML algorithms (XGBoost), feature pipelines, and SQL performance.', recommendedRounds: 3, roles: supportedCompanyRoles, levels: supportedCompanyLevels, isActive: true },

      // Tier C
      { id: 'track_campus', tierCode: 'TIER_C', name: 'Campus Placement Track', slug: 'campus-placement', badge: 'Foundation Tier', description: 'Core CS subjects: Data Structures, OOP (Java/C++), OS memory management, and SQL normalization.', recommendedRounds: 2, roles: supportedCompanyRoles, levels: supportedCompanyLevels, isActive: true },
      { id: 'track_service', tierCode: 'TIER_C', name: 'Services & IT Firms Track', slug: 'services-it-firms', badge: 'Foundation Tier', description: 'Aptitude-aligned coding, practical debugging, relational schemas, and HR/communication round.', recommendedRounds: 2, roles: supportedCompanyRoles, levels: supportedCompanyLevels, isActive: true },
    ];

    for (const t of tracks) {
      this.companyTracks.set(t.id, t);
    }

    // Round Templates
    const roundDefs: RoundTemplate[] = [
      // Tier A Rounds
      {
        id: 'round_a_1',
        tierCode: 'TIER_A',
        roundNumber: 1,
        name: 'Round 1: Online Assessment / Algorithmic Screen',
        description: 'Time-constrained coding covering arrays, two-pointers, hash tables, and binary search.',
        durationMins: 45,
        price: 100,
        difficulty: 'MEDIUM',
        topics: ['Arrays & Strings', 'Sliding Window', 'Binary Search', 'Time & Space Complexity'],
        rubricCriteria: ['Problem Understanding', 'Approach & Optimal Time Complexity', 'Code Correctness', 'Edge Cases Handling'],
        isActive: true,
      },
      {
        id: 'round_a_2',
        tierCode: 'TIER_A',
        roundNumber: 2,
        name: 'Round 2: Technical Coding Interview',
        description: 'In-depth coding on non-linear data structures: trees, graphs, DFS/BFS, and heaps.',
        durationMins: 60,
        price: 100,
        difficulty: 'HARD',
        topics: ['Binary Trees & BST', 'Graph Traversals (DFS/BFS)', 'Topological Sort', 'Priority Queues'],
        rubricCriteria: ['Clarifying Questions', 'Data Structure Selection', 'Algorithmic Optimization', 'Clean Modular Code', 'Dry Run & Testing'],
        isActive: true,
      },
      {
        id: 'round_a_3',
        tierCode: 'TIER_A',
        roundNumber: 3,
        name: 'Round 3: Advanced Technical & Dynamic Programming',
        description: 'Hard-level algorithmic challenges: DP memoization/tabulation, Trie, and complex recursion.',
        durationMins: 60,
        price: 100,
        difficulty: 'HARD',
        topics: ['Dynamic Programming', 'State Transitions', 'Backtracking', 'Bit Manipulation'],
        rubricCriteria: ['Mathematical Intuition', 'Subproblem Formulation', 'Space Optimization', 'Resilience under pressure'],
        isActive: true,
      },
      {
        id: 'round_a_4',
        tierCode: 'TIER_A',
        roundNumber: 4,
        name: 'Round 4: Scalable System Design',
        description: 'Architecting high-scale distributed systems: load balancers, caching, sharding, and fault tolerance.',
        durationMins: 60,
        price: 100,
        difficulty: 'EXPERT',
        topics: ['High-Level Architecture', 'Database Sharding & Caching (Redis)', 'Message Queues (Kafka)', 'CAP Theorem & Trade-offs'],
        rubricCriteria: ['Requirement Scoping & Math Calculations', 'Component Architecture', 'Bottleneck Identification', 'Data Consistency Models'],
        isActive: true,
      },
      {
        id: 'round_a_5',
        tierCode: 'TIER_A',
        roundNumber: 5,
        name: 'Round 5: Executive Behavioral & Leadership Principles',
        description: 'Deep dive into past project failures, technical disagreements, ownership, and engineering values.',
        durationMins: 45,
        price: 100,
        difficulty: 'HARD',
        topics: ['STAR Method', 'Conflict Resolution', 'Ambiguity Handling', 'Innovation & Mentorship'],
        rubricCriteria: ['Actionable STAR Response', 'Humility & Self-Reflection', 'Leadership Impact', 'Culture Fit'],
        isActive: true,
      },
      {
        id: 'round_a_6_ai',
        tierCode: 'TIER_A',
        roundNumber: 6,
        name: 'Round 6: AI / ML & Deep Learning Architecture (Senior / Staff)',
        description: 'Deep dive into Transformer architectures, PyTorch distributed training (FSDP/DDP), vector search embeddings, and LLM inference quantization.',
        durationMins: 60,
        price: 100,
        difficulty: 'EXPERT',
        topics: ['Transformer Attention Math', 'PyTorch Distributed Training & GPU Memory', 'Vector Search & RAG Architecture', 'Quantization (INT8/FP4) & KV-Cache'],
        rubricCriteria: ['Mathematical Deep Learning Intuition', 'Distributed Training Trade-offs', 'Inference Latency Optimization', 'Production Robustness'],
        targetRoles: ['AI Engineer', 'AI / Machine Learning Engineer', 'Data Scientist'],
        targetLevels: ['Senior Engineer (L5 / Senior)', 'Staff / Principal Engineer (L6 / Staff)'],
        isActive: true,
      },
      {
        id: 'round_a_7_ds',
        tierCode: 'TIER_A',
        roundNumber: 7,
        name: 'Round 7: Advanced Data Science & Causal Inference (Senior / Staff)',
        description: 'Statistical experimental design, A/B testing at scale, propensity score matching, gradient boosting internals, and feature stores.',
        durationMins: 60,
        price: 100,
        difficulty: 'HARD',
        topics: ['A/B Experimentation at Scale', 'Causal Inference & Propensity Scoring', 'Tabular Gradient Boosting & Feature Stores', 'SQL Window Functions & Metric Architecture'],
        rubricCriteria: ['Statistical Rigor', 'Hypothesis Formulation', 'Metric Architecture', 'Business Impact'],
        targetRoles: ['Data Scientist', 'AI / Machine Learning Engineer'],
        targetLevels: ['Mid-Level (L4 / SDE-2)', 'Senior Engineer (L5 / Senior)', 'Staff / Principal Engineer (L6 / Staff)'],
        isActive: true,
      },

      // Tier B Rounds
      {
        id: 'round_b_1',
        tierCode: 'TIER_B',
        roundNumber: 1,
        name: 'Round 1: Practical Problem Solving & Data Structures',
        description: 'Hands-on problem solving focused on practical algorithms, hash maps, queues, and string manipulation.',
        durationMins: 45,
        price: 80,
        difficulty: 'MEDIUM',
        topics: ['Stack & Queue Applications', 'Hash Maps', 'Sorting Algorithms', 'String Parsing'],
        rubricCriteria: ['Code Structure & Readability', 'Efficiency', 'Test Case Generation', 'Communication'],
        isActive: true,
      },
      {
        id: 'round_b_2',
        tierCode: 'TIER_B',
        roundNumber: 2,
        name: 'Round 2: API Architecture & Backend System Engineering',
        description: 'Building microservices: schema design, REST/gRPC contracts, indexing, and connection pools.',
        durationMins: 60,
        price: 80,
        difficulty: 'HARD',
        topics: ['RESTful Standards', 'Database Indexing (B-Tree/Hash)', 'Caching Patterns', 'Authentication (JWT/OAuth)'],
        rubricCriteria: ['API Ergonomics', 'Database Modeling', 'Failure Handling', 'Scalability Awareness'],
        isActive: true,
      },
      {
        id: 'round_b_3',
        tierCode: 'TIER_B',
        roundNumber: 3,
        name: 'Round 3: Behavioral & Project Experience Deep Dive',
        description: 'Walkthrough of past production projects, architecture choices, trade-offs, and team collaboration.',
        durationMins: 45,
        price: 80,
        difficulty: 'MEDIUM',
        topics: ['Production Incident Handling', 'Tech Stack Selection', 'Code Review Habits', 'Cross-functional Collaboration'],
        rubricCriteria: ['Articulating Past Architecture', 'Ownership of Deliverables', 'Constructive Communication', 'Technical Depth'],
        isActive: true,
      },
      {
        id: 'round_b_4_ai',
        tierCode: 'TIER_B',
        roundNumber: 4,
        name: 'Round 4: Applied AI Engineering & LLM App Architecture',
        description: 'Building production AI apps: LangChain/LlamaIndex agents, vector search, prompt guardrails, and model latency profiling.',
        durationMins: 60,
        price: 80,
        difficulty: 'HARD',
        topics: ['Embedding Models & Hybrid Vector Search', 'RAG Retrieval Optimization', 'Structured JSON Outputs', 'Prompt Injection Defense'],
        rubricCriteria: ['Applied AI Architecture', 'Latency & Token Cost Optimization', 'Evaluation Frameworks', 'Production Reliability'],
        targetRoles: ['AI Engineer', 'AI / Machine Learning Engineer', 'Software Engineer'],
        targetLevels: ['Junior / Entry-Level (L3 / SDE-1)', 'Mid-Level (L4 / SDE-2)', 'Senior Engineer (L5 / Senior)'],
        isActive: true,
      },
      {
        id: 'round_b_5_ds',
        tierCode: 'TIER_B',
        roundNumber: 5,
        name: 'Round 5: Practical Machine Learning & Feature Engineering',
        description: 'Practical ML model building: Scikit-learn pipelines, cross-validation, ROC-AUC calibration, and drift monitoring.',
        durationMins: 60,
        price: 80,
        difficulty: 'MEDIUM',
        topics: ['Feature Engineering & Selection', 'Model Validation (Stratified K-Fold)', 'ROC-AUC & Precision/Recall Optimization', 'Model Drift & Monitoring'],
        rubricCriteria: ['Data Preprocessing', 'Algorithm Selection', 'Validation Methodology', 'Clear Communication'],
        targetRoles: ['Data Scientist', 'Data Engineer'],
        targetLevels: ['Junior / Entry-Level (L3 / SDE-1)', 'Mid-Level (L4 / SDE-2)', 'Senior Engineer (L5 / Senior)'],
        isActive: true,
      },

      // Tier C Rounds
      {
        id: 'round_c_1',
        tierCode: 'TIER_C',
        roundNumber: 1,
        name: 'Round 1: Fundamentals & Basic Algorithmic Coding',
        description: 'Foundational programming in language of choice, basic data structures, and logical reasoning.',
        durationMins: 45,
        price: 60,
        difficulty: 'ENTRY',
        topics: ['String Manipulation', 'Loops & Recursion', 'Basic Array Search & Sorting', 'OOP Basics'],
        rubricCriteria: ['Syntax & Language Fundamentals', 'Logical Thinking', 'Basic Testing', 'Receptiveness to Hints'],
        isActive: true,
      },
      {
        id: 'round_c_2',
        tierCode: 'TIER_C',
        roundNumber: 2,
        name: 'Round 2: Practical Technical & Project Discussion',
        description: 'Review of academic or capstone projects, small live debugging exercise, and simple SQL queries.',
        durationMins: 45,
        price: 60,
        difficulty: 'ENTRY',
        topics: ['College Project Overview', 'SQL Select & Aggregation', 'Debugging Simple Code', 'Web Basics (HTTP)'],
        rubricCriteria: ['Clarity on College Project', 'SQL Basics', 'Code Explanation', 'Curiosity to Learn'],
        isActive: true,
      },
      {
        id: 'round_c_3',
        tierCode: 'TIER_C',
        roundNumber: 3,
        name: 'Round 3: HR & Behavioral Readiness',
        description: 'Introduction, career goals, strengths/weaknesses, teamwork scenarios, and interview etiquette.',
        durationMins: 30,
        price: 60,
        difficulty: 'ENTRY',
        topics: ['Self Introduction', 'Career Aspirations', 'Handling Pressure', 'Communication Skills'],
        rubricCriteria: ['Confidence & Articulation', 'Preparation Level', 'Positive Attitude', 'Professionalism'],
        isActive: true,
      },
      {
        id: 'round_c_4_ai_ds',
        tierCode: 'TIER_C',
        roundNumber: 4,
        name: 'Round 4: Junior Data Science & AI Foundations',
        description: 'Foundational Python programming for data analysis (NumPy/Pandas basics), supervised ML concepts, and basic SQL data extraction.',
        durationMins: 45,
        price: 60,
        difficulty: 'ENTRY',
        topics: ['Python for Data (NumPy, Pandas)', 'Supervised vs Unsupervised ML Concepts', 'Basic Probability & Statistics', 'SQL Queries (Joins, Aggregations)'],
        rubricCriteria: ['Python Proficiency', 'Basic Statistical Intuition', 'Curiosity & Coachability', 'Structured Thinking'],
        targetRoles: ['Data Scientist', 'AI Engineer', 'Software Engineer'],
        targetLevels: ['Junior / Entry-Level (L3 / SDE-1)'],
        isActive: true,
      },
    ];

    for (const r of roundDefs) {
      this.roundTemplates.set(r.id, r);
    }
  }

  private seedUsers() {
    // Bootstrap Super-Administrator: deepanshu.chawla2608@gmail.com
    const adminId = 'usr_superadmin';
    const superAdminUser: User = {
      id: adminId,
      email: 'deepanshu.chawla2608@gmail.com',
      fullName: 'Deepanshu Chawla',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
      roles: ['ADMIN', 'INTERVIEWER', 'CANDIDATE'],
      activeRole: 'ADMIN',
      isSuspended: false,
      emailVerified: true,
      createdAt: new Date().toISOString(),
    };

    const adminCandProfile: CandidateProfile = {
      id: 'prof_cand_' + adminId,
      userId: adminId,
      targetRoles: ['Full-Stack Engineer', 'Engineering Lead'],
      experienceLevel: '5+_YEARS',
      preferredLanguages: ['TypeScript', 'Python', 'Go'],
      timezone: 'Asia/Kolkata',
      totalSessions: 0,
      totalSpent: 0,
    };

    const adminInterviewerProfile: InterviewerProfile = {
      id: 'prof_int_' + adminId,
      userId: adminId,
      headline: 'Super Administrator & Lead Technical Evaluator',
      bio: 'Platform Owner & Technical Evaluator.',
      experienceYears: 6,
      collegeOrEmployer: 'Interview Arena Leadership',
      currentCompany: 'Interview Arena',
      currentRole: 'Lead Architect',
      skills: ['System Design', 'Algorithms', 'Full Stack', 'Cloud Architecture'],
      preferredTiers: ['TIER_A', 'TIER_B', 'TIER_C'],
      languages: ['English', 'Hindi'],
      status: 'APPROVED',
      isAvailable: true,
      ratingAvg: 5.0,
      ratingCount: 1,
      totalCompletedSessions: 0,
      bankAccountMask: 'ICICI •••• 2608',
      upiId: process.env.UPI_MERCHANT_VPA || 'dev.chawla2608-3@okicici',
      reviewerNotes: 'Super Administrator Account.',
    };

    superAdminUser.candidateProfile = adminCandProfile;
    superAdminUser.interviewerProfile = adminInterviewerProfile;

    this.users.set(adminId, superAdminUser);
    this.candidateProfiles.set(adminId, adminCandProfile);
    this.interviewerProfiles.set(adminId, adminInterviewerProfile);

    // Initial password hash from JWT_SECRET or default
    const initialPassword = process.env.JWT_SECRET || 'RamRam2608@';
    const { salt, hash } = hashPassword(initialPassword);
    this.userCredentials.set(adminId, { hash, salt });

    // Sync to MongoDB asynchronously if connected
    mongoSaveUser({ ...superAdminUser, passwordHash: hash, salt });
    mongoSaveCandidateProfile(adminCandProfile);
    mongoSaveInterviewerProfile(adminInterviewerProfile);
  }

  // Helper method for automated testing suite fixtures
  seedTestFixtures() {
    if (!this.users.has('usr_interviewer_1')) {
      const interviewerUser: User = {
        id: 'usr_interviewer_1',
        email: 'sarah.lead@interviewer.com',
        fullName: 'Sarah Chen',
        roles: ['INTERVIEWER', 'CANDIDATE'],
        activeRole: 'INTERVIEWER',
        isSuspended: false,
        emailVerified: true,
        createdAt: new Date().toISOString(),
      };
      const interviewerProfile: InterviewerProfile = {
        id: 'prof_usr_interviewer_1',
        userId: 'usr_interviewer_1',
        headline: 'Senior Staff Engineer',
        bio: 'Ex-Google SDE',
        experienceYears: 7,
        collegeOrEmployer: 'Stanford University',
        currentCompany: 'Cloud Tech',
        currentRole: 'Senior Staff Engineer',
        skills: ['Data Structures', 'System Design'],
        preferredTiers: ['TIER_A', 'TIER_B', 'TIER_C'],
        languages: ['English'],
        status: 'APPROVED',
        isAvailable: true,
        ratingAvg: 4.9,
        ratingCount: 28,
        totalCompletedSessions: 28,
      };
      this.users.set('usr_interviewer_1', interviewerUser);
      this.interviewerProfiles.set('usr_interviewer_1', interviewerProfile);
    }

    if (!this.users.has('usr_applicant_1')) {
      const applicantUser: User = {
        id: 'usr_applicant_1',
        email: 'alex.morgan@applied.com',
        fullName: 'Alex Morgan',
        roles: ['CANDIDATE'],
        activeRole: 'CANDIDATE',
        isSuspended: false,
        emailVerified: true,
        createdAt: new Date().toISOString(),
      };
      const applicantProfile: InterviewerProfile = {
        id: 'prof_usr_applicant_1',
        userId: 'usr_applicant_1',
        headline: 'Software Engineer',
        bio: 'Applying interviewer',
        experienceYears: 3,
        collegeOrEmployer: 'FinTech Solutions',
        skills: ['Java', 'Spring Boot'],
        preferredTiers: ['TIER_A', 'TIER_B'],
        languages: ['English'],
        status: 'SCREENING_REQUIRED',
        isAvailable: false,
        ratingAvg: 0,
        ratingCount: 0,
        totalCompletedSessions: 0,
      };
      this.users.set('usr_applicant_1', applicantUser);
      this.interviewerProfiles.set('usr_applicant_1', applicantProfile);

      const applicantApp: InterviewerApplication = {
        id: 'app_usr_applicant_1',
        userId: 'usr_applicant_1',
        userEmail: 'alex.morgan@applied.com',
        userName: 'Alex Morgan',
        status: 'SCREENING_REQUIRED',
        submittedAt: new Date().toISOString(),
        yearsOfExperience: 3,
        skills: ['Java', 'Spring Boot', 'Data Structures'],
        currentCompany: 'FinTech Solutions',
        screening1: {
          status: 'PENDING',
          notes: 'Round 1: Coding & Algorithmic Depth',
        },
        screening2: {
          status: 'PENDING',
          notes: 'Round 2: System Architecture & Domain Design',
        },
        screening3: {
          status: 'PENDING',
          notes: 'Round 3: Bar-Raiser & Calibration',
        },
      };
      this.interviewerApplications.set('app_usr_applicant_1', applicantApp);
    }

    // Seed interviewer who is UNDER_REVIEW (has 3 screening interviews: 1 completed, 1 scheduled, 1 pending)
    if (!this.users.has('usr_interviewer_review_1')) {
      const reviewUser: User = {
        id: 'usr_interviewer_review_1',
        email: 'priya.ai@underreview.com',
        fullName: 'Priya Sharma',
        roles: ['INTERVIEWER', 'CANDIDATE'],
        activeRole: 'INTERVIEWER',
        isSuspended: false,
        emailVerified: true,
        createdAt: new Date().toISOString(),
      };
      const reviewProfile: InterviewerProfile = {
        id: 'prof_usr_interviewer_review_1',
        userId: 'usr_interviewer_review_1',
        headline: 'Lead AI Engineer & ML Systems Specialist',
        bio: 'Ex-DeepMind contributor. Applied interviewer specializing in LLMs, distributed training, and neural search.',
        experienceYears: 5,
        collegeOrEmployer: 'Carnegie Mellon University',
        currentCompany: 'Vertex AI Labs',
        currentRole: 'Lead AI Engineer',
        skills: ['PyTorch', 'Transformers', 'Distributed Training', 'System Design', 'Algorithms'],
        preferredTiers: ['TIER_A', 'TIER_B'],
        languages: ['English', 'Hindi'],
        status: 'UNDER_REVIEW',
        isAvailable: false,
        ratingAvg: 0,
        ratingCount: 0,
        totalCompletedSessions: 0,
      };
      this.users.set('usr_interviewer_review_1', reviewUser);
      this.interviewerProfiles.set('usr_interviewer_review_1', reviewProfile);

      const reviewApp: InterviewerApplication = {
        id: 'app_usr_interviewer_review_1',
        userId: 'usr_interviewer_review_1',
        userEmail: 'priya.ai@underreview.com',
        userName: 'Priya Sharma',
        status: 'UNDER_REVIEW',
        submittedAt: new Date(Date.now() - 48 * 3600000).toISOString(),
        yearsOfExperience: 5,
        skills: ['PyTorch', 'Transformers', 'Distributed Training', 'System Design'],
        currentCompany: 'Vertex AI Labs',
        screening1: {
          status: 'COMPLETED',
          score: 9,
          interviewerName: 'Sarah Chen',
          notes: 'Round 1: Coding Depth & Algorithms cleared. Excellent grasp of tensor manipulation, DP, and caching.',
        },
        screening2: {
          status: 'SCHEDULED',
          interviewerName: 'Deepanshu Chawla',
          notes: 'Round 2: System Architecture & Distributed ML Pipelines scheduled.',
        },
        screening3: {
          status: 'PENDING',
          notes: 'Round 3: Bar-Raiser Rubrics & Mentorship Calibration pending.',
        },
        adminNotes: 'Candidate under review. Must clear all 3 screening rounds to receive full platform approval.',
      };
      this.interviewerApplications.set('app_usr_interviewer_review_1', reviewApp);
    }

    // Seed approved interviewer with a blocked calendar slot for testing suppression
    if (!this.users.has('usr_interviewer_marcus')) {
      const marcusUser: User = {
        id: 'usr_interviewer_marcus',
        email: 'marcus.staff@interviewer.com',
        fullName: 'Marcus Vance',
        roles: ['INTERVIEWER', 'CANDIDATE'],
        activeRole: 'INTERVIEWER',
        isSuspended: false,
        emailVerified: true,
        createdAt: new Date().toISOString(),
      };
      const marcusProfile: InterviewerProfile = {
        id: 'prof_usr_interviewer_marcus',
        userId: 'usr_interviewer_marcus',
        headline: 'Staff Infrastructure Architect',
        bio: 'Distributed systems & Kubernetes engineer with 10+ years experience.',
        experienceYears: 10,
        collegeOrEmployer: 'UC Berkeley',
        currentCompany: 'Scale Cloud',
        currentRole: 'Staff Infrastructure Architect',
        skills: ['Distributed Systems', 'Go', 'Kubernetes', 'High Scale Architecture'],
        preferredTiers: ['TIER_A', 'TIER_B', 'TIER_C'],
        languages: ['English'],
        status: 'APPROVED',
        isAvailable: true,
        ratingAvg: 4.95,
        ratingCount: 42,
        totalCompletedSessions: 42,
      };
      this.users.set('usr_interviewer_marcus', marcusUser);
      this.interviewerProfiles.set('usr_interviewer_marcus', marcusProfile);

      // Block slot on 2026-10-27 from 14:00 to 16:00
      this.addBlockedSlot({
        interviewerId: 'usr_interviewer_marcus',
        title: 'Doctor Appointment & Personal Time',
        date: '2026-10-27',
        startTime: '14:00',
        endTime: '16:00',
        reason: 'Hospital follow-up',
      });
    }
  }

  // Issue attendance warning and handle 3-strikes escalation
  issueAttendanceWarning(bookingId: string, reason: string): { success: boolean; message: string; warningCount: number; isBlocked: boolean } {
    const booking = this.bookings.get(bookingId);
    if (!booking) {
      return { success: false, message: 'Booking not found', warningCount: 0, isBlocked: false };
    }
    if (!booking.interviewerId) {
      return { success: false, message: 'No interviewer assigned to this session', warningCount: 0, isBlocked: false };
    }

    const interviewerProf = this.interviewerProfiles.get(booking.interviewerId);
    if (!interviewerProf) {
      return { success: false, message: 'Interviewer profile not found', warningCount: 0, isBlocked: false };
    }

    if (!interviewerProf.warnings) interviewerProf.warnings = [];
    const warningId = 'warn_' + Math.random().toString(36).substring(2, 9);
    const warning: InterviewerAttendanceWarning = {
      id: warningId,
      bookingId,
      bookingRef: booking.bookingRef,
      reason,
      issuedAt: new Date().toISOString(),
      escalatedToAdmin: true,
    };

    interviewerProf.warnings.push(warning);
    interviewerProf.warningCount = (interviewerProf.warningCount || 0) + 1;
    booking.attendanceEscalated = true;

    // Check 3 strikes rule
    const isBlocked = interviewerProf.warningCount >= 3;
    if (isBlocked) {
      interviewerProf.isBlockedByAdmin = true;
      interviewerProf.isAvailable = false;
      interviewerProf.activeSessionId = null;
    }

    mongoSaveInterviewerProfile(interviewerProf);
    mongoSaveBooking(booking);

    // Notify Interviewer
    this.addNotification(
      booking.interviewerId,
      `Attendance Warning #${interviewerProf.warningCount}`,
      `You missed the 10-minute readiness window for session ${booking.bookingRef}. Reason: ${reason}.${isBlocked ? ' CRITICAL: You have accumulated 3 strikes and your account is blocked pending admin review.' : ' Strike warning added.'}`,
      'ALERT'
    );

    // Notify Super Admin
    const superAdmin = Array.from(this.users.values()).find((u) => u.roles.includes('ADMIN'));
    if (superAdmin) {
      this.addNotification(
        superAdmin.id,
        isBlocked ? 'CRITICAL: Interviewer Auto-Blocked (3 Strikes)' : 'Interviewer Attendance Escalation',
        `Interviewer ${booking.interviewerName || booking.interviewerId} received attendance warning #${interviewerProf.warningCount} for session ${booking.bookingRef} (${reason}).${isBlocked ? ' Interviewer has reached 3 strikes and is blocked.' : ''}`,
        'ALERT',
        '/admin-dashboard'
      );
    }

    this.logAudit(
      'system',
      'system@arena.internal',
      'INTERVIEWER_WARNING',
      'INTERVIEWER',
      booking.interviewerId,
      `Warning #${interviewerProf.warningCount} issued for ${booking.bookingRef}. Reason: ${reason}`
    );

    return { success: true, message: 'Attendance warning registered and escalated.', warningCount: interviewerProf.warningCount, isBlocked };
  }

  // Process candidate refund
  processCandidateRefund(bookingId: string, reason: string): { success: boolean; message: string; refund?: Refund } {
    const booking = this.bookings.get(bookingId);
    if (!booking) return { success: false, message: 'Booking not found' };

    if (booking.paymentStatus === 'REFUNDED') {
      return { success: false, message: 'Booking has already been refunded.' };
    }

    const refundId = 'ref_' + Math.random().toString(36).substring(2, 9);
    const refund: Refund = {
      id: refundId,
      refundRef: 'REF-' + booking.bookingRef,
      bookingId: booking.id,
      amount: booking.totalAmount,
      reason,
      status: 'PROCESSED',
      initiatedBy: booking.candidateId,
      createdAt: new Date().toISOString(),
      processedAt: new Date().toISOString(),
    };

    this.refunds.set(refundId, refund);
    booking.paymentStatus = 'REFUNDED';
    booking.status = 'REFUNDED';
    booking.refundRequested = true;
    booking.refundStatus = 'PROCESSED';
    booking.refundReason = reason;
    booking.updatedAt = new Date().toISOString();

    // Release interviewer calendar lock if held
    if (booking.interviewerId) {
      const interviewerProf = this.interviewerProfiles.get(booking.interviewerId);
      if (interviewerProf && interviewerProf.activeSessionId === booking.id) {
        interviewerProf.activeSessionId = null;
        interviewerProf.isAvailable = true;
        mongoSaveInterviewerProfile(interviewerProf);
      }
    }

    // Ledger Refund entry
    this.addLedgerEntry({
      bookingId: booking.id,
      userId: booking.candidateId,
      type: 'REFUND_DEBIT',
      amount: -booking.totalAmount,
      description: `Refund processed for ${booking.bookingRef}: ${reason}`,
      referenceId: 'REF-' + booking.bookingRef,
    });

    mongoSaveBooking(booking);

    this.addNotification(
      booking.candidateId,
      'Refund Processed Successfully',
      `Full refund of ₹${booking.totalAmount} for booking ${booking.bookingRef} has been approved and processed. Reason: ${reason}`,
      'SUCCESS'
    );

    return { success: true, message: 'Refund processed successfully', refund };
  }

  // File dispute/complaint
  fileCandidateDispute(bookingId: string, candidateId: string, category: string, reason: string, requestedResolution: string): { success: boolean; message: string; dispute?: DisputeReport } {
    const booking = this.bookings.get(bookingId);
    if (!booking) return { success: false, message: 'Booking not found' };

    const disputeId = 'disp_' + Math.random().toString(36).substring(2, 9);
    const dispute: DisputeReport = {
      id: disputeId,
      bookingId: booking.id,
      raisedByUserId: candidateId,
      raisedByRole: 'CANDIDATE',
      reason: category,
      description: reason,
      status: 'OPEN',
      createdAt: new Date().toISOString(),
    };

    this.disputes.set(disputeId, dispute);
    booking.disputeId = disputeId;
    mongoSaveBooking(booking);

    // Notify Super Admin
    const superAdmin = Array.from(this.users.values()).find((u) => u.roles.includes('ADMIN'));
    if (superAdmin) {
      this.addNotification(
        superAdmin.id,
        'New Candidate Complaint Filed',
        `Candidate filed dispute for session ${booking.bookingRef}: "${reason}". Category: ${category}`,
        'ALERT',
        '/admin-dashboard'
      );
    }

    return { success: true, message: 'Dispute registered with platform administration.', dispute };
  }

  // Resolve dispute
  resolveDispute(disputeId: string, resolution: 'RESOLVED_REFUND' | 'RESOLVED_DISMISSED', adminNotes: string): { success: boolean; message: string } {
    const dispute = this.disputes.get(disputeId);
    if (!dispute) return { success: false, message: 'Dispute not found' };

    dispute.status = resolution;
    dispute.adminNotes = adminNotes;
    dispute.resolvedAt = new Date().toISOString();

    if (resolution === 'RESOLVED_REFUND') {
      this.processCandidateRefund(dispute.bookingId, `Dispute resolution: ${adminNotes}`);
    }

    const booking = this.bookings.get(dispute.bookingId);
    if (booking) {
      this.addNotification(
        booking.candidateId,
        'Complaint Resolution Update',
        `Your dispute for session ${booking.bookingRef} was resolved. Resolution: ${resolution}. Note: ${adminNotes}`,
        'INFO'
      );
    }

    return { success: true, message: 'Dispute marked as resolved.' };
  }

  // Clear interviewer warnings
  clearInterviewerWarnings(interviewerId: string): { success: boolean; message: string } {
    const prof = this.interviewerProfiles.get(interviewerId);
    if (!prof) return { success: false, message: 'Interviewer profile not found' };

    prof.warningCount = 0;
    prof.warnings = [];
    prof.isBlockedByAdmin = false;
    mongoSaveInterviewerProfile(prof);

    this.addNotification(
      interviewerId,
      'Attendance Strikes Cleared',
      'Administrator has reviewed your record and reset your attendance strikes to 0. Your account is active.',
      'SUCCESS'
    );

    return { success: true, message: 'Interviewer warnings cleared.' };
  }

  // Block/unblock interviewer
  toggleBlockInterviewer(interviewerId: string, isBlocked: boolean, reason: string): { success: boolean; message: string } {
    const prof = this.interviewerProfiles.get(interviewerId);
    if (!prof) return { success: false, message: 'Interviewer profile not found' };

    prof.isBlockedByAdmin = isBlocked;
    if (isBlocked) prof.isAvailable = false;
    mongoSaveInterviewerProfile(prof);

    this.addNotification(
      interviewerId,
      isBlocked ? 'Account Blocked by Administrator' : 'Account Reactivated',
      isBlocked
        ? `Your interviewer privileges have been suspended. Reason: ${reason}`
        : 'Your interviewer privileges have been restored by an administrator.',
      isBlocked ? 'ALERT' : 'SUCCESS'
    );

    return { success: true, message: isBlocked ? 'Interviewer blocked' : 'Interviewer unblocked' };
  }
}

export const store = new MemoryStore();
