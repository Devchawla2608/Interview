import { Router } from 'express';
import { store } from '../store';
import { TierCode } from '../../types';

export const adminRouter = Router();

// Middleware checking Admin authorization
adminRouter.use((req: any, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required. Please sign in as an administrator.' });
  }
  if (!req.user.roles.includes('ADMIN')) {
    return res.status(403).json({ error: 'Forbidden: Administrator privileges required.' });
  }
  next();
});

// Real Database-backed Platform Metrics
adminRouter.get('/metrics', (req, res) => {
  const metrics = store.getPlatformMetrics();
  return res.json({ metrics });
});

// Users Management
adminRouter.get('/users', (req, res) => {
  const users = Array.from(store.users.values()).map((u) => ({
    ...u,
    candidateProfile: store.candidateProfiles.get(u.id),
    interviewerProfile: store.interviewerProfiles.get(u.id),
  }));
  return res.json({ users });
});

// Suspend / Reactivate User
adminRouter.post('/users/:id/status', (req, res) => {
  const { id } = req.params;
  const { isSuspended, reason = 'Administrative action' } = req.body;
  const adminId = (req as any).user?.id || (req.headers['x-user-id'] as string);

  const user = store.users.get(id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  user.isSuspended = Boolean(isSuspended);

  store.logAudit(
    adminId,
    'admin@interviewarena.com',
    user.isSuspended ? 'USER_SUSPENDED' : 'USER_REACTIVATED',
    'USER',
    user.id,
    `Status changed to ${user.isSuspended ? 'Suspended' : 'Active'}. Reason: ${reason}`
  );

  return res.json({ success: true, user });
});

// Interviewer Applications
adminRouter.get('/interviewer-applications', (req, res) => {
  const apps = Array.from(store.interviewerApplications.values()).sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  );
  return res.json({ applications: apps });
});

