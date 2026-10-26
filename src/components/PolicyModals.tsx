import React from 'react';
import { X, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';

interface PolicyModalsProps {
  policy: 'terms' | 'refund' | 'privacy' | 'faq' | null;
  onClose: () => void;
}

export const PolicyModals: React.FC<PolicyModalsProps> = ({ policy, onClose }) => {
  if (!policy) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl p-6 sm:p-8 space-y-6 shadow-2xl relative max-h-[85vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1 rounded-lg text-slate-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        {policy === 'refund' && (
          <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
            <div className="flex items-center space-x-2 text-emerald-400">
              <ShieldCheck className="w-6 h-6" />
              <h3 className="text-xl font-bold text-white">Cancellation & Refund Policy</h3>
            </div>
            <p className="text-slate-200">
              Interview Arena operates on an explicit 100% fair satisfaction and fulfillment policy:
            </p>
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <strong className="text-white block mb-1">1. Cancellation Prior to Matching:</strong>
                If you cancel a session while waiting in the queue before an interviewer has claimed your request, you are entitled to an immediate 100% full refund with zero deductions.
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <strong className="text-white block mb-1">2. Queue Timeout Expiration:</strong>
                If no qualified interviewer claims your session within the 15-minute matchmaking timeout, our system automatically cancels the request and triggers a full refund back to your original payment method.
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <strong className="text-white block mb-1">3. Interviewer No-Show or Technical Failure:</strong>
                If an assigned interviewer fails to attend within 10 minutes of session start or if verified technical problems prevent conducting the mock interview, file a problem report in your session workspace for priority refund or rebooking.
              </div>
            </div>
          </div>
        )}

        {policy === 'terms' && (
          <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
            <h3 className="text-xl font-bold text-white">Terms of Service & Code of Conduct</h3>
            <p>
              Welcome to Interview Arena. By accessing or using this platform, you agree to comply with our mutual standards:
            </p>
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <p>
                <strong>Educational Simulation:</strong> Sessions are simulated interviews for educational and training purposes. Scores and feedback are constructive evaluations and do not constitute employment offers or guarantees.
              </p>
              <p>
                <strong>Zero Harassment:</strong> We maintain a strictly professional environment. Any verbal abuse, harassment, or inappropriate conduct will lead to immediate account suspension and forfeiture of balances.
              </p>
              <p>
                <strong>Recording Consent:</strong> Participants must never record audio or video streams without prior, explicit mutual consent.
              </p>
            </div>
          </div>
        )}

        {policy === 'privacy' && (
          <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
            <h3 className="text-xl font-bold text-white">Privacy Policy & Security Standards</h3>
            <p>
              We protect your privacy according to industry best practices:
            </p>
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <p>
                <strong>Payment Security:</strong> Payment information is processed directly by PCI-DSS compliant providers (Razorpay). Interview Arena never stores raw credit or debit card credentials on our servers.
              </p>
              <p>
                <strong>Personal Data:</strong> We do not sell user data. Candidate emails and private information are shielded from public queue listings.
              </p>
            </div>
          </div>
        )}

        {policy === 'faq' && (
          <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
            <h3 className="text-xl font-bold text-white">Frequently Asked Questions</h3>
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="font-bold text-white">How does the real-time queue work?</div>
                <div className="text-slate-400 mt-1">
                  After completing checkout, your session enters a FIFO waiting queue visible only to interviewers qualified for your chosen tier. When an interviewer accepts, the match locks atomically and provisions the meeting link.
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="font-bold text-white">What is the difference between Tier A, B, and C?</div>
                <div className="text-slate-400 mt-1">
                  Tier A (₹100) focuses on FAANG hiring bars; Tier B (₹80) focuses on established high-growth tech companies; Tier C (₹60) covers campus placement and foundational coding.
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="font-bold text-white">How much do interviewers earn?</div>
                <div className="text-slate-400 mt-1">
                  Approved interviewers receive 80% of each completed session fee (e.g., ₹80 for a ₹100 Tier A session). Payouts can be withdrawn anytime to UPI or bank accounts.
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition"
          >
            I Understand & Close
          </button>
        </div>
      </div>
    </div>
  );
};
