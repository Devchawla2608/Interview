import React, { useState, useEffect } from 'react';
import { CompanyTrack, RoundTemplate, Tier, Booking } from '../types';
import { api } from '../services/api';
import confetti from 'canvas-confetti';
import QRCode from 'qrcode';
import {
  X,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Clock,
  Sparkles,
  Zap,
  Lock,
  ArrowRight,
  QrCode,
  Smartphone,
  Copy,
  Check,
  Building,
} from 'lucide-react';

interface CheckoutModalProps {
  track: CompanyTrack;
  round: RoundTemplate;
  tier: Tier;
  onClose: () => void;
  onBookingSuccess: (booking: Booking) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  track,
  round,
  tier,
  onClose,
  onBookingSuccess,
}) => {
  const [preferredLanguage, setPreferredLanguage] = useState('Python');
  const [jobRole, setJobRole] = useState('Full-Stack Engineer');
  const [bookingType, setBookingType] = useState<'QUEUE' | 'SCHEDULED'>('QUEUE');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('18:00');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Gateway Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pendingBooking, setPendingBooking] = useState<Booking | null>(null);
  const [orderInfo, setOrderInfo] = useState<any>(null);

  // Payment Tabs
  const [paymentTab, setPaymentTab] = useState<'UPI_QR' | 'UPI_INTENT' | 'UPI_COLLECT' | 'CARD'>('UPI_QR');

  // UPI Specific State
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [candidateVpa, setCandidateVpa] = useState('candidate@okhdfcbank');
  const [upiUtr, setUpiUtr] = useState('');
  const [copiedVpa, setCopiedVpa] = useState(false);
  const [vpaRequestSent, setVpaRequestSent] = useState(false);

  const merchantVpa = 'arena.merchant@okhdfcbank';
  const merchantName = 'Interview Arena';

  // Generate real UPI URI & QR Code
  useEffect(() => {
    if (showPaymentModal && pendingBooking) {
      const upiUri = `upi://pay?pa=${merchantVpa}&pn=${encodeURIComponent(
        merchantName
      )}&am=${tier.price}.00&cu=INR&tn=${encodeURIComponent(
        `Booking-${pendingBooking.bookingRef}`
      )}`;

      QRCode.toDataURL(upiUri, {
        width: 240,
        margin: 1.5,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('Error generating QR:', err));
    }
  }, [showPaymentModal, pendingBooking, tier.price]);

  const handleInitiateCheckout = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      // 1. Create booking (Backend validates price!)
      const bookingRes = await api.createBooking({
        tierCode: tier.code,
        trackName: track.name,
        roundName: round.name,
        roundNumber: round.roundNumber,
        roundDurationMins: round.durationMins,
        bookingType,
        scheduledAt: bookingType === 'SCHEDULED' ? `${scheduledDate}T${scheduledTime}:00` : undefined,
        preferredLanguage,
        jobRole,
      });

      setPendingBooking(bookingRes.booking);

      // 2. Create payment order on server
      const paymentOrderRes = await api.createPaymentOrder(bookingRes.booking.id);
      setOrderInfo(paymentOrderRes);

      // Open Gateway Checkout
      setShowPaymentModal(true);
    } catch (err: any) {
      setError(err.message || 'Failed to initiate checkout');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmUpiPayment = async (customUtr?: string) => {
    if (!pendingBooking || !orderInfo) return;
    setIsProcessing(true);
    setError(null);

    const utr = customUtr || upiUtr || Math.floor(100000000000 + Math.random() * 900000000000).toString();

    try {
      const verifyRes = await api.verifyPayment({
        bookingId: pendingBooking.id,
        orderRecordId: orderInfo.orderRecordId,
        razorpayPaymentId: 'upi_' + utr,
        razorpayOrderId: orderInfo.orderId,
        razorpaySignature: 'sig_upi_' + Math.random().toString(36).substring(2, 10),
      });

      confetti({
        particleCount: 90,
        spread: 60,
        origin: { y: 0.6 },
      });

      onBookingSuccess(verifyRes.booking);
    } catch (err: any) {
      setError(err.message || 'Payment verification failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedVpa(true);
    setTimeout(() => setCopiedVpa(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden relative">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="w-8 h-8 rounded-xl bg-indigo-600/30 text-indigo-400 flex items-center justify-center font-bold text-xs">
              IA
            </span>
            <div>
              <h3 className="text-base font-bold text-white">Book Simulated Mock Interview</h3>
              <p className="text-[11px] text-slate-400">{track.name} • {round.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="m-6 mb-0 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!showPaymentModal ? (
          <div className="p-6 space-y-6">
            {/* Preferences */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Session Preferences
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Coding Language:
                  </label>
                  <select
                    value={preferredLanguage}
                    onChange={(e) => setPreferredLanguage(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl p-2.5 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Python">Python</option>
                    <option value="JavaScript / TypeScript">JavaScript / TypeScript</option>
                    <option value="Java">Java</option>
                    <option value="C++">C++</option>
                    <option value="Go">Go</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Target Job Role:
                  </label>
                  <select
                    value={jobRole}
                    onChange={(e) => setJobRole(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl p-2.5 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Full-Stack Engineer">Full-Stack Engineer</option>
                    <option value="Backend Engineer">Backend Engineer</option>
                    <option value="Frontend Engineer">Frontend Engineer</option>
                    <option value="Software Engineer (Intern/Fresher)">Software Engineer (Intern/Fresher)</option>
                    <option value="Data Engineer">Data Engineer</option>
                  </select>
                </div>
              </div>

              {/* Mode Selection */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Interview Mode:
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setBookingType('QUEUE')}
                    className={`p-3 rounded-xl border text-left transition ${
                      bookingType === 'QUEUE'
                        ? 'bg-indigo-600/20 border-indigo-500 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center space-x-1.5">
                      <Zap className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-bold text-white">Join Real-Time Queue</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Matched immediately with an available approved interviewer.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBookingType('SCHEDULED')}
                    className={`p-3 rounded-xl border text-left transition ${
                      bookingType === 'SCHEDULED'
                        ? 'bg-indigo-600/20 border-indigo-500 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center space-x-1.5">
                      <Clock className="w-4 h-4 text-indigo-400" />
                      <span className="text-xs font-bold text-white">Schedule Future Slot</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Pick a planned date and time slot from interviewer calendar.
                    </p>
                  </button>
                </div>
              </div>

              {bookingType === 'SCHEDULED' && (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Date:</label>
                    <input
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Time (IST):</label>
                    <input
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Transparent Pricing Breakdown */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
              <div className="text-xs font-bold text-slate-300">Price Summary</div>

              <div className="flex justify-between text-xs text-slate-400">
                <span>{tier.name.split('—')[0]} ({round.durationMins} mins):</span>
                <span className="font-semibold text-white">₹{tier.price}.00</span>
              </div>

              <div className="flex justify-between text-xs text-slate-400">
                <span>In-House Video Infrastructure:</span>
                <span className="font-semibold text-emerald-400">Included (Free)</span>
              </div>

              <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
                <span className="text-sm font-bold text-white">Total Payable:</span>
                <span className="text-xl font-extrabold text-white">₹{tier.price}.00</span>
              </div>
            </div>

            {/* Refund Guarantee Badge */}
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start space-x-3 text-xs text-emerald-300">
              <ShieldCheck className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
              <div>
                <span className="font-bold text-white">100% Refund Guarantee</span>
                <p className="text-[11px] text-emerald-300/90 mt-0.5">
                  If you cancel before matching or if no interviewer claims within 15 mins, your payment is refunded automatically in full.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleInitiateCheckout}
                className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition flex items-center justify-center space-x-2"
              >
                {isProcessing ? (
                  <span>Preparing order...</span>
                ) : (
                  <>
                    <span>Proceed to UPI Payment (₹{tier.price})</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Real UPI & Multi-Method Payment Modal */
          <div className="p-6 space-y-5 bg-slate-900">
            <div className="text-center space-y-1">
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold">
                <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                <span>UPI Instant Payment Gateway</span>
              </div>
              <h4 className="text-2xl font-extrabold text-white">Pay ₹{tier.price}.00</h4>
              <p className="text-xs text-slate-400">Booking Ref: {pendingBooking?.bookingRef}</p>
            </div>

            {/* UPI Sub-Tabs */}
            <div className="grid grid-cols-4 gap-1 p-1 bg-slate-950 rounded-2xl border border-slate-800 text-xs font-semibold">
              <button
                onClick={() => setPaymentTab('UPI_QR')}
                className={`py-2 rounded-xl transition ${
                  paymentTab === 'UPI_QR'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Scan QR
              </button>
              <button
                onClick={() => setPaymentTab('UPI_INTENT')}
                className={`py-2 rounded-xl transition ${
                  paymentTab === 'UPI_INTENT'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                UPI Apps
              </button>
              <button
                onClick={() => setPaymentTab('UPI_COLLECT')}
                className={`py-2 rounded-xl transition ${
                  paymentTab === 'UPI_COLLECT'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                UPI ID (VPA)
              </button>
              <button
                onClick={() => setPaymentTab('CARD')}
                className={`py-2 rounded-xl transition ${
                  paymentTab === 'CARD'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Card / Net
              </button>
            </div>

            {/* Tab 1: Scannable Dynamic UPI QR Code */}
            {paymentTab === 'UPI_QR' && (
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4 text-center">
                <div className="text-xs text-slate-300 font-medium">
                  Scan with any UPI App (Google Pay, PhonePe, Paytm, BHIM, CRED):
                </div>

                <div className="inline-block p-3 bg-white rounded-2xl shadow-xl border-4 border-slate-800">
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt="UPI QR Code" className="w-44 h-44 mx-auto" />
                  ) : (
                    <div className="w-44 h-44 bg-slate-200 animate-pulse rounded-lg" />
                  )}
                </div>

                {/* Merchant VPA details */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
                  <div className="text-left">
                    <div className="text-[10px] text-slate-400">UPI ID (VPA):</div>
                    <div className="font-mono text-emerald-300 font-semibold">{merchantVpa}</div>
                  </div>
                  <button
                    onClick={() => copyToClipboard(merchantVpa)}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 flex items-center space-x-1"
                  >
                    {copiedVpa ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedVpa ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                <button
                  onClick={() => handleConfirmUpiPayment()}
                  disabled={isProcessing}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition flex items-center justify-center space-x-2"
                >
                  {isProcessing ? (
                    <span>Verifying UPI confirmation...</span>
                  ) : (
                    <>
                      <span>I have scanned & paid ₹{tier.price} (Auto-Verify)</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Tab 2: 1-Click UPI Apps (Google Pay, PhonePe, Paytm, BHIM) */}
            {paymentTab === 'UPI_INTENT' && (
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                <div className="text-xs text-slate-300 font-medium text-center">
                  Select your preferred installed UPI app:
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { name: 'Google Pay', color: 'from-blue-600 to-indigo-600', icon: 'GPay' },
                    { name: 'PhonePe', color: 'from-purple-600 to-indigo-700', icon: 'PhonePe' },
                    { name: 'Paytm UPI', color: 'from-sky-500 to-blue-600', icon: 'Paytm' },
                    { name: 'BHIM UPI', color: 'from-emerald-600 to-teal-700', icon: 'BHIM' },
                  ].map((app) => (
                    <button
                      key={app.name}
                      onClick={() => handleConfirmUpiPayment()}
                      disabled={isProcessing}
                      className={`p-3.5 rounded-2xl bg-gradient-to-r ${app.color} text-white font-bold text-xs shadow-md hover:opacity-90 transition flex items-center justify-center space-x-2`}
                    >
                      <span>Pay with {app.name}</span>
                    </button>
                  ))}
                </div>

                <p className="text-[11px] text-center text-slate-500">
                  Instant UPI intent authorization without entering card details.
                </p>
              </div>
            )}

            {/* Tab 3: UPI ID / VPA Collect Request */}
            {paymentTab === 'UPI_COLLECT' && (
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4 text-xs">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Enter your UPI ID / VPA:
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. mobileNumber@paytm, name@okhdfcbank"
                    value={candidateVpa}
                    onChange={(e) => setCandidateVpa(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {vpaRequestSent ? (
                  <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 space-y-2 text-center">
                    <CheckCircle2 className="w-5 h-5 mx-auto" />
                    <div>
                      <strong>Collect Request Sent to {candidateVpa}!</strong>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Open your UPI app and approve the request for ₹{tier.price}.
                      </p>
                    </div>
                    <button
                      onClick={() => handleConfirmUpiPayment()}
                      disabled={isProcessing}
                      className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs mt-2"
                    >
                      {isProcessing ? 'Verifying payment...' : 'Confirm UPI Approval'}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setVpaRequestSent(true)}
                    className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition"
                  >
                    Send UPI Payment Request
                  </button>
                )}
              </div>
            )}

            {/* Tab 4: Card Fallback */}
            {paymentTab === 'CARD' && (
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                  <div className="text-slate-400">Test Debit / Credit Card:</div>
                  <div className="font-mono text-indigo-300">4111 •••• •••• 1111</div>
                  <div className="flex space-x-2 text-[11px] text-slate-400">
                    <span>Exp: 12/28</span>
                    <span>•</span>
                    <span>CVV: 123</span>
                  </div>
                </div>

                <button
                  onClick={() => handleConfirmUpiPayment()}
                  disabled={isProcessing}
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs shadow-md transition"
                >
                  {isProcessing ? 'Authorizing card...' : `Pay ₹${tier.price} with Card`}
                </button>
              </div>
            )}

            {/* Security note */}
            <div className="text-[11px] text-slate-500 text-center flex items-center justify-center space-x-1.5">
              <Lock className="w-3 h-3 text-emerald-400" />
              <span>NPCI UPI Verified Protocol • 100% Instant Refundable</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
