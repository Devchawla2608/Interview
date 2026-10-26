import React, { useState } from 'react';
import { api } from '../services/api';
import confetti from 'canvas-confetti';
import { X, Star, CheckCircle2, Sparkles, Award } from 'lucide-react';

interface FeedbackModalProps {
  bookingId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  bookingId,
  onClose,
  onSuccess,
}) => {
  const [criteriaScores, setCriteriaScores] = useState([
    { criterion: 'Problem Understanding & Clarifying Questions', score: 4, comments: 'Good comprehension of constraints.' },
    { criterion: 'Approach & Optimal Time/Space Complexity', score: 4, comments: 'Identified optimal data structures after discussing trade-offs.' },
    { criterion: 'Code Cleanliness & Syntax Fluency', score: 4, comments: 'Modular code with readable variable naming.' },
    { criterion: 'Edge Cases Handling & Dry-Run Testing', score: 3, comments: 'Test with boundary inputs before declaring completion.' },
    { criterion: 'Communication & Collaboration', score: 5, comments: 'Spoke through ideas clearly and accepted subtle hints.' },
  ]);

  const [strengths, setStrengths] = useState('Strong algorithmic intuition and vocal thinking throughout.');
  const [improvementAreas, setImprovementAreas] = useState('Be more proactive in defining edge-case test tables before writing implementation code.');
  const [recommendedTopics, setRecommendedTopics] = useState('Sliding Window, Binary Search, Graph Traversals');
  const [recommendedNextRound, setRecommendedNextRound] = useState('Round 2: Technical Coding Interview');
  const [practiceReadiness, setPracticeReadiness] = useState<'NEEDS_PRACTICE' | 'DEVELOPING' | 'JOB_READY' | 'EXCELLENT'>('JOB_READY');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleScoreChange = (index: number, score: number) => {
    setCriteriaScores((prev) =>
      prev.map((c, i) => (i === index ? { ...c, score } : c))
    );
  };

  const handleCommentChange = (index: number, comments: string) => {
    setCriteriaScores((prev) =>
      prev.map((c, i) => (i === index ? { ...c, comments } : c))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await api.submitFeedback({
        bookingId,
        criteriaScores,
        strengths,
        improvementAreas,
        recommendedTopics: recommendedTopics.split(',').map((t) => t.trim()),
        recommendedNextRound,
        practiceReadiness,
      });

      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.6 },
      });

      onSuccess();
    } catch (err: any) {
      console.error('Failed to submit feedback:', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden relative max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <span className="w-8 h-8 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-base font-bold text-white">Submit Structured Rubric Feedback</h3>
              <p className="text-[11px] text-slate-400">
                Evaluation completes session and releases interviewer earnings to your balance.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Rubric Criteria */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Evaluation Rubric (1 to 5 Stars)
            </h4>

            <div className="space-y-3">
              {criteriaScores.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-white">{item.criterion}</span>
                    <div className="flex items-center space-x-1 shrink-0">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => handleScoreChange(idx, star)}
                          className="p-1 text-slate-600 hover:text-amber-400 focus:outline-none transition"
                        >
                          <Star
                            className={`w-4 h-4 ${
                              star <= item.score
                                ? 'text-amber-400 fill-amber-400'
                                : 'text-slate-700'
                            }`}
                          />
                        </button>
                      ))}
                      <span className="text-xs font-bold text-amber-400 ml-1">{item.score}/5</span>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={item.comments}
                    onChange={(e) => handleCommentChange(idx, e.target.value)}
                    placeholder="Specific observations..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-[11px] text-slate-300 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Qualitative Feedback */}
          <div className="space-y-4 pt-2 border-t border-slate-800">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Key Strengths:</label>
              <textarea
                rows={2}
                value={strengths}
                onChange={(e) => setStrengths(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Areas for Improvement:
              </label>
              <textarea
                rows={2}
                value={improvementAreas}
                onChange={(e) => setImprovementAreas(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Recommended Topics to Study:
                </label>
                <input
                  type="text"
                  value={recommendedTopics}
                  onChange={(e) => setRecommendedTopics(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Recommended Next Round:
                </label>
                <input
                  type="text"
                  value={recommendedNextRound}
                  onChange={(e) => setRecommendedNextRound(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Practice Readiness Verdict:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { value: 'NEEDS_PRACTICE', label: 'Needs Practice' },
                  { value: 'DEVELOPING', label: 'Developing' },
                  { value: 'JOB_READY', label: 'Job Ready' },
                  { value: 'EXCELLENT', label: 'Excellent Bar' },
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setPracticeReadiness(item.value as any)}
                    className={`py-2 px-2 rounded-xl text-xs font-semibold text-center transition ${
                      practiceReadiness === item.value
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-indigo-600/30 transition"
            >
              {isSubmitting ? 'Submitting & Crediting...' : 'Submit Feedback & Complete'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
