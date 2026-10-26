import { Router } from 'express';
import { store } from '../store';

export const queueRouter = Router();

// SSE Stream for real-time queue updates
queueRouter.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Send initial state
  const initialData = JSON.stringify({
    type: 'INIT',
    data: {
      queue: Array.from(store.queueEntries.values()).filter((q) => q.status === 'WAITING'),
      activeCount: Array.from(store.queueEntries.values()).filter((q) => q.status === 'WAITING').length,
    },
  });
  res.write(`data: ${initialData}\n\n`);

  // Subscribe to changes
  const unsubscribe = store.subscribe((event) => {
    try {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    } catch {
      // client disconnected
    }
  });

  req.on('close', () => {
    unsubscribe();
  });
});

// List eligible queue entries for interviewer
queueRouter.get('/', (req: any, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  const isAuthorized = req.user.roles.includes('INTERVIEWER') || req.user.roles.includes('ADMIN');
  if (!isAuthorized) {
    return res.status(403).json({ error: 'Forbidden: Interviewer or Admin access required to view queue.' });
  }

  const userId = req.user.id;
  const interviewerProf = store.interviewerProfiles.get(userId);

  // If approved interviewer, filter by preferred tiers and waiting status
  let waiting = Array.from(store.queueEntries.values())
    .filter((q) => q.status === 'WAITING')
    .sort((a, b) => new Date(a.enteredAt).getTime() - new Date(b.enteredAt).getTime()); // FIFO

  // Check queue timeouts
  const now = new Date().getTime();
  for (const q of waiting) {
    if (new Date(q.timeoutAt).getTime() < now) {
      q.status = 'TIMEOUT';
      const b = store.bookings.get(q.bookingId);
      if (b && b.status === 'QUEUED') {
        b.status = 'CANCELLED';
        b.cancellationReason = 'Queue timeout: No interviewer accepted within timeout window.';
        // Auto-refund on timeout
        if (store.settings.autoRefundOnTimeout && b.paymentStatus === 'PAID') {
          b.status = 'REFUNDED';
          b.paymentStatus = 'REFUNDED';
          store.addLedgerEntry({
            bookingId: b.id,
            userId: b.candidateId,
            type: 'REFUND_DEBIT',
            amount: -b.totalAmount,
            description: `Auto-refund for queue timeout on booking ${b.bookingRef}`,
            referenceId: 'REF-TIMEOUT-' + b.bookingRef,
          });
          store.addNotification(
            b.candidateId,
            'Queue Timeout & Full Refund Processed',
            `No interviewer was available within the ${store.settings.queueTimeoutMinutes} min window. ₹${b.totalAmount} was refunded in full.`,
            'WARNING'
          );
        }
      }
    }
  }

  // Refresh waiting list
  waiting = Array.from(store.queueEntries.values())
    .filter((q) => q.status === 'WAITING')
    .sort((a, b) => new Date(a.enteredAt).getTime() - new Date(b.enteredAt).getTime());

  if (interviewerProf && interviewerProf.preferredTiers) {
    waiting = waiting.filter((q) => interviewerProf.preferredTiers.includes(q.tierCode));
  }

  return res.json({
    queue: waiting,
    totalWaiting: waiting.length,
    isInterviewerApproved: interviewerProf?.status === 'APPROVED',
  });
});

// Candidate's active queue position
queueRouter.get('/my', (req: any, res) => {
  if (!req.user) {
    return res.json({ inQueue: false });
  }

  const userId = req.user.id;

  const myEntry = Array.from(store.queueEntries.values()).find(
    (q) => q.candidateId === userId && q.status === 'WAITING'
  );

  if (!myEntry) {
    return res.json({ inQueue: false });
  }

  // Calculate position in FIFO queue
  const allWaiting = Array.from(store.queueEntries.values())
    .filter((q) => q.status === 'WAITING')
    .sort((a, b) => new Date(a.enteredAt).getTime() - new Date(b.enteredAt).getTime());

  const position = allWaiting.findIndex((q) => q.id === myEntry.id) + 1;
  const estimatedWaitMins = Math.max(1, position * 3);

  const booking = store.bookings.get(myEntry.bookingId);

  return res.json({
    inQueue: true,
    entry: myEntry,
    booking,
    position,
    totalInQueue: allWaiting.length,
    estimatedWaitMins,
  });
});

// Atomic Interviewer Acceptance
queueRouter.post('/:bookingId/claim', async (req: any, res) => {
  const userId = req.user?.id || (req.headers['x-user-id'] as string);
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required to claim interview session.' });
  }

  const { bookingId } = req.params;
  const result = await store.claimQueueEntryAtomic(bookingId, userId);

  if (!result.success) {
    return res.status(409).json({ success: false, error: result.message });
  }

  return res.json({ success: true, message: result.message, booking: result.booking });
});
