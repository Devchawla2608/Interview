import { Router } from 'express';
import { store } from '../store';
import { InterviewerApplication, InterviewerProfile, PayoutRecord } from '../../types';
import { mongoSaveInterviewerProfile } from '../../db/mongodb';

export const interviewerRouter = Router();

// Middleware: must be logged in for all interviewer endpoints
interviewerRouter.use((req: any, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }
  next();
});

// Get interviewer profile and application status
interviewerRouter.get('/profile', (req: any, res) => {
  const userId = req.user.id;
  const profile = store.interviewerProfiles.get(userId);
  const application = Array.from(store.interviewerApplications.values()).find((a) => a.userId === userId);

  return res.json({ profile, application });
});

// Submit interviewer application
interviewerRouter.post('/apply', (req: any, res) => {
  const userId = req.user.id;
  const user = req.user;

  const {
    headline,
    bio,
    experienceYears,
    collegeOrEmployer,
    currentCompany,
    currentRole,
    skills,
    preferredTiers,
    languages,
    upiId,
    bankAccountMask,
  } = req.body;

  // Create / Update Interviewer Profile
  const profile: InterviewerProfile = {
    id: 'prof_' + userId,
    userId,
    headline: headline || 'Software Engineer',
    bio: bio || '',
    experienceYears: Number(experienceYears) || 2,
    collegeOrEmployer: collegeOrEmployer || '',
    currentCompany: currentCompany || '',
    currentRole: currentRole || '',
    skills: skills || ['Data Structures', 'System Design'],
    preferredTiers: preferredTiers || ['TIER_A', 'TIER_B'],
    languages: languages || ['English'],
    status: 'SCREENING_REQUIRED',
    isAvailable: false,
    ratingAvg: 5.0,
    ratingCount: 0,
    totalCompletedSessions: 0,
    bankAccountMask: bankAccountMask || '',
    upiId: upiId || '',
  };

  store.interviewerProfiles.set(userId, profile);
  mongoSaveInterviewerProfile(profile);

  if (!user.roles.includes('INTERVIEWER')) {
    user.roles.push('INTERVIEWER');
  }

  // Create Interviewer Application for Admin Review
  const appId = 'app_' + Math.random().toString(36).substring(2, 9);
  const application: InterviewerApplication = {
    id: appId,
    userId,
    userEmail: user.email,
    userName: user.fullName,
    status: 'SCREENING_REQUIRED',
    submittedAt: new Date().toISOString(),
    yearsOfExperience: Number(experienceYears) || 2,
    skills: skills || ['Data Structures', 'System Design'],
    currentCompany: currentCompany || '',
    screening1: {
      status: 'PENDING',
    },
    screening2: {
      status: 'PENDING',
    },
    screening3: {
      status: 'PENDING',
    },
  };

  store.interviewerApplications.set(appId, application);

  store.addNotification(
    userId,
    'Interviewer Application Submitted',
    'Your application has been received. Complete the screening review with our panel to get approved.',
    'SUCCESS'
  );

  return res.status(201).json({ success: true, profile, application });
});

// Toggle availability (Online/Offline)
interviewerRouter.post('/toggle-availability', (req: any, res) => {
  const userId = req.user.id;
  const profile = store.interviewerProfiles.get(userId);
  if (!profile) return res.status(404).json({ error: 'Interviewer profile not found' });

  if (profile.status !== 'APPROVED') {
    return res.status(403).json({ error: 'Only approved interviewers can go online and accept sessions.' });
  }

  profile.isAvailable = !profile.isAvailable;
  return res.json({ success: true, isAvailable: profile.isAvailable });
});

// Get interviewer earnings
interviewerRouter.get('/earnings', (req: any, res) => {
  const userId = req.user.id;
  let earnings = store.earnings.get(userId);

  if (!earnings) {
    earnings = {
      interviewerId: userId,
      pendingBalance: 0,
      availableBalance: 0,
      paidBalance: 0,
      totalEarned: 0,
      payoutHistory: [],
    };
    store.earnings.set(userId, earnings);
  }

  // Also include completed sessions list
  const completedSessions = Array.from(store.bookings.values()).filter(
    (b) => b.interviewerId === userId && b.status === 'COMPLETED'
  );

  return res.json({ earnings, completedSessions });
});