// Evaluate Interviewer Application / Screenings
adminRouter.post('/interviewer-applications/:id/evaluate', (req, res) => {
  const { id } = req.params;
  const {
    action, // 'APPROVE' | 'REJECT' | 'UPDATE_SCREENING'
    screeningNumber, // 1 or 2
    screeningStatus, // 'COMPLETED' | 'FAILED'
    score,
    notes,
    adminNotes,
  } = req.body;
  const adminId = (req as any).user?.id || (req.headers['x-user-id'] as string);

  const app = store.interviewerApplications.get(id);
  if (!app) return res.status(404).json({ error: 'Application not found' });

  const interviewerProfile = store.interviewerProfiles.get(app.userId);

  if (action === 'UPDATE_SCREENING') {
    if (screeningNumber === 1) {
      app.screening1.status = screeningStatus || 'COMPLETED';
      if (score !== undefined) app.screening1.score = Number(score);
      if (notes) app.screening1.notes = notes;
    } else if (screeningNumber === 2) {
      app.screening2.status = screeningStatus || 'COMPLETED';
      if (score !== undefined) app.screening2.score = Number(score);
      if (notes) app.screening2.notes = notes;
    } else if (screeningNumber === 3) {
      if (!app.screening3) {
        app.screening3 = { status: 'PENDING' };
      }
      app.screening3.status = screeningStatus || 'COMPLETED';
      if (score !== undefined) app.screening3.score = Number(score);
      if (notes) app.screening3.notes = notes;
    }

    // Check if all 3 screening interviews are now completed & cleared
    const isRound1Passed = app.screening1?.status === 'COMPLETED';
    const isRound2Passed = app.screening2?.status === 'COMPLETED';
    const isRound3Passed = app.screening3?.status === 'COMPLETED';

    if (isRound1Passed && isRound2Passed && isRound3Passed) {
      app.status = 'APPROVED';
      app.reviewedAt = new Date().toISOString();
      app.adminNotes = adminNotes || 'All 3 screening rounds (Coding Depth, System Architecture, and Bar-Raiser Rubrics) cleared successfully. Approved.';
      if (interviewerProfile) {
        interviewerProfile.status = 'APPROVED';
        interviewerProfile.isAvailable = true;
      }
      store.addNotification(
        app.userId,
        'Congratulations! All 3 Screening Rounds Passed',
        'You have successfully cleared all 3 screening rounds. Your interviewer account is now APPROVED and ready to accept candidate sessions!',
        'SUCCESS',
        '/interviewer'
      );
    }
  } else if (action === 'APPROVE') {
    const isRound1Passed = app.screening1?.status === 'COMPLETED';
    const isRound2Passed = app.screening2?.status === 'COMPLETED';
    const isRound3Passed = app.screening3?.status === 'COMPLETED';

    if (!isRound1Passed || !isRound2Passed || !isRound3Passed) {
      return res.status(400).json({
        error: 'Interviewer must clear all 3 screening interviews (Round 1: Coding Depth, Round 2: System Architecture, Round 3: Bar-Raiser Rubric) before approval.',
      });
    }

    app.status = 'APPROVED';
    app.adminNotes = adminNotes || 'All 3 screening interviews passed with verified rubrics. Approved.';
    app.reviewedAt = new Date().toISOString();
    if (interviewerProfile) {
      interviewerProfile.status = 'APPROVED';
      interviewerProfile.isAvailable = true;
    }
    store.addNotification(
      app.userId,
      'Congratulations! You are an Approved Interviewer',
      'Your application and all 3 screening interviews were approved. You can now toggle your availability online and accept paid mock interview sessions!',
      'SUCCESS',
      '/interviewer'
    );
  } else if (action === 'REJECT') {
    app.status = 'REJECTED';
    app.adminNotes = adminNotes || 'Application does not meet current rubric thresholds across the 3 screening interviews.';
    app.reviewedAt = new Date().toISOString();
    if (interviewerProfile) {
      interviewerProfile.status = 'REJECTED';
      interviewerProfile.isAvailable = false;
    }
    store.addNotification(
      app.userId,
      'Interviewer Application Update',
      'Thank you for your interest. At this time your application has not been approved across all 3 screening stages. You may re-apply after 90 days.',
      'WARNING'
    );
  } else if (action === 'SET_UNDER_REVIEW') {
    app.status = 'UNDER_REVIEW';
    if (adminNotes) app.adminNotes = adminNotes;
    if (interviewerProfile) {
      interviewerProfile.status = 'UNDER_REVIEW';
      interviewerProfile.isAvailable = false;
    }
    store.addNotification(
      app.userId,
      'Application Status: Under Review',
      'Your application is now under review. Please prepare for your 3 screening interviews.',
      'INFO',
      '/interviewer'
    );
  }

  store.logAudit(
    adminId,
    'admin@interviewarena.com',
    'INTERVIEWER_EVALUATED',
    'APPLICATION',
    app.id,
    `Action: ${action}, Application status: ${app.status}`
  );

  return res.json({ success: true, application: app, profile: interviewerProfile });
});

// Update Tier Configuration
adminRouter.post('/tiers/:code', (req, res) => {
  const { code } = req.params;
  const { price, commissionPercent, description, name, isActive } = req.body;
  const adminId = (req as any).user?.id || (req.headers['x-user-id'] as string);

  const tier = store.tiers.get(code as TierCode);
  if (!tier) return res.status(404).json({ error: 'Tier not found' });

  if (price !== undefined) tier.price = Number(price);
  if (commissionPercent !== undefined) tier.commissionPercent = Number(commissionPercent);
  if (description) tier.description = description;
  if (name) tier.name = name;
  if (isActive !== undefined) tier.isActive = Boolean(isActive);

  store.logAudit(
    adminId,
    'admin@interviewarena.com',
    'TIER_UPDATED',
    'TIER',
    tier.code,
    `Updated price to ₹${tier.price}, commission to ${tier.commissionPercent}%`
  );

  return res.json({ success: true, tier });
});

