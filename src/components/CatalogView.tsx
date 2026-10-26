import React, { useState, useEffect } from 'react';
import { Tier, CompanyTrack, RoundTemplate, TierCode } from '../types';
import { api } from '../services/api';
import {
  Layers,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Info,
  ChevronRight,
  HelpCircle,
} from 'lucide-react';

interface CatalogViewProps {
  initialTier?: string;
  onSelectRoundForBooking: (track: CompanyTrack, round: RoundTemplate, tier: Tier, role?: string, level?: string) => void;
}

export const CatalogView: React.FC<CatalogViewProps> = ({
  initialTier,
  onSelectRoundForBooking,
}) => {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [tracks, setTracks] = useState<CompanyTrack[]>([]);
  const [rounds, setRounds] = useState<RoundTemplate[]>([]);
  const [selectedTier, setSelectedTier] = useState<string>(initialTier || 'ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('ALL');
  const [selectedRole, setSelectedRole] = useState<string>('ALL');
  const [selectedLevel, setSelectedLevel] = useState<string>('ALL');
  const [selectedTrack, setSelectedTrack] = useState<CompanyTrack | null>(null);
  const [loading, setLoading] = useState(true);

  // Recommendation Modal State
  const [showRecModal, setShowRecModal] = useState(false);
  const [recCompany, setRecCompany] = useState('');
  const [recType, setRecType] = useState('PRODUCT_SCALEUP');
  const [recRole, setRecRole] = useState('Software Engineer');
  const [recSalary, setRecSalary] = useState('18_35');
  const [recommendationResult, setRecommendationResult] = useState<{
    tierCode: TierCode;
    tierName: string;
    rationale: string;
    suggestedTrackId: string;
  } | null>(null);

  useEffect(() => {
    loadCatalog();
  }, []);

  useEffect(() => {
    if (initialTier) setSelectedTier(initialTier);
  }, [initialTier]);

  const loadCatalog = async () => {
    try {
      const res = await api.getCatalog();
      setTiers(res.tiers || []);
      setTracks(res.tracks || []);
      setRounds(res.rounds || []);
      if (res.tracks.length > 0) {
        setSelectedTrack(res.tracks[0]);
      }
    } catch (err) {
      console.error('Failed to load catalog:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRunRecommendation = () => {
    const comp = recCompany.trim() || searchQuery.trim() || 'Target Company';
    let tierCode: TierCode = 'TIER_B';
    let tierName = 'Product & High-Growth Tier';
    let rationale = '';
    let suggestedTrackId = 'track_swiggy_zomato';

    const isHighTier =
      recType === 'FAANG_HFT' ||
      recSalary === '35_PLUS' ||
      comp.toLowerCase().includes('google') ||
      comp.toLowerCase().includes('meta') ||
      comp.toLowerCase().includes('apple') ||
      comp.toLowerCase().includes('netflix') ||
      comp.toLowerCase().includes('amazon') ||
      comp.toLowerCase().includes('uber') ||
      comp.toLowerCase().includes('stripe');

    const isFoundationTier =
      recType === 'IT_SERVICES' ||
      recSalary === 'UNDER_8' ||
      comp.toLowerCase().includes('tcs') ||
      comp.toLowerCase().includes('infosys') ||
      comp.toLowerCase().includes('wipro') ||
      comp.toLowerCase().includes('accenture') ||
      comp.toLowerCase().includes('cognizant');

    if (isHighTier) {
      tierCode = 'TIER_A';
      tierName = 'FAANG & Elite Unicorn Tier (Top Bar)';
      rationale = `${comp} interviews rigorously evaluate complex algorithmic problem solving (hard graphs, DP) and distributed system design trade-offs. We recommend preparing on the Elite Tier track.`;
      suggestedTrackId = 'track_google';
    } else if (isFoundationTier) {
      tierCode = 'TIER_C';
      tierName = 'Foundation & Services Tier (Entry & Campus)';
      rationale = `${comp} hiring processes prioritize strong computer science fundamentals, OOP concepts, relational database queries, aptitude, and clean code implementation. We recommend the Foundation Tier track.`;
      suggestedTrackId = 'track_campus';
    } else {
      tierCode = 'TIER_B';
      tierName = 'Product & High-Growth Tier (Scaleups)';
      rationale = `${comp} focuses on practical problem solving, scalable REST APIs, microservice patterns, database indexing, and real-world system architecture. We recommend the Product & Scaleup track.`;
      suggestedTrackId = 'track_swiggy_zomato';
    }

    setRecommendationResult({
      tierCode,
      tierName,
      rationale,
      suggestedTrackId,
    });
  };

  const handleApplyRecommendation = () => {
    if (!recommendationResult) return;
    setSelectedTier(recommendationResult.tierCode);
    const target = tracks.find((t) => t.id === recommendationResult.suggestedTrackId) || tracks.find((t) => t.tierCode === recommendationResult.tierCode);
    if (target) setSelectedTrack(target);
    setShowRecModal(false);
  };

  const filteredTracks = tracks.filter((track) => {
    const matchesTier = selectedTier === 'ALL' || track.tierCode === selectedTier;
    const matchesSearch =
      track.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      track.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole =
      selectedRole === 'ALL' ||
      !track.roles ||
      track.roles.includes(selectedRole);
    const matchesLevel =
      selectedLevel === 'ALL' ||
      !track.levels ||
      track.levels.includes(selectedLevel);
    return matchesTier && matchesSearch && matchesRole && matchesLevel;
  });

  const getRoundsForTrack = (track: CompanyTrack) => {
    return rounds
      .filter((r) => r.tierCode === track.tierCode)
      .filter((r) => selectedDifficulty === 'ALL' || r.difficulty === selectedDifficulty)
      .filter((r) => {
        if (selectedRole === 'ALL' || !r.targetRoles || r.targetRoles.length === 0) return true;
        return r.targetRoles.includes(selectedRole);
      })
      .filter((r) => {
        if (selectedLevel === 'ALL' || !r.targetLevels || r.targetLevels.length === 0) return true;
        return r.targetLevels.includes(selectedLevel);
      })
      .sort((a, b) => a.roundNumber - b.roundNumber);
  };

  const activeTierObj = tiers.find((t) => t.code === selectedTrack?.tierCode) || tiers[0];

  return (
    <div className="space-y-8 pb-16">
      {/* Header & Disclaimer */}
      <div className="space-y-3">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
          <Layers className="w-3.5 h-3.5" />
          <span>Configurable Company Pathways & Round Curricula</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Browse Practice Tracks & Interview Rounds
        </h1>
        <p className="text-sm sm:text-base text-slate-300 max-w-3xl leading-relaxed">
          Prepare across <strong className="text-white">FAANG & Elite Unicorn</strong>, <strong className="text-white">Product & High-Growth</strong>, and <strong className="text-white">Foundation & Services</strong> tiers. Transparent accounting: 50% goes directly to your approved interviewer and 50% to platform infrastructure.
        </p>
        <div className="flex items-start space-x-2 p-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-400 max-w-3xl">
          <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          <span>
            <strong>Simulated Practice Disclaimer:</strong> All interviews are simulated educational mock interviews conducted by vetted peers and industry engineers. Company names reflect preparation target tracks and do not imply official endorsement, sponsorship, or guaranteed hiring.
          </span>
        </div>
      </div>

      {/* Tier Price & Category Pill Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <button
          onClick={() => setSelectedTier('ALL')}
          className={`p-4 rounded-2xl border text-left transition ${
            selectedTier === 'ALL'
              ? 'bg-slate-800 border-indigo-500 text-white shadow-lg'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
          }`}
        >
          <div className="text-xs font-semibold uppercase tracking-wider">All Categories</div>
          <div className="text-lg font-bold text-white mt-1">Full Catalog</div>
          <div className="text-[11px] text-slate-400 mt-1">10+ specialized tracks</div>
        </button>

        {tiers.map((tier) => (
          <button
            key={tier.id}
            onClick={() => setSelectedTier(tier.code)}
            className={`p-4 rounded-2xl border text-left transition ${
              selectedTier === tier.code
                ? 'bg-slate-800 border-indigo-500 text-white shadow-lg'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                {tier.badge}
              </span>
              <span className="text-lg font-extrabold text-white">₹{tier.price}</span>
            </div>
            <div className="text-base font-bold text-white mt-1">{tier.name}</div>
            <div className="text-[11px] text-slate-400 mt-1 truncate">{tier.description}</div>
            <div className="text-[10px] text-emerald-400 font-semibold mt-1.5 flex items-center space-x-1">
              <span>50% Interviewer Share (₹{tier.price * 0.5})</span>
            </div>
          </button>
        ))}
      </div>

      {/* Search and Filters Bar with Role, Level, & Recommendation Tool */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900 border border-slate-800">
        <div className="relative w-full lg:w-72 shrink-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search company (Google, Uber, Swiggy, TCS)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {/* Role Filter */}
          <div className="flex items-center space-x-1.5 shrink-0">
            <span className="text-xs text-slate-400">Role:</span>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-2.5 py-2 focus:outline-none focus:border-indigo-500 font-medium"
            >
              <option value="ALL">All Roles</option>
              <option value="Data Scientist">Data Scientist</option>
              <option value="AI Engineer">AI Engineer</option>
              <option value="AI / Machine Learning Engineer">AI / Machine Learning Engineer</option>
              <option value="Software Engineer">Software Engineer</option>
              <option value="Frontend Engineer">Frontend Engineer</option>
              <option value="Backend Engineer">Backend Engineer</option>
              <option value="Full-Stack Engineer">Full-Stack Engineer</option>
              <option value="Data Engineer">Data Engineer</option>
              <option value="DevOps / Cloud Engineer">DevOps / Cloud Engineer</option>
              <option value="Engineering Manager">Engineering Manager</option>
            </select>
          </div>

          {/* Seniority Level Filter */}
          <div className="flex items-center space-x-1.5 shrink-0">
            <span className="text-xs text-slate-400">Level:</span>
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-2.5 py-2 focus:outline-none focus:border-indigo-500 font-medium"
            >
              <option value="ALL">All Levels</option>
              <option value="Junior / Entry-Level (L3 / SDE-1)">Junior / Entry-Level (L3)</option>
              <option value="Mid-Level (L4 / SDE-2)">Mid-Level (L4 / SDE-2)</option>
              <option value="Senior Engineer (L5 / Senior)">Senior Engineer (L5)</option>
              <option value="Staff / Principal Engineer (L6 / Staff)">Staff / Principal (L6)</option>
            </select>
          </div>

          {/* Difficulty Filter */}
          <div className="flex items-center space-x-1.5 shrink-0">
            <span className="text-xs text-slate-400 flex items-center space-x-1">
              <Filter className="w-3.5 h-3.5" />
              <span>Diff:</span>
            </span>
            <select
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-2.5 py-2 focus:outline-none focus:border-indigo-500 font-medium"
            >
              <option value="ALL">All Diff</option>
              <option value="ENTRY">Entry Level</option>
              <option value="MEDIUM">Medium</option>
              <option value="HARD">Hard</option>
              <option value="EXPERT">Expert</option>
            </select>
          </div>

          <button
            onClick={() => {
              setRecCompany(searchQuery);
              setShowRecModal(true);
            }}
            className="px-3 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 hover:text-white text-xs font-semibold flex items-center space-x-1.5 transition ml-auto"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Company AI Guide</span>
          </button>
        </div>
      </div>

      {/* Main Track Grid & Active Round Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Track List (Left Column) */}
        <div className="lg:col-span-5 space-y-3">
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider px-1">
            Target Company Tracks ({filteredTracks.length})
          </h2>

          <div className="space-y-2 max-h-[680px] overflow-y-auto pr-1">
            {filteredTracks.length === 0 ? (
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">No track matches "{searchQuery}"</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Don't worry! Enter basic details about {searchQuery || 'your target company'} (company type, salary, role) and get an instant Tier & round recommendation.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setRecCompany(searchQuery);
                    setShowRecModal(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition"
                >
                  Get Tier Recommendation for "{searchQuery}"
                </button>
              </div>
            ) : (
              filteredTracks.map((track) => {
                const isSelected = selectedTrack?.id === track.id;
                const tier = tiers.find((t) => t.code === track.tierCode);

                return (
                  <div
                    key={track.id}
                    onClick={() => setSelectedTrack(track)}
                    className={`p-4 rounded-2xl border text-left cursor-pointer transition ${
                      isSelected
                        ? 'bg-slate-800/90 border-indigo-500 ring-1 ring-indigo-500/50 shadow-md'
                        : 'bg-slate-900 border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          track.tierCode === 'TIER_A'
                            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                            : track.tierCode === 'TIER_B'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {track.badge || track.tierCode.replace('_', ' ')}
                      </span>
                      <span className="text-sm font-extrabold text-white">₹{tier?.price || 100}</span>
                    </div>

                    <h3 className="text-base font-bold text-white mt-2 flex items-center justify-between">
                      <span>{track.name}</span>
                      <ChevronRight className={`w-4 h-4 text-slate-400 transition ${isSelected ? 'rotate-90 text-indigo-400' : ''}`} />
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {track.description}
                    </p>

                    <div className="mt-3 flex items-center space-x-3 text-[11px] text-slate-400">
                      <span>{track.recommendedRounds} Recommended Rounds</span>
                      <span>•</span>
                      <span className="text-indigo-400 font-medium">Click to view rounds</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Selected Track Rounds (Right Column) */}
        <div className="lg:col-span-7">
          {selectedTrack ? (
            <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-6 shadow-xl">
              {/* Track Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      {selectedTrack.tierCode.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-slate-400">
                      {selectedTrack.recommendedRounds} Round Pathway
                    </span>
                  </div>
                  <h2 className="text-2xl font-extrabold text-white mt-1">{selectedTrack.name}</h2>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    {selectedTrack.description}
                  </p>
                </div>

                <div className="sm:text-right shrink-0">
                  <div className="text-[11px] text-slate-400">Session Price</div>
                  <div className="text-2xl font-extrabold text-white">₹{activeTierObj?.price || 100}</div>
                  <div className="text-[10px] text-emerald-400 font-semibold">100% Refundable if unfulfilled</div>
                </div>
              </div>

              {/* Rounds List */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Select Round to Book Practice Session:
                </h3>

                {getRoundsForTrack(selectedTrack).map((round) => (
                  <div
                    key={round.id}
                    className="rounded-2xl bg-slate-950 border border-slate-800 p-5 space-y-4 hover:border-slate-700 transition"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="w-5 h-5 rounded-full bg-indigo-600/30 text-indigo-400 font-bold text-xs flex items-center justify-center">
                            {round.roundNumber}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              round.difficulty === 'ENTRY'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : round.difficulty === 'MEDIUM'
                                ? 'bg-indigo-500/20 text-indigo-300'
                                : round.difficulty === 'HARD'
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-rose-500/20 text-rose-300'
                            }`}
                          >
                            {round.difficulty} DIFFICULTY
                          </span>
                          <span className="text-xs text-slate-400 flex items-center space-x-1">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{round.durationMins} mins</span>
                          </span>
                        </div>
                        <h4 className="text-base font-bold text-white mt-1.5">{round.name}</h4>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-lg font-extrabold text-white">
                          ₹{activeTierObj?.price || round.price}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">{round.description}</p>

                    {/* Topics Covered */}
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-semibold text-slate-400">Key Focus Topics:</div>
                      <div className="flex flex-wrap gap-1.5">
                        {round.topics.map((t, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[11px]"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Evaluation Rubrics */}
                    <div className="space-y-1.5 pt-2 border-t border-slate-900">
                      <div className="text-[11px] font-semibold text-slate-400">Evaluation Rubrics:</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-slate-300">
                        {round.rubricCriteria.map((c, i) => (
                          <div key={i} className="flex items-center space-x-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                            <span>{c}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Book Action */}
                    <div className="pt-2 flex items-center justify-between">
                      <div className="text-[11px] text-slate-400">
                        No subscription • Pay per practice session
                      </div>
                      <button
                        onClick={() =>
                          onSelectRoundForBooking(
                            selectedTrack,
                            round,
                            activeTierObj,
                            selectedRole !== 'ALL' ? selectedRole : undefined,
                            selectedLevel !== 'ALL' ? selectedLevel : undefined
                          )
                        }
                        className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/30 transition flex items-center space-x-2"
                      >
                        <span>Book Round {round.roundNumber} (₹{activeTierObj?.price || round.price})</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400">
              Select a company preparation track on the left to inspect its round curriculum.
            </div>
          )}
        </div>
      </div>

      {/* Target Company Recommendation Modal */}
      {showRecModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Target Company Track Matcher</h3>
                  <p className="text-[11px] text-slate-400">Instant AI/heuristic evaluation of interview tier & salary bar</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowRecModal(false);
                  setRecommendationResult(null);
                }}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center text-sm font-bold transition"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Company Name:</label>
                <input
                  type="text"
                  placeholder="e.g. Stripe, Coinbase, Cisco, Oracle, Cognizant..."
                  value={recCompany}
                  onChange={(e) => setRecCompany(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Company Category / Stage:</label>
                  <select
                    value={recType}
                    onChange={(e) => setRecType(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="FAANG_HFT">FAANG / Big Tech / High-Frequency Trading</option>
                    <option value="PRODUCT_SCALEUP">Unicorn / High-Growth Scaleup (Series B+)</option>
                    <option value="ENTERPRISE_MNC">Enterprise Product MNC (Adobe, Oracle, Cisco)</option>
                    <option value="EARLY_STARTUP">Early-Stage Tech Startup (Seed / Series A)</option>
                    <option value="IT_SERVICES">IT Services / Tech Consultancy (TCS, Infosys)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Target CTC / Salary (LPA):</label>
                  <select
                    value={recSalary}
                    onChange={(e) => setRecSalary(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="35_PLUS">35+ LPA (Top-Tier Compensation / Senior)</option>
                    <option value="18_35">18–35 LPA (High-Growth Product Role)</option>
                    <option value="8_18">8–18 LPA (Standard Product Role)</option>
                    <option value="UNDER_8">Under 8 LPA (Entry / Campus / Services)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Target Engineering Role:</label>
                  <select
                    value={recRole}
                    onChange={(e) => setRecRole(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Software Engineer">Software Engineer</option>
                    <option value="Frontend Engineer">Frontend Engineer</option>
                    <option value="Backend Engineer">Backend Engineer</option>
                    <option value="Full-Stack Engineer">Full-Stack Engineer</option>
                    <option value="Data Scientist">Data Scientist</option>
                    <option value="AI / Machine Learning Engineer">AI / Machine Learning Engineer</option>
                    <option value="Data Engineer">Data Engineer</option>
                    <option value="DevOps / Cloud Engineer">DevOps / Cloud Engineer</option>
                    <option value="Engineering Manager">Engineering Manager</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Target Seniority Bar:</label>
                  <select
                    defaultValue="Mid-Level (L4 / SDE-2)"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Junior / Entry-Level (L3 / SDE-1)">Junior / Entry-Level (L3 / SDE-1)</option>
                    <option value="Mid-Level (L4 / SDE-2)">Mid-Level (L4 / SDE-2)</option>
                    <option value="Senior Engineer (L5 / Senior)">Senior Engineer (L5 / Senior)</option>
                    <option value="Staff / Principal Engineer (L6 / Staff)">Staff / Principal Engineer (L6 / Staff)</option>
                  </select>
                </div>
              </div>

              <button
                type="button"
                onClick={handleRunRecommendation}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition flex items-center justify-center space-x-1.5"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Evaluate & Recommend Best Interview Tier</span>
              </button>

              {/* Recommendation Result */}
              {recommendationResult && (
                <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Match Found</span>
                    <span className="text-xs font-extrabold px-2.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      {recommendationResult.tierCode.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="text-base font-bold text-white">{recommendationResult.tierName}</div>
                  <p className="text-xs text-slate-300 leading-relaxed">{recommendationResult.rationale}</p>

                  <button
                    type="button"
                    onClick={handleApplyRecommendation}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition flex items-center justify-center space-x-2"
                  >
                    <span>Select Recommended Track & View Rounds</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
