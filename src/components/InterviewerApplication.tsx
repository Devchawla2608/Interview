import React, { useState, useEffect } from 'react';
import { User, InterviewerApplication as IApplication } from '../types';
import { api } from '../services/api';
import {
  Briefcase,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Award,
  DollarSign,
  AlertCircle,
  Sparkles,
  FileText,
  UserCheck,
} from 'lucide-react';

interface InterviewerApplicationProps {
  currentUser: User | null;
  onNavigateToInterviewerPortal: () => void;
}

export const InterviewerApplication: React.FC<InterviewerApplicationProps> = ({
  currentUser,
  onNavigateToInterviewerPortal,
}) => {
  const [application, setApplication] = useState<IApplication | null>(null);
  const [headline, setHeadline] = useState('');
  const [currentCompany, setCurrentCompany] = useState('');
  const [currentRole, setCurrentRole] = useState('');
  const [experienceYears, setExperienceYears] = useState('3');
  const [skills, setSkills] = useState('Data Structures, Algorithms, System Design, Java, Python');
  const [collegeOrEmployer, setCollegeOrEmployer] = useState('');
  const [bio, setBio] = useState('');
  const [upiId, setUpiId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  useEffect(() => {
    loadApp();
  }, [currentUser?.id]);

  const loadApp = async () => {
    try {
      const res = await api.getInterviewerProfile();
      if (res.application) {
        setApplication(res.application);
      }
    } catch (err) {
      console.error('Error loading application:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await api.applyInterviewer({
        headline,
        bio,
        experienceYears: Number(experienceYears),
        collegeOrEmployer,
        currentCompany,
        currentRole,
        skills: skills.split(',').map((s) => s.trim()),
        preferredTiers: ['TIER_A', 'TIER_B', 'TIER_C'],
        languages: ['English'],
        upiId,
      });

      setApplication(res.application);
      setSubmittedSuccess(true);
    } catch (err: any) {
      console.error('Failed to submit application:', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      {/* Header */}
      <div className="rounded-3xl bg-gradient-to-r from-amber-950/40 via-slate-900 to-indigo-950/40 border border-amber-500/20 p-6 sm:p-8 space-y-4">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold">
          <Award className="w-3.5 h-3.5" />
          <span>Earn 80% Revenue Share Per Interview</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Become an Interviewer on Interview Arena
        </h1>
        <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
          Mentor upcoming engineers, freshers, and experienced job seekers. Conduct live mock interviews, provide structured rubric feedback, and receive transparent payouts.
        </p>

        {/* 3 Pillars */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-800">
          <div className="flex items-start space-x-3">
            <DollarSign className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold text-white">80% Payout Share</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Earn ₹80 on Tier A (₹100 session), ₹64 on Tier B, and ₹48 on Tier C.
              </div>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold text-white">Flexible Real-Time Queue</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Go online whenever you have 45–60 mins free. Accept requests with 1 click.
              </div>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold text-white">3-Stage Screening Process</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Every applicant completes 3 mock screenings evaluated against standard rubrics (Coding, System Architecture, and Bar-Raiser calibration).
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* If Application Exists: Show Status Tracker */}
      {application ? (
        <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 sm:p-8 space-y-6 shadow-xl">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 uppercase tracking-wider">
                Application #{application.id}
              </span>
              <h2 className="text-xl font-bold text-white mt-1">Screening & Verification Pipeline</h2>
              <p className="text-xs text-slate-400">
                Submitted on {new Date(application.submittedAt).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>

            <span
              className={`text-xs font-bold px-3 py-1.5 rounded-full border ${
                application.status === 'APPROVED'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : application.status === 'REJECTED'
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                  : application.status === 'UNDER_REVIEW'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30 animate-pulse'
                  : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
              }`}
            >
              {application.status.replace('_', ' ')}
            </span>
          </div>

          {/* Stepper */}
          <div className="space-y-6">
            {/* Step 1: Application Review */}
            <div className="flex items-start space-x-4">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 font-bold text-xs">
                ✓
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white">1. Initial Profile Review</h4>
                <p className="text-xs text-slate-400">
                  Profile details, company background, and skill alignment verified.
                </p>
              </div>
            </div>

            {/* Step 2: Screening Interview 1 */}
            <div className="flex items-start space-x-4">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-xs ${
                  application.screening1?.status === 'COMPLETED'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-amber-500/20 text-amber-400 animate-pulse'
                }`}
              >
                {application.screening1?.status === 'COMPLETED' ? '✓' : '2'}
              </div>
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white">2. Technical & Coding Screening (Round 1)</h4>
                  <span className="text-[11px] font-semibold text-indigo-400">
                    Status: {application.screening1?.status || 'PENDING'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Evaluates live code walkthrough, algorithmic optimization, and test case guidance.
                </p>
                {application.screening1?.notes && (
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300">
                    <strong>Reviewer Notes:</strong> {application.screening1.notes}
                    {application.screening1.score && (
                      <span className="ml-2 font-bold text-emerald-400">
                        (Score: {application.screening1.score}/10)
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Step 3: Screening Interview 2 */}
            <div className="flex items-start space-x-4">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-xs ${
                  application.screening2?.status === 'COMPLETED'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {application.screening2?.status === 'COMPLETED' ? '✓' : '3'}
              </div>
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white">3. System Architecture & Domain Design (Round 2)</h4>
                  <span className="text-[11px] font-semibold text-slate-400">
                    Status: {application.screening2?.status || 'PENDING'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Evaluates high-scale distributed systems, database scaling, API contracts, and domain architecture.
                </p>
                {application.screening2?.notes && (
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300">
                    <strong>Reviewer Notes:</strong> {application.screening2.notes}
                    {application.screening2.score && (
                      <span className="ml-2 font-bold text-emerald-400">
                        (Score: {application.screening2.score}/10)
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Step 4: Screening Interview 3 */}
            <div className="flex items-start space-x-4">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-xs ${
                  application.screening3?.status === 'COMPLETED'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {application.screening3?.status === 'COMPLETED' ? '✓' : '4'}
              </div>
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white">4. Bar-Raiser & Rubric Calibration (Round 3)</h4>
                  <span className="text-[11px] font-semibold text-slate-400">
                    Status: {application.screening3?.status || 'PENDING'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Ensures performance feedback is structured, actionable, and aligned strictly with our standard evaluation rubrics.
                </p>
                {application.screening3?.notes && (
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300">
                    <strong>Reviewer Notes:</strong> {application.screening3.notes}
                    {application.screening3.score && (
                      <span className="ml-2 font-bold text-emerald-400">
                        (Score: {application.screening3.score}/10)
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Step 5: Admin Decision */}
            <div className="flex items-start space-x-4">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-xs ${
                  application.status === 'APPROVED'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {application.status === 'APPROVED' ? '✓' : '5'}
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white">5. Final Administrative Approval</h4>
                <p className="text-xs text-slate-400">
                  {application.adminNotes ||
                    'All 3 screening interviews must be cleared before full session-acceptance approval is granted.'}
                </p>
              </div>
            </div>
          </div>

          {application.status === 'APPROVED' && (
            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button
                onClick={onNavigateToInterviewerPortal}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition"
              >
                Go to Interviewer Dashboard & Accept Sessions
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Application Submission Form */
        <form onSubmit={handleSubmit} className="rounded-3xl bg-slate-900 border border-slate-800 p-6 sm:p-8 space-y-6 shadow-xl">
          <h2 className="text-xl font-bold text-white pb-3 border-b border-slate-800">
            Submit Interviewer Application
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Professional Headline:</label>
              <input
                type="text"
                placeholder="e.g. Senior Software Engineer @ Tier-1 Tech"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Current Company:</label>
              <input
                type="text"
                placeholder="e.g. Google, Amazon, Microsoft, Startup..."
                value={currentCompany}
                onChange={(e) => setCurrentCompany(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Years of Software Experience:</label>
              <input
                type="number"
                min="1"
                max="30"
                value={experienceYears}
                onChange={(e) => setExperienceYears(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">College / University:</label>
              <input
                type="text"
                placeholder="e.g. IIT, BITS Pilani, IIIT, NIT..."
                value={collegeOrEmployer}
                onChange={(e) => setCollegeOrEmployer(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Key Technical Skills & Topics (comma separated):</label>
            <input
              type="text"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Bio & Mock Interview Philosophy:</label>
            <textarea
              rows={3}
              placeholder="Tell candidates about your background and how you guide students through technical problem solving..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">UPI ID for Payouts (80% share):</label>
            <input
              type="text"
              placeholder="e.g. name@okhdfcbank"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Terms & Code of conduct */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 space-y-1.5">
            <div className="font-semibold text-white">Code of Conduct & Professional Expectations:</div>
            <p>1. Must be on time for all claimed sessions with functioning camera/mic.</p>
            <p>2. Must complete structured rubric feedback within 2 hours of session completion.</p>
            <p>3. Do not record audio/video without explicit candidate consent.</p>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-indigo-600 hover:opacity-90 disabled:opacity-50 text-slate-950 font-bold text-xs shadow-lg transition"
          >
            {isSubmitting ? 'Submitting Application...' : 'Submit Interviewer Application'}
          </button>
        </form>
      )}
    </div>
  );
};
