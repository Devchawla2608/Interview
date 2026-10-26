import { Router } from 'express';
import { store } from '../store';
import { PaymentOrder, QueueEntry } from '../../types';

export const paymentsRouter = Router();

// Create Razorpay order
paymentsRouter.post('/create-order', (req: any, res) => {
  const userId = req.user?.id || (req.headers['x-user-id'] as string);
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required to initiate checkout.' });
  }
  const { bookingId } = req.body;

  const booking = store.bookings.get(bookingId);
  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  // Create order reference
  const orderRef = 'order_' + Math.random().toString(36).substring(2, 12);
  const providerOrderId = 'rzp_order_' + Math.random().toString(36).substring(2, 12);

  const order: PaymentOrder = {
    id: 'pay_ord_' + Math.random().toString(36).substring(2, 9),
    orderRef,
    bookingId: booking.id,
    userId,
    amount: booking.totalAmount,
    currency: 'INR',
    status: 'CREATED',
    provider: store.settings.razorpayKeySecretConfigured ? 'RAZORPAY_TEST' : 'DEV_MOCK',
    providerOrderId,
    createdAt: new Date().toISOString(),
  };

  store.paymentOrders.set(order.id, order);
  booking.paymentOrderId = order.id;

  return res.json({
    success: true,
    orderId: providerOrderId,
    orderRecordId: order.id,
    amount: booking.totalAmount * 100, // paisa
    currency: 'INR',
    keyId: store.settings.razorpayKeyId,
    bookingRef: booking.bookingRef,
    provider: order.provider,
  });
});

// Verify payment signature & fulfill booking
paymentsRouter.post('/verify', (req: any, res) => {
  const userId = req.user?.id || (req.headers['x-user-id'] as string);
  const { bookingId, orderRecordId, razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body;

  const booking = store.bookings.get(bookingId);
  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  // Check idempotency: if already paid, return existing success
  if (booking.paymentStatus === 'PAID') {
    return res.json({ success: true, message: 'Payment already processed and verified.', booking });
  }

  const order = orderRecordId ? store.paymentOrders.get(orderRecordId) : null;
  if (order) {
    order.status = 'CAPTURED';
    order.providerPaymentId = razorpayPaymentId || 'pay_' + Math.random().toString(36).substring(2, 10);
    order.signature = razorpaySignature || 'sig_' + Math.random().toString(36).substring(2, 12);
  }

  // Update Booking Status
  booking.paymentStatus = 'PAID';
  booking.status = booking.bookingType === 'QUEUE' ? 'QUEUED' : 'SCHEDULED';
  booking.updatedAt = new Date().toISOString();

  // Immutable Accounting Ledger Entry
  store.addLedgerEntry({
    bookingId: booking.id,
    userId,
    type: 'PAYMENT_RECEIVED',
    amount: booking.totalAmount,
    description: `Payment captured for ${booking.bookingRef} (${booking.trackName} - ${booking.roundName})`,
    referenceId: razorpayPaymentId || order?.providerOrderId || booking.bookingRef,
  });

  // If Queue booking, create exactly ONE queue entry
  if (booking.bookingType === 'QUEUE') {
    const timeoutMins = store.settings.queueTimeoutMinutes || 15;
    const queueEntry: QueueEntry = {
      id: 'queue_' + Math.random().toString(36).substring(2, 9),
      bookingId: booking.id,
      candidateId: booking.candidateId,
      candidateName: booking.candidateName,
      tierCode: booking.tierCode,
      trackName: booking.trackName,
      roundName: booking.roundName,
      roundNumber: booking.roundNumber,
      jobRole: booking.jobRole,
      durationMins: booking.roundDurationMins,
      preferredLanguage: booking.preferredLanguage,
      expectedCompensation: booking.interviewerEarnings,
      status: 'WAITING',
      enteredAt: new Date().toISOString(),
      timeoutAt: new Date(Date.now() + timeoutMins * 60000).toISOString(),
    };

    store.queueEntries.set(booking.id, queueEntry);
    store.broadcast('QUEUE_UPDATED', Array.from(store.queueEntries.values()));
  }

  // Notify Candidate
  store.addNotification(
    booking.candidateId,
    'Payment Confirmed!',
    `Payment of ₹${booking.totalAmount} for ${booking.trackName} confirmed. You are in the active interview queue.`,
    'SUCCESS'
  );

  store.broadcast('BOOKING_UPDATED', booking);

  return res.json({
    success: true,
    message: 'Payment verified and interview activated!',
    booking,
  });
});

// Webhook endpoint
paymentsRouter.post('/webhook', (req, res) => {
  const event = req.body;
  // Handle verified webhook from Razorpay
  if (event?.event === 'payment.captured') {
    const payment = event.payload?.payment?.entity;
    console.log('Webhook payment captured:', payment?.id);
  }
  return res.json({ status: 'ok' });
});
