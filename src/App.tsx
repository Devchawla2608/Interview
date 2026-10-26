import React, { useState, useEffect } from 'react';
import { User, CompanyTrack, RoundTemplate, Tier, Booking } from './types';
import { api, getAuthToken, setAuthToken } from './services/api';
import { Navbar } from './components/Navbar';
import { CandidateDashboard } from './components/CandidateDashboard';
import { CatalogView } from './components/CatalogView';
import { CheckoutModal } from './components/CheckoutModal';
import { QueueTrackerModal } from './components/QueueTrackerModal';
import { InterviewerDashboard } from './components/InterviewerDashboard';
import { InterviewerApplication } from './components/InterviewerApplication';
import { SessionWorkspace } from './components/SessionWorkspace';
import { FeedbackModal } from './components/FeedbackModal';
import { ReviewModal } from './components/ReviewModal';
import { AdminDashboard } from './components/AdminDashboard';
import { Footer } from './components/Footer';
import { PolicyModals } from './components/PolicyModals';
import { AuthModal } from './components/AuthModal';

import { useTheme } from './context/ThemeContext';

export default function App() {
  const { theme } = useTheme();
  const [currentUser, setCurrentUserObj] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<string>('catalog');
  const [activeQueueCount, setActiveQueueCount] = useState<number>(0);
  const [hasActiveQueue, setHasActiveQueue] = useState<boolean>(false);
  const [catalogInitialTier, setCatalogInitialTier] = useState<string | undefined>(undefined);

  // Auth modal state
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'register'>('signin');
  const [authRedirectMessage, setAuthRedirectMessage] = useState<string | undefined>(undefined);
  const [pendingBookingTarget, setPendingBookingTarget] = useState<{
    track: CompanyTrack;
    round: RoundTemplate;
    tier: Tier;
    role?: string;
    level?: string;
  } | null>(null);

  // Modals state
  const [bookingCheckoutTarget, setBookingCheckoutTarget] = useState<{
    track: CompanyTrack;
    round: RoundTemplate;
    tier: Tier;
    role?: string;
    level?: string;
  } | null>(null);

  const [showQueueTracker, setShowQueueTracker] = useState<boolean>(false);
  const [activeWorkspaceBookingId, setActiveWorkspaceBookingId] = useState<string | null>(null);
  const [feedbackBookingId, setFeedbackBookingId] = useState<string | null>(null);
  const [reviewBookingId, setReviewBookingId] = useState<string | null>(null);
  const [activePolicy, setActivePolicy] = useState<'terms' | 'refund' | 'privacy' | 'faq' | null>(null);

  useEffect(() => {
    initApp();
  }, []);

  const initApp = async () => {
    const token = getAuthToken();
    if (!token) {
      setCurrentUserObj(null);
      setActiveTab('catalog');
      return;
    }

    try {
      const res = await api.getMe();
      setCurrentUserObj(res.user);

      // Default active tab based on user's active role
      if (res.user.activeRole === 'ADMIN') {
        setActiveTab('admin-dashboard');
      } else if (res.user.activeRole === 'INTERVIEWER') {
        setActiveTab('interviewer-dashboard');
      } else {
        setActiveTab('candidate-dashboard');
      }

      checkQueueStatus();
    } catch (err) {
      console.warn('Session verification error:', err);
      setAuthToken(null);
      setCurrentUserObj(null);
      setActiveTab('catalog');
    }
  };

  const checkQueueStatus = async () => {
    if (!getAuthToken()) return;
    try {
      const [queueRes, myQueueRes] = await Promise.all([
        api.getQueue().catch(() => ({ totalWaiting: 0 })),
        api.getMyQueueStatus().catch(() => ({ inQueue: false })),
      ]);
      setActiveQueueCount((queueRes as any).totalWaiting || 0);
      setHasActiveQueue((myQueueRes as any).inQueue || false);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (currentUser) {
      const interval = setInterval(checkQueueStatus, 6000);
      return () => clearInterval(interval);
    }
  }, [currentUser?.id]);

  // Tab navigation with strict authorization guards
  const handleTabChange = (targetTab: string) => {
    // Unauthenticated protection
    if (!currentUser && targetTab !== 'catalog') {
      setAuthRedirectMessage('Please sign in to access your interview arena and dashboards.');
      setAuthModalMode('signin');
      setIsAuthModalOpen(true);
      return;
    }

    // Role-specific protection
    if (targetTab === 'admin-dashboard' && (!currentUser || !currentUser.roles.includes('ADMIN'))) {
      alert('Access Denied: Administrator privileges required.');
      return;
    }

    if (targetTab === 'interviewer-dashboard' && (!currentUser || (!currentUser.roles.includes('INTERVIEWER') && !currentUser.roles.includes('ADMIN')))) {
      setActiveTab('become-interviewer');
      return;
    }

    setActiveTab(targetTab);
  };

  const handleNavigateToCatalog = (tier?: string) => {
    setCatalogInitialTier(tier);
    setActiveTab('catalog');
  };

  const handleSelectRoundForBooking = (
    track: CompanyTrack,
    round: RoundTemplate,
    tier: Tier,
    role?: string,
    level?: string
  ) => {
    if (!currentUser) {
      setPendingBookingTarget({ track, round, tier, role, level });
      setAuthRedirectMessage('Please sign in or create an account to book your practice session.');
      setAuthModalMode('signin');
      setIsAuthModalOpen(true);
      return;
    }

    setBookingCheckoutTarget({ track, round, tier, role, level });
  };

  const handleAuthSuccess = (user: User) => {
    setCurrentUserObj(user);
    setIsAuthModalOpen(false);

    if (pendingBookingTarget) {
      setBookingCheckoutTarget(pendingBookingTarget);
      setPendingBookingTarget(null);
    } else {
      if (user.activeRole === 'ADMIN') setActiveTab('admin-dashboard');
      else if (user.activeRole === 'INTERVIEWER') setActiveTab('interviewer-dashboard');
      else setActiveTab('candidate-dashboard');
    }

    checkQueueStatus();
  };

  const handleBookingSuccess = (booking: Booking) => {
    setBookingCheckoutTarget(null);
    setHasActiveQueue(true);
    setShowQueueTracker(true);
  };

  const handleOpenWorkspace = (bookingId: string) => {
    setActiveWorkspaceBookingId(bookingId);
    setActiveTab('workspace');
  };

  return (
    <div
      className={`min-h-screen transition-colors duration-200 flex flex-col font-sans selection:bg-indigo-500 selection:text-white ${
        theme === 'light'
          ? 'bg-slate-50 text-slate-900'
          : 'bg-slate-950 text-slate-100'
      }`}
    >
      {/* Persistent Navigation */}
      <Navbar
        currentUser={currentUser}
        onUserChange={(u) => {
          setCurrentUserObj(u);
          if (!u) setActiveTab('catalog');
        }}
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        activeQueueCount={activeQueueCount}
        hasActiveQueue={hasActiveQueue}
        onOpenPolicies={(pol) => setActivePolicy(pol)}
        onOpenQueueTracker={() => setShowQueueTracker(true)}
        onOpenAuth={(mode) => {
          setAuthRedirectMessage(undefined);
          setAuthModalMode(mode || 'signin');
          setIsAuthModalOpen(true);
        }}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Public Catalog View */}
        {activeTab === 'catalog' && (
          <CatalogView
            initialTier={catalogInitialTier}
            onSelectRoundForBooking={handleSelectRoundForBooking}
          />
        )}

        {/* Candidate Dashboard (Protected) */}
        {activeTab === 'candidate-dashboard' && currentUser && (
          <CandidateDashboard
            currentUser={currentUser}
            onNavigateToCatalog={handleNavigateToCatalog}
            onOpenWorkspace={handleOpenWorkspace}
            onOpenQueueTracker={() => setShowQueueTracker(true)}
            onOpenFeedback={(id) => setFeedbackBookingId(id)}
            onOpenReview={(id) => setReviewBookingId(id)}
          />
        )}

        {/* Interviewer Dashboard (Protected) */}
        {activeTab === 'interviewer-dashboard' && currentUser && (currentUser.roles.includes('INTERVIEWER') || currentUser.roles.includes('ADMIN')) && (
          <InterviewerDashboard
            currentUser={currentUser}
            onOpenWorkspace={handleOpenWorkspace}
            onNavigateToApplication={() => setActiveTab('become-interviewer')}
          />
        )}

        {/* Interviewer Application (Protected / Accessible to Candidates) */}
        {activeTab === 'become-interviewer' && (
          <InterviewerApplication
            currentUser={currentUser}
            onNavigateToInterviewerPortal={() => setActiveTab('interviewer-dashboard')}
          />
        )}

        {/* Admin Dashboard (STRICTLY Protected: ADMIN role only) */}
        {activeTab === 'admin-dashboard' && currentUser && currentUser.roles.includes('ADMIN') && (
          <AdminDashboard
            currentUser={currentUser}
            onOpenWorkspace={handleOpenWorkspace}
          />
        )}

        {/* Live Workspace Room */}
        {activeTab === 'workspace' && activeWorkspaceBookingId && (
          <SessionWorkspace
            bookingId={activeWorkspaceBookingId}
            currentUser={currentUser}
            onBack={() => {
              if (currentUser?.activeRole === 'INTERVIEWER') setActiveTab('interviewer-dashboard');
              else if (currentUser?.activeRole === 'ADMIN') setActiveTab('admin-dashboard');
              else setActiveTab('candidate-dashboard');
            }}
            onOpenFeedbackModal={(id) => setFeedbackBookingId(id)}
            onOpenReviewModal={(id) => setReviewBookingId(id)}
          />
        )}
      </main>

      {/* Footer with Legal & Policies */}
      <Footer onOpenPolicy={(pol) => setActivePolicy(pol)} />

      {/* Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => {
          setIsAuthModalOpen(false);
          setPendingBookingTarget(null);
        }}
        onSuccess={handleAuthSuccess}
        initialMode={authModalMode}
        redirectMessage={authRedirectMessage}
      />

      {/* Modals */}
      {bookingCheckoutTarget && (
        <CheckoutModal
          track={bookingCheckoutTarget.track}
          round={bookingCheckoutTarget.round}
          tier={bookingCheckoutTarget.tier}
          initialRole={bookingCheckoutTarget.role}
          initialLevel={bookingCheckoutTarget.level}
          onClose={() => setBookingCheckoutTarget(null)}
          onBookingSuccess={handleBookingSuccess}
        />
      )}

      {showQueueTracker && (
        <QueueTrackerModal
          onClose={() => setShowQueueTracker(false)}
          onOpenWorkspace={handleOpenWorkspace}
        />
      )}

      {feedbackBookingId && (
        <FeedbackModal
          bookingId={feedbackBookingId}
          onClose={() => setFeedbackBookingId(null)}
          onSuccess={() => {
            setFeedbackBookingId(null);
            initApp();
          }}
        />
      )}

      {reviewBookingId && (
        <ReviewModal
          bookingId={reviewBookingId}
          onClose={() => setReviewBookingId(null)}
          onSuccess={() => {
            setReviewBookingId(null);
            initApp();
          }}
        />
      )}

      <PolicyModals
        policy={activePolicy}
        onClose={() => setActivePolicy(null)}
      />
    </div>
  );
}
