import { Router } from 'express';
import { store } from '../store';
import { InterviewFeedback, CandidateReview, DisputeReport } from '../../types';

export const feedbackRouter = Router();

// Submit structured feedback rubric
feedbackRouter.post('/submit', (req: any, res) => {
  const userId = req.user?.id || (req.headers['x-user-id'] as string);
  const {
    bookingId,
    criteriaScores,
    strengths,
    improvementAreas,
    recommendedTopics,
    recommendedNextRound,
    practiceReadiness,
  } = req.body;

  const booking = store.bookings.get(bookingId);
  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  if (booking.interviewerId !== userId && (req.headers['x-user-role'] as string) !== 'ADMIN') {
    return res.status(403).json({ error: 'Only the assigned interviewer can submit feedback' });
  }

  // Calculate overall score
  let overallScore = 4.0;
  if (Array.isArray(criteriaScores) && criteriaScores.length > 0) {
    const total = criteriaScores.reduce((acc: number, c: { score: number }) => acc + (Number(c.score) || 3), 0);
    overallScore = Number((total / criteriaScores.length).toFixed(1));
  }

  const feedback: InterviewFeedback = {
    id: 'fb_' + Math.random().toString(36).substring(2, 9),
    bookingId,
    interviewerId: booking.interviewerId || userId,
    interviewerName: booking.interviewerName || 'Interviewer',
    candidateId: booking.candidateId,
    criteriaScores: criteriaScores || [],
    overallScore,
    strengths: strengths || 'Good problem analysis and communication.',
    improvementAreas: improvementAreas || 'Continue practicing complex edge cases.',
    recommendedTopics: recommendedTopics || ['Data Structures'],
    recommendedNextRound: recommendedNextRound || 'Next Round',
    practiceReadiness: practiceReadiness || 'JOB_READY',
    submittedAt: new Date().toISOString(),
  };

  store.feedback.set(bookingId, feedback);

  // Transition booking to COMPLETED
  booking.status = 'COMPLETED';
  booking.updatedAt = new Date().toISOString();

  // Financial accounting: credit platform commission & interviewer balance
  store.addLedgerEntry({
    bookingId: booking.id,
    userId: 'admin',
    type: 'PLATFORM_COMMISSION',
    amount: booking.platformFee,
    description: `Platform ${store.settings.commissionPercent}% commission retained for booking ${booking.bookingRef}`,
    referenceId: 'COMM-' + booking.bookingRef,
  });

  store.addLedgerEntry({
    bookingId: booking.id,
    userId: booking.interviewerId,
    type: 'INTERVIEWER_CREDIT',
    amount: booking.interviewerEarnings,
    description: `Interviewer earnings credited for completed session ${booking.bookingRef}`,
    referenceId: 'INT-' + booking.bookingRef,
  });

  // Update Interviewer Earnings Object
  if (booking.interviewerId) {
    let interviewerEarnings = store.earnings.get(booking.interviewerId);
    if (!interviewerEarnings) {
      interviewerEarnings = {
        interviewerId: booking.interviewerId,
        pendingBalance: 0,
        availableBalance: 0,
        paidBalance: 0,
        totalEarned: 0,
        payoutHistory: [],
      };
      store.earnings.set(booking.interviewerId, interviewerEarnings);
    }
    interviewerEarnings.availableBalance += booking.interviewerEarnings;
    interviewerEarnings.totalEarned += booking.interviewerEarnings;

    const interviewerProfile = store.interviewerProfiles.get(booking.interviewerId);
    if (interviewerProfile) {
      interviewerProfile.totalCompletedSessions += 1;
      interviewerProfile.activeSessionId = null;
      if (!interviewerProfile.isBlockedByAdmin) {
        interviewerProfile.isAvailable = true;
      }
    }
  }

  // Update Candidate Profile total sessions
  const candidateProfile = store.candidateProfiles.get(booking.candidateId);
  if (candidateProfile) {
    candidateProfile.totalSessions += 1;
    candidateProfile.totalSpent += booking.totalAmount;
  }

  // Notification for candidate
  store.addNotification(
    booking.candidateId,
    'Detailed Feedback Available!',
    `Your interviewer ${booking.interviewerName} has submitted detailed rubric feedback & scores for ${booking.trackName}. View your performance report now.`,
    'SUCCESS',
    `/workspace/${booking.id}`
  );

  store.broadcast('BOOKING_UPDATED', booking);
  store.broadcast('FEEDBACK_SUBMITTED', feedback);

  return res.json({ success: true, feedback, booking });
});

// Candidate reviews interviewer
feedbackRouter.post('/review', (req: any, res) => {
  const userId = req.user?.id || (req.headers['x-user-id'] as string);
  const { bookingId, rating, comment } = req.body;

  const booking = store.bookings.get(bookingId);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  if (booking.candidateId !== userId) {
    return res.status(403).json({ error: 'Only the candidate of this session can submit a review' });
  }

  if (store.reviews.has(bookingId)) {
    return res.status(400).json({ error: 'Review has already been submitted for this session.' });
  }

  const review: CandidateReview = {
    id: 'rev_' + Math.random().toString(36).substring(2, 9),
    bookingId,
    candidateId: userId,
    interviewerId: booking.interviewerId || '',
    rating: Number(rating) || 5,
    comment: comment || '',
    createdAt: new Date().toISOString(),
  };

  store.reviews.set(bookingId, review);

  // Update interviewer profile average rating
  if (booking.interviewerId) {
    const prof = store.interviewerProfiles.get(booking.interviewerId);
    if (prof) {
      const allReviewsForInterviewer = Array.from(store.reviews.values()).filter(
        (r) => r.interviewerId === booking.interviewerId
      );
      const sum = allReviewsForInterviewer.reduce((acc, r) => acc + r.rating, 0);
      prof.ratingAvg = Number((sum / allReviewsForInterviewer.length).toFixed(1));
      prof.ratingCount = allReviewsForInterviewer.length;
    }
  }

  store.addNotification(
    booking.interviewerId || '',
    'New Candidate Rating & Review',
    `You received a ${review.rating}-star review for session ${booking.bookingRef}: "${review.comment.slice(0, 40)}..."`,
    'SUCCESS'
  );

  return res.json({ success: true, review });
});

// Report dispute / problem
feedbackRouter.post('/dispute', (req: any, res) => {
  const userId = req.user?.id || (req.headers['x-user-id'] as string);
  const role = (req.headers['x-user-role'] as string) || 'CANDIDATE';
  const { bookingId, reason, description } = req.body;

  const booking = store.bookings.get(bookingId);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  const dispute: DisputeReport = {
    id: 'disp_' + Math.random().toString(36).substring(2, 9),
    bookingId,
    raisedByUserId: userId,
    raisedByRole: role as any,
    reason: reason || 'Technical issue or no-show',
    description: description || '',
    status: 'OPEN',
    createdAt: new Date().toISOString(),
  };

  store.disputes.set(dispute.id, dispute);
  booking.status = 'DISPUTED';

  // Notify Admin
  store.logAudit(userId, 'user', 'DISPUTE_FILED', 'BOOKING', booking.id, `Dispute filed by ${role}: ${reason}`);

  return res.json({ success: true, dispute });
});