// Round Management (Add or Update)
adminRouter.post('/rounds', (req, res) => {
  const { id, tierCode, roundNumber, name, description, durationMins, price, difficulty, topics, rubricCriteria } = req.body;
  const adminId = (req as any).user?.id || (req.headers['x-user-id'] as string);

  let round = id ? store.roundTemplates.get(id) : null;
  const isNew = !round;

  if (!round) {
    round = {
      id: id || 'round_' + Math.random().toString(36).substring(2, 9),
      tierCode: tierCode || 'TIER_A',
      roundNumber: Number(roundNumber) || 1,
      name: name || 'New Round',
      description: description || '',
      durationMins: Number(durationMins) || 45,
      price: Number(price) || 100,
      difficulty: difficulty || 'MEDIUM',
      topics: topics || [],
      rubricCriteria: rubricCriteria || [],
      isActive: true,
    };
  } else {
    if (name) round.name = name;
    if (description) round.description = description;
    if (durationMins) round.durationMins = Number(durationMins);
    if (price !== undefined) round.price = Number(price);
    if (difficulty) round.difficulty = difficulty;
    if (topics) round.topics = topics;
    if (rubricCriteria) round.rubricCriteria = rubricCriteria;
  }

  store.roundTemplates.set(round.id, round);

  store.logAudit(
    adminId,
    'admin@interviewarena.com',
    isNew ? 'ROUND_CREATED' : 'ROUND_UPDATED',
    'ROUND',
    round.id,
    `Round: ${round.name}`
  );

  return res.json({ success: true, round });
});

// Immutable Accounting Ledger
adminRouter.get('/ledger', (req, res) => {
  return res.json({ ledger: store.ledger });
});

// Refunds Review
adminRouter.get('/refunds', (req, res) => {
  const refunds = Array.from(store.refunds.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  return res.json({ refunds });
});

// Approve or Reject Refund
adminRouter.post('/refunds/:id/action', (req, res) => {
  const { id } = req.params;
  const { action, adminNotes } = req.body; // 'APPROVE' or 'REJECT'
  const adminId = (req as any).user?.id || (req.headers['x-user-id'] as string);

  const refund = store.refunds.get(id);
  if (!refund) return res.status(404).json({ error: 'Refund record not found' });

  const booking = store.bookings.get(refund.bookingId);

  if (action === 'APPROVE') {
    refund.status = 'PROCESSED';
    refund.adminNotes = adminNotes || 'Admin approved refund';
    refund.processedAt = new Date().toISOString();
    if (booking) {
      booking.status = 'REFUNDED';
      booking.paymentStatus = 'REFUNDED';
    }

    // Ledger debit
    store.addLedgerEntry({
      bookingId: refund.bookingId,
      userId: booking?.candidateId,
      type: 'REFUND_DEBIT',
      amount: -refund.amount,
      description: `Manual admin refund approved for ${refund.refundRef}`,
      referenceId: refund.refundRef,
    });

    if (booking) {
      store.addNotification(
        booking.candidateId,
        'Refund Approved',
        `Your refund request of ₹${refund.amount} for session ${booking.bookingRef} has been approved and issued.`,
        'SUCCESS'
      );
    }
  } else {
    refund.status = 'REJECTED';
    refund.adminNotes = adminNotes || 'Admin rejected refund request';
    refund.processedAt = new Date().toISOString();
  }

  store.logAudit(
    adminId,
    'admin@interviewarena.com',
    action === 'APPROVE' ? 'REFUND_APPROVED' : 'REFUND_REJECTED',
    'REFUND',
    refund.id,
    `Amount: ₹${refund.amount}. Notes: ${refund.adminNotes}`
  );

  return res.json({ success: true, refund });
});

// Disputes / Complaints
adminRouter.get('/disputes', (req, res) => {
  const disputes = Array.from(store.disputes.values()).sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );
  return res.json({ disputes });
});

// Interviewer Warnings & Strikes List
adminRouter.get('/interviewer-warnings', (req, res) => {
  const interviewers = Array.from(store.interviewerProfiles.values())
    .filter((p) => (p.warningCount && p.warningCount > 0) || p.isBlockedByAdmin || (p.warnings && p.warnings.length > 0))
    .map((p) => {
      const user = store.users.get(p.userId);
      return {
        ...p,
        userFullName: user?.fullName || 'Interviewer',
        userEmail: user?.email || '',
      };
    });
  return res.json({ interviewers });
});

// Clear Interviewer Strikes
adminRouter.post('/interviewers/:id/clear-warnings', (req, res) => {
  const { id } = req.params;
  const result = store.clearInterviewerWarnings(id);
  return res.json(result);
});

// Toggle Interviewer Block
adminRouter.post('/interviewers/:id/toggle-block', (req, res) => {
  const { id } = req.params;
  const { isBlocked, reason } = req.body;
  const result = store.toggleBlockInterviewer(id, Boolean(isBlocked), reason || 'Admin action');
  return res.json(result);
});

