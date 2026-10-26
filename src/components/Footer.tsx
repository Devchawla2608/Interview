import React from 'react';
import { ShieldCheck, HelpCircle, FileText, Lock, Sparkles } from 'lucide-react';

interface FooterProps {
  onOpenPolicy: (policy: 'terms' | 'refund' | 'privacy' | 'faq') => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenPolicy }) => {
  return (
    <footer className="border-t border-slate-800 bg-slate-950 text-slate-400 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-3 md:col-span-2">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white text-xs">
                IA
              </div>
              <span className="font-extrabold text-white text-lg tracking-tight">Interview Arena</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed max-w-md">
              Democratizing technical interview preparation through peer and professional mock interviews. Transparent pricing across Tier A (₹100), Tier B (₹80), and Tier C (₹60) with instant matching queues and structured rubric feedback.
            </p>
            <div className="text-[11px] text-slate-500 leading-relaxed">
              <strong>Simulated Practice Notice:</strong> All mock interviews are practice sessions conducted by independent student and professional interviewers. Featured company names denote target track curriculums and do not represent formal affiliations, endorsements, or hiring guarantees.
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <h4 className="font-bold text-white uppercase tracking-wider text-[11px]">Policies & Trust</h4>
            <ul className="space-y-1.5">
              <li>
                <button
                  onClick={() => onOpenPolicy('refund')}
                  className="hover:text-indigo-400 transition"
                >
                  Refund & Cancellation Policy (100% Guarantee)
                </button>
              </li>
              <li>
                <button
                  onClick={() => onOpenPolicy('terms')}
                  className="hover:text-indigo-400 transition"
                >
                  Terms of Service & Code of Conduct
                </button>
              </li>
              <li>
                <button
                  onClick={() => onOpenPolicy('privacy')}
                  className="hover:text-indigo-400 transition"
                >
                  Privacy Policy & Data Security
                </button>
              </li>
            </ul>
          </div>

          <div className="space-y-2 text-xs">
            <h4 className="font-bold text-white uppercase tracking-wider text-[11px]">Support & Community</h4>
            <ul className="space-y-1.5">
              <li>
                <button
                  onClick={() => onOpenPolicy('faq')}
                  className="hover:text-indigo-400 transition"
                >
                  Frequently Asked Questions (FAQ)
                </button>
              </li>
              <li className="text-slate-500">Contact: support@interviewarena.com</li>
              <li className="text-slate-500">Operating Hours: 24/7 Matchmaking</li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-4">
          <div>© {new Date().getFullYear()} Interview Arena. All rights reserved.</div>
          <div className="flex items-center space-x-4">
            <span className="flex items-center space-x-1">
              <Lock className="w-3.5 h-3.5 text-emerald-500" />
              <span>TLS 256-bit Encrypted</span>
            </span>
            <span>•</span>
            <span>PostgreSQL & Razorpay Verified Flow</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