// Request payout
interviewerRouter.post('/request-payout', (req: any, res) => {
  const userId = req.user.id;
  const { amount, destination } = req.body;

  const earnings = store.earnings.get(userId);
  if (!earnings) return res.status(404).json({ error: 'Earnings record not found' });

  const numAmount = Number(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({ error: 'Invalid payout amount' });
  }

  if (numAmount > earnings.availableBalance) {
    return res.status(400).json({ error: `Amount exceeds available balance (₹${earnings.availableBalance})` });
  }

  const payoutRef = 'PAY-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000);
  const payout: PayoutRecord = {
    id: 'pay_' + Math.random().toString(36).substring(2, 9),
    payoutRef,
    amount: numAmount,
    status: 'PROCESSED',
    destination: destination || 'Verified UPI ID',
    referenceCode: 'NEFT-' + Math.floor(100000000 + Math.random() * 900000000),
    createdAt: new Date().toISOString(),
    processedAt: new Date().toISOString(),
  };

  earnings.availableBalance -= numAmount;
  earnings.paidBalance += numAmount;
  earnings.payoutHistory.unshift(payout);

  // Record in ledger
  store.addLedgerEntry({
    userId,
    type: 'PAYOUT_DEBIT',
    amount: -numAmount,
    description: `Payout processed (${payoutRef}) to ${destination || 'UPI/Bank'}`,
    referenceId: payoutRef,
  });

  store.addNotification(
    userId,
    'Payout Transferred!',
    `Payout of ₹${numAmount} (${payoutRef}) has been successfully processed to ${destination || 'your registered account'}.`,
    'SUCCESS'
  );

  return res.json({ success: true, payout, earnings });
});

// Get Availability slots
interviewerRouter.get('/availability', (req: any, res) => {
  const userId = req.user.id;
  const slots = Array.from(store.availability.values()).filter((a) => a.interviewerId === userId);
  return res.json({ slots });
});

// Update Availability slots
interviewerRouter.post('/availability', (req: any, res) => {
  const userId = req.user.id;
  const { slots } = req.body; // array of { dayOfWeek, startTime, endTime }

  // Clear existing
  for (const [id, s] of store.availability.entries()) {
    if (s.interviewerId === userId) {
      store.availability.delete(id);
    }
  }

  if (Array.isArray(slots)) {
    for (const s of slots) {
      const slot = {
        id: 'avail_' + Math.random().toString(36).substring(2, 9),
        interviewerId: userId,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        isActive: true,
      };
      store.availability.set(slot.id, slot);
    }
  }

  return res.json({ success: true, slots: Array.from(store.availability.values()).filter((a) => a.interviewerId === userId) });
});

// Update Interviewer Profile Questionnaire
interviewerRouter.post('/profile/update', (req: any, res) => {
  const userId = req.user.id;
  let profile = store.interviewerProfiles.get(userId);
  if (!profile) {
    profile = {
      id: 'prof_' + userId,
      userId,
      headline: 'Software Engineer',
      bio: '',
      experienceYears: 2,
      collegeOrEmployer: '',
      skills: ['Data Structures', 'System Design'],
      preferredTiers: ['TIER_A', 'TIER_B', 'TIER_C'],
      languages: ['English'],
      status: 'APPROVED',
      isAvailable: true,
      ratingAvg: 5.0,
      ratingCount: 0,
      totalCompletedSessions: 0,
    };
  }

  const {
    headline,
    bio,
    experienceYears,
    collegeOrEmployer,
    currentCompany,
    currentRole,
    skills,
    primaryInterviewDomains,
    preferredTiers,
    languages,
    upiId,
    linkedinUrl,
    githubUrl,
  } = req.body;

  if (headline !== undefined) profile.headline = headline;
  if (bio !== undefined) profile.bio = bio;
  if (experienceYears !== undefined) profile.experienceYears = Number(experienceYears) || profile.experienceYears;
  if (collegeOrEmployer !== undefined) profile.collegeOrEmployer = collegeOrEmployer;
  if (currentCompany !== undefined) profile.currentCompany = currentCompany;
  if (currentRole !== undefined) profile.currentRole = currentRole;
  if (skills !== undefined) profile.skills = skills;
  if (primaryInterviewDomains !== undefined) profile.primaryInterviewDomains = primaryInterviewDomains;
  if (preferredTiers !== undefined) profile.preferredTiers = preferredTiers;
  if (languages !== undefined) profile.languages = languages;
  if (upiId !== undefined) profile.upiId = upiId;
  if (linkedinUrl !== undefined) profile.linkedinUrl = linkedinUrl;
  if (githubUrl !== undefined) profile.githubUrl = githubUrl;

  // Calculate completion percentage
  let score = 0;
  if (profile.headline) score += 10;
  if (profile.bio) score += 10;
  if (profile.currentCompany) score += 15;
  if (profile.currentRole) score += 10;
  if (profile.experienceYears > 0) score += 10;
  if (profile.skills && profile.skills.length > 0) score += 15;
  if (profile.primaryInterviewDomains && profile.primaryInterviewDomains.length > 0) score += 15;
  if (profile.upiId) score += 15;

  profile.profileCompletionPercent = Math.min(score, 100);

  store.interviewerProfiles.set(userId, profile);
  mongoSaveInterviewerProfile(profile);

  return res.json({ success: true, profile });
});