// Resolve Dispute
adminRouter.post('/disputes/:id/resolve', (req, res) => {
  const { id } = req.params;
  const { resolution, adminNotes } = req.body; // 'RESOLVED_REFUND' | 'RESOLVED_DISMISSED'
  const adminId = (req as any).user?.id || (req.headers['x-user-id'] as string);

  const dispute = store.disputes.get(id);
  if (!dispute) return res.status(404).json({ error: 'Dispute not found' });

  dispute.status = resolution;
  dispute.adminNotes = adminNotes;
  dispute.resolvedAt = new Date().toISOString();

  const booking = store.bookings.get(dispute.bookingId);
  if (booking) {
    if (resolution === 'RESOLVED_REFUND') {
      booking.status = 'REFUNDED';
      booking.paymentStatus = 'REFUNDED';
      store.addLedgerEntry({
        bookingId: booking.id,
        userId: booking.candidateId,
        type: 'REFUND_DEBIT',
        amount: -booking.totalAmount,
        description: `Dispute resolved with full refund for booking ${booking.bookingRef}`,
        referenceId: 'DISP-REF-' + dispute.id,
      });
      store.addNotification(
        booking.candidateId,
        'Dispute Resolved: Full Refund Issued',
        `Your dispute for session ${booking.bookingRef} was reviewed and resolved with a full refund of ₹${booking.totalAmount}.`,
        'SUCCESS'
      );
    } else {
      booking.status = 'COMPLETED';
    }
  }

  store.logAudit(
    adminId,
    'admin@interviewarena.com',
    'DISPUTE_RESOLVED',
    'DISPUTE',
    dispute.id,
    `Resolution: ${resolution}`
  );

  return res.json({ success: true, dispute });
});

// Audit Logs
adminRouter.get('/audit-logs', (req, res) => {
  return res.json({ logs: store.auditLogs });
});

// Settings
adminRouter.get('/settings', (req, res) => {
  return res.json({ settings: store.settings });
});

adminRouter.post('/settings', (req, res) => {
  const { commissionPercent, queueTimeoutMinutes, claimTimeoutMinutes, autoRefundOnTimeout, platformNotice } = req.body;
  const adminId = (req as any).user?.id || (req.headers['x-user-id'] as string);

  if (commissionPercent !== undefined) store.settings.commissionPercent = Number(commissionPercent);
  if (queueTimeoutMinutes !== undefined) store.settings.queueTimeoutMinutes = Number(queueTimeoutMinutes);
  if (claimTimeoutMinutes !== undefined) store.settings.claimTimeoutMinutes = Number(claimTimeoutMinutes);
  if (autoRefundOnTimeout !== undefined) store.settings.autoRefundOnTimeout = Boolean(autoRefundOnTimeout);
  if (platformNotice !== undefined) store.settings.platformNotice = platformNotice;

  store.logAudit(
    adminId,
    'admin@interviewarena.com',
    'SETTINGS_UPDATED',
    'APP_SETTINGS',
    'GLOBAL',
    `Commission set to ${store.settings.commissionPercent}%, Queue timeout to ${store.settings.queueTimeoutMinutes}m`
  );

  return res.json({ success: true, settings: store.settings });
});

// Admin View of any Interviewer's Calendar
adminRouter.get('/interviewers/:id/calendar', (req, res) => {
  const { id } = req.params;
  const user = store.users.get(id);
  const profile = store.interviewerProfiles.get(id);

  if (!user && !profile) {
    return res.status(404).json({ error: 'Interviewer not found' });
  }

  const bookedSessions = Array.from(store.bookings.values()).filter(
    (b) => b.interviewerId === id
  );

  const blockedSlots = store.getInterviewerBlockedSlots(id);
  const availabilitySlots = Array.from(store.availability.values()).filter(
    (a) => a.interviewerId === id
  );

  return res.json({
    interviewer: {
      id,
      fullName: user?.fullName || 'Interviewer',
      email: user?.email,
      status: profile?.status,
      isAvailable: profile?.isAvailable,
      isBlockedByAdmin: profile?.isBlockedByAdmin,
      warningCount: profile?.warningCount || 0,
    },
    bookedSessions,
    blockedSlots,
    availabilitySlots,
  });
});

