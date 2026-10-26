import { Router } from 'express';
import { store } from '../store';
import { TierCode, Booking, Refund } from '../../types';

export const bookingsRouter = Router();

// List bookings
bookingsRouter.get('/', (req: any, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }
  const userId = req.user.id;
  const role = req.user.activeRole;

  const allBookings = Array.from(store.bookings.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  if (role === 'ADMIN' || req.user.roles.includes('ADMIN')) {
    return res.json({ bookings: allBookings });
  }

  if (role === 'INTERVIEWER') {
    const filtered = allBookings.filter((b) => b.interviewerId === userId);
    return res.json({ bookings: filtered });
  }

  // Candidate
  const filtered = allBookings.filter((b) => b.candidateId === userId);
  return res.json({ bookings: filtered });
});

// Single booking details with feedback and reviews
bookingsRouter.get('/:id', (req, res) => {
  const { id } = req.params;
  const booking = store.bookings.get(id);
  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  const feedback = store.feedback.get(id);
  const review = store.reviews.get(id);

  return res.json({ booking, feedback, review });
});

// Create booking (Server-side price validation!)
bookingsRouter.post('/create', (req: any, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required to book a session.' });
  }
  const user = req.user;
  const userId = user.id;

  const {
    tierCode,
    trackName,
    roundName,
    roundNumber,
    roundDurationMins = 45,
    bookingType = 'QUEUE',
    scheduledAt,
    preferredLanguage = 'English',
    jobRole = 'Software Engineer',
    seniorityLevel = 'Mid-Level (L4 / SDE-2)',
  } = req.body as {
    tierCode: TierCode;
    trackName: string;
    roundName: string;
    roundNumber: number;
    roundDurationMins: number;
    bookingType: 'QUEUE' | 'SCHEDULED';
    scheduledAt?: string;
    preferredLanguage: string;
    jobRole: string;
    seniorityLevel?: string;
  };

  // Crucial: Validate price from server config, never trust client
  const tier = store.tiers.get(tierCode);
  if (!tier || !tier.isActive) {
    return res.status(400).json({ error: 'Invalid or inactive tier selected' });
  }

  const price = tier.price;
  const commissionPercent = store.settings.commissionPercent;
  const platformFee = Number(((price * commissionPercent) / 100).toFixed(2));
  const interviewerEarnings = Number((price - platformFee).toFixed(2));

  const bookingRef = `IA-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const bookingId = 'book_' + Math.random().toString(36).substring(2, 9);

  const newBooking: Booking = {
    id: bookingId,
    bookingRef,
    candidateId: user.id,
    candidateName: user.fullName,
    candidateEmail: user.email,
    tierCode,
    trackName,
    roundName,
    roundNumber,
    roundDurationMins,
    bookingType,
    status: 'AWAITING_PAYMENT',
    scheduledAt,
    preferredLanguage,
    jobRole,
    seniorityLevel,
    price,
    platformFee,
    totalAmount: price,
    interviewerEarnings,
    paymentStatus: 'UNPAID',
    meetingUrl: `/workspace/${bookingId}`,
    meetingProvider: 'IN_HOUSE_MEET',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  store.bookings.set(bookingId, newBooking);

  return res.status(201).json({
    success: true,
    booking: newBooking,
    razorpayKeyId: store.settings.razorpayKeyId,
  });
});

// Cancel booking
bookingsRouter.post('/:id/cancel', (req: any, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  const userId = req.user.id;
  const { id } = req.params;
  const { reason = 'Candidate requested cancellation' } = req.body;

  const booking = store.bookings.get(id);
  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  if (booking.candidateId !== userId && !req.user.roles.includes('ADMIN')) {
    return res.status(403).json({ error: 'Unauthorized to cancel this booking' });
  }

  if (['COMPLETED', 'CANCELLED', 'REFUNDED'].includes(booking.status)) {
    return res.status(400).json({ error: `Cannot cancel booking with status: ${booking.status}` });
  }

  booking.status = 'CANCELLED';
  booking.cancellationReason = reason;
  booking.updatedAt = new Date().toISOString();

  // If in queue, mark queue entry cancelled
  const q = store.queueEntries.get(id);
  if (q) {
    q.status = 'CANCELLED';
  }

  // If paid, create automatic refund request
  if (booking.paymentStatus === 'PAID') {
    const refundRef = 'REF-' + Math.floor(100000 + Math.random() * 900000);
    const refund: Refund = {
      id: 'ref_' + Math.random().toString(36).substring(2, 9),
      refundRef,
      bookingId: booking.id,
      amount: booking.totalAmount,
      reason,
      status: 'APPROVED',
      initiatedBy: userId,
      adminNotes: 'Auto-approved cancellation before interview completion',
      createdAt: new Date().toISOString(),
      processedAt: new Date().toISOString(),
    };
    store.refunds.set(refund.id, refund);
    booking.status = 'REFUNDED';
    booking.paymentStatus = 'REFUNDED';

    // Record in ledger
    store.addLedgerEntry({
      bookingId: booking.id,
      userId: booking.candidateId,
      type: 'REFUND_DEBIT',
      amount: -booking.totalAmount,
      description: `Refund processed for cancelled booking ${booking.bookingRef}`,
      referenceId: refundRef,
    });

    store.addNotification(
      booking.candidateId,
      'Booking Cancelled & Refund Initiated',
      `Your booking ${booking.bookingRef} was cancelled. Full refund of ₹${booking.totalAmount} has been processed to original payment method.`,
      'INFO'
    );
  }

  store.broadcast('BOOKING_UPDATED', booking);
  store.broadcast('QUEUE_UPDATED', Array.from(store.queueEntries.values()));

  return res.json({ success: true, booking });
});

// Start session
bookingsRouter.post('/:id/start', (req, res) => {
  const { id } = req.params;
  const booking = store.bookings.get(id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  if (['CLAIMED', 'SCHEDULED', 'READY'].includes(booking.status)) {
    booking.status = 'IN_PROGRESS';
    booking.updatedAt = new Date().toISOString();
    store.broadcast('BOOKING_UPDATED', booking);
  }

  return res.json({ success: true, booking });
});

// Interviewer Pre-Session Attendance Check-In (Ready within 10 mins)
bookingsRouter.post('/:id/check-in', (req: any, res) => {
  const { id } = req.params;
  const userId = req.user?.id || (req.headers['x-user-id'] as string);
  const booking = store.bookings.get(id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  if (booking.interviewerId !== userId && req.user?.activeRole !== 'ADMIN') {
    return res.status(403).json({ error: 'Only the assigned interviewer can check in.' });
  }

  booking.interviewerAttendedAt = new Date().toISOString();
  booking.updatedAt = new Date().toISOString();

  // Notify Candidate that interviewer has checked in
  store.addNotification(
    booking.candidateId,
    'Interviewer Checked In!',
    `Interviewer ${booking.interviewerName} has checked in for session ${booking.bookingRef} and is in the workspace.`,
    'SUCCESS',
    `/workspace/${booking.id}`
  );

  store.broadcast('BOOKING_UPDATED', booking);
  return res.json({ success: true, message: 'Check-in confirmed! You are ready to start.', booking });
});

// Escalate Interviewer Absence / Missed 10-Minute Check-in
bookingsRouter.post('/:id/report-absent', (req: any, res) => {
  const { id } = req.params;
  const { reason = 'Interviewer absent or did not check in 10 minutes prior to session' } = req.body;
  const result = store.issueAttendanceWarning(id, reason);
  return res.json(result);
});

// Candidate Request Refund
bookingsRouter.post('/:id/request-refund', (req: any, res) => {
  const { id } = req.params;
  const { reason = 'Interviewer did not show up' } = req.body;
  const result = store.processCandidateRefund(id, reason);
  return res.json(result);
});

// Candidate File Complaint / Dispute
bookingsRouter.post('/:id/dispute', (req: any, res) => {
  const { id } = req.params;
  const userId = req.user?.id || (req.headers['x-user-id'] as string);
  const { category = 'OTHER', reason, requestedResolution = 'REFUND' } = req.body;

  if (!reason) {
    return res.status(400).json({ error: 'Complaint details and description are required.' });
  }

  const result = store.fileCandidateDispute(id, userId, category, reason, requestedResolution);
  return res.json(result);
});