// Get Interviewer Calendar (Booked sessions, blocked periods, recurring availability)
interviewerRouter.get('/calendar', (req: any, res) => {
  const userId = req.user.id;
  const bookedSessions = Array.from(store.bookings.values()).filter(
    (b) => b.interviewerId === userId
  );
  const blockedSlots = store.getInterviewerBlockedSlots(userId);
  const availabilitySlots = Array.from(store.availability.values()).filter(
    (a) => a.interviewerId === userId
  );

  return res.json({
    bookedSessions,
    blockedSlots,
    availabilitySlots,
  });
});

// Block a slot on calendar (Suppresses notifications during this window)
interviewerRouter.post('/calendar/block', (req: any, res) => {
  const userId = req.user.id;
  const { title, date, startTime, endTime, reason } = req.body;

  if (!date || !startTime || !endTime) {
    return res.status(400).json({ error: 'Date, start time, and end time are required to block a slot.' });
  }

  const slot = store.addBlockedSlot({
    interviewerId: userId,
    title: title || 'Blocked Period',
    date,
    startTime,
    endTime,
    reason: reason || 'Interviewer personal block',
  });

  return res.status(201).json({ success: true, slot });
});

// Delete / Unblock a calendar slot
interviewerRouter.delete('/calendar/block/:id', (req: any, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  const success = store.removeBlockedSlot(id, userId);
  if (!success) {
    return res.status(404).json({ error: 'Blocked slot not found or not owned by you.' });
  }

  return res.json({ success: true, message: 'Calendar slot unblocked successfully.' });
});

// Get available scheduled requests waiting for an interviewer to accept
interviewerRouter.get('/scheduled-requests', (req: any, res) => {
  const userId = req.user.id;
  const profile = store.interviewerProfiles.get(userId);

  if (!profile || profile.status !== 'APPROVED') {
    return res.json({ scheduledRequests: [] });
  }

  // Filter scheduled sessions matching tier and NOT calendar blocked
  const allScheduled = Array.from(store.bookings.values()).filter(
    (b) =>
      b.bookingType === 'SCHEDULED' &&
      b.status === 'SCHEDULED' &&
      !b.interviewerId &&
      profile.preferredTiers.includes(b.tierCode)
  );

  const eligibleScheduled = allScheduled.map((b) => {
    const blockCheck = store.isInterviewerCalendarBlocked(
      userId,
      b.scheduledAt || b.createdAt,
      b.roundDurationMins || 45
    );
    return {
      ...b,
      isBlockedForMe: blockCheck.isBlocked,
      blockedReason: blockCheck.reason,
    };
  });

  return res.json({ scheduledRequests: eligibleScheduled });
});

// Accept a scheduled booking
interviewerRouter.post('/accept-scheduled/:bookingId', async (req: any, res) => {
  const userId = req.user.id;
  const { bookingId } = req.params;

  const result = await store.acceptScheduledBookingAtomic(bookingId, userId);
  if (!result.success) {
    return res.status(400).json({ error: result.message });
  }

  return res.json(result);
});

