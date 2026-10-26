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
  onSelectRoundForBooking: (track: CompanyTrack, round: RoundTemplate, tier: Tier) => void;
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
  const [selectedTrack, setSelectedTrack] = useState<CompanyTrack | null>(null);
  const [loading, setLoading] = useState(true);

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

  const filteredTracks = tracks.filter((track) => {
    const matchesTier = selectedTier === 'ALL' || track.tierCode === selectedTier;
    const matchesSearch =
      track.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      track.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTier && matchesSearch;
  });

  const getRoundsForTrack = (track: CompanyTrack) => {
    return rounds
      .filter((r) => r.tierCode === track.tierCode)
      .filter((r) => selectedDifficulty === 'ALL' || r.difficulty === selectedDifficulty)
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
          Choose from Tier A (Top-tier product firms), Tier B (Established tech), or Tier C (Campus & fundamentals). Each track includes graduated rounds with structured evaluation rubrics.
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
            <div className="text-base font-bold text-white mt-1">{tier.name.split('—')[0]}</div>
            <div className="text-[11px] text-slate-400 mt-1 truncate">{tier.description}</div>
          </button>
        ))}
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900 border border-slate-800">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search company track (e.g. Google, Meta, FinTech)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <span className="text-xs text-slate-400 flex items-center space-x-1 shrink-0">
            <Filter className="w-3.5 h-3.5" />
            <span>Difficulty:</span>
          </span>
          <select
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Difficulties</option>
            <option value="ENTRY">Entry Level</option>
            <option value="MEDIUM">Medium / Mid-Level</option>
            <option value="HARD">Hard Algorithmic</option>
            <option value="EXPERT">Expert / System Design</option>
          </select>
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
            {filteredTracks.map((track) => {
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
                      {track.tierCode.replace('_', ' ')}
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
            })}
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
                        onClick={() => onSelectRoundForBooking(selectedTrack, round, activeTierObj)}
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
    </div>
  );
};
