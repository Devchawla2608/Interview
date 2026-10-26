export type UserRole = 'CANDIDATE' | 'INTERVIEWER' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  roles: UserRole[];
  activeRole: UserRole;
  isSuspended: boolean;
  emailVerified: boolean;
  createdAt: string;
  candidateProfile?: CandidateProfile;
  interviewerProfile?: InterviewerProfile;
}

export interface CandidateProfile {
  id: string;
  userId: string;
  targetRoles: string[];
  experienceLevel: 'STUDENT' | 'FRESHER' | '1-3_YEARS' | '3-5_YEARS' | '5+_YEARS';
  graduationYear?: number;
  collegeOrEmployer?: string;
  bio?: string;
  preferredLanguages: string[];
  timezone: string;
  totalSessions: number;
  totalSpent: number;
  // Enhanced profile completion fields
  targetCompanies?: string[];
  targetSalaryBracket?: string;
  primaryFocusAreas?: string[];
  resumeUrl?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  profileCompletionPercent?: number;
}

export type InterviewerStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'SCREENING_REQUIRED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'SUSPENDED';

export interface InterviewerAttendanceWarning {
  id: string;
  bookingId: string;
  bookingRef: string;
  reason: string;
  issuedAt: string;
  escalatedToAdmin: boolean;
}

export interface InterviewerProfile {
  id: string;
  userId: string;
  headline: string;
  bio: string;
  experienceYears: number;
  collegeOrEmployer: string;
  currentCompany?: string;
  currentRole?: string;
  skills: string[];
  preferredTiers: ('TIER_A' | 'TIER_B' | 'TIER_C')[];
  languages: string[];
  status: InterviewerStatus;
  isAvailable: boolean;
  ratingAvg: number;
  ratingCount: number;
  totalCompletedSessions: number;
  bankAccountMask?: string;
  upiId?: string;
  reviewerNotes?: string;
  // Enhanced profile & attendance fields
  linkedinUrl?: string;
  githubUrl?: string;
  primaryInterviewDomains?: string[];
  totalPastInterviewsConducted?: number;
  warningCount: number; // 3 warnings rule
  warnings: InterviewerAttendanceWarning[];
  isBlockedByAdmin: boolean;
  activeSessionId?: string | null;
  profileCompletionPercent?: number;
}

export interface InterviewerApplication {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  status: InterviewerStatus;
  submittedAt: string;
  resumeUrl?: string;
  yearsOfExperience: number;
  skills: string[];
  currentCompany: string;
  screening1: {
    status: 'PENDING' | 'SCHEDULED' | 'COMPLETED' | 'FAILED';
    interviewerName?: string;
    scheduledAt?: string;
    score?: number;
    notes?: string;
  };
  screening2: {
    status: 'PENDING' | 'SCHEDULED' | 'COMPLETED' | 'FAILED';
    interviewerName?: string;
    scheduledAt?: string;
    score?: number;
    notes?: string;
  };
  adminNotes?: string;
  reviewedAt?: string;
}

export type TierCode = 'TIER_A' | 'TIER_B' | 'TIER_C';

export interface Tier {
  id: string;
  code: TierCode;
  name: string;
  badge: string;
  price: number; // in INR (₹)
  description: string;
  commissionPercent: number; // e.g. 20%
  defaultRoundCount: number;
  order: number;
  isActive: boolean;
}

export interface CompanyTrack {
  id: string;
  tierCode: TierCode;
  name: string;
  slug: string;
  description: string;
  badge: string;
  recommendedRounds: number;
  isActive: boolean;
}

export interface RoundTemplate {
  id: string;
  tierCode: TierCode;
  trackId?: string;
  roundNumber: number;
  name: string;
  description: string;
  durationMins: number;
  price: number;
  difficulty: 'ENTRY' | 'MEDIUM' | 'HARD' | 'EXPERT';
  topics: string[];
  rubricCriteria: string[];
  isActive: boolean;
}

export type BookingStatus =
  | 'AWAITING_PAYMENT'
  | 'PAID'
  | 'QUEUED'
  | 'CLAIMED'
  | 'SCHEDULED'
  | 'READY'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUND_PENDING'
  | 'REFUNDED'
  | 'NO_SHOW_CANDIDATE'
  | 'NO_SHOW_INTERVIEWER'
  | 'DISPUTED';

export interface Booking {
  id: string;
  bookingRef: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  interviewerId?: string;
  interviewerName?: string;
  tierCode: TierCode;
  trackName: string;
  roundName: string;
  roundNumber: number;
  roundDurationMins: number;
  bookingType: 'QUEUE' | 'SCHEDULED';
  status: BookingStatus;
  scheduledAt?: string;
  preferredLanguage: string;
  jobRole: string;
  price: number;
  platformFee: number;
  totalAmount: number;
  interviewerEarnings: number;
  paymentOrderId?: string;
  paymentStatus: 'UNPAID' | 'PAID' | 'REFUNDED';
  meetingUrl?: string;
  meetingProvider: 'IN_HOUSE_MEET' | 'DEV_FALLBACK_SANDBOX';
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
  // Free promo & refund & complaint fields
  promoCodeApplied?: string;
  isFreePromo?: boolean;
  interviewerAttendedAt?: string;
  attendanceEscalated?: boolean;
  refundRequested?: boolean;
  refundStatus?: 'NONE' | 'REQUESTED' | 'PROCESSED' | 'REJECTED';
  refundReason?: string;
  disputeId?: string;
}

export interface QueueEntry {
  id: string;
  bookingId: string;
  candidateId: string;
  candidateName: string;
  tierCode: TierCode;
  trackName: string;
  roundName: string;
  roundNumber: number;
  jobRole: string;
  durationMins: number;
  preferredLanguage: string;
  expectedCompensation: number;
  status: 'WAITING' | 'CLAIMED' | 'TIMEOUT' | 'CANCELLED';
  enteredAt: string;
  timeoutAt: string;
  claimedBy?: string;
  claimedAt?: string;
  hasActiveConflict?: boolean;
  conflictReason?: string;
}

export interface CompanyEvaluationRequest {
  id: string;
  userId: string;
  companyName: string;
  companyType: string;
  targetRole: string;
  expectedSalaryLpa: string;
  recommendedTierCode: TierCode;
  recommendedTierName: string;
  rationale: string;
  createdAt: string;
}

export interface PaymentConfig {
  upiMerchantVpa: string;
  upiMerchantName: string;
  acceptedPromoCodes: string[];
}
}

export interface InterviewerAvailabilitySlot {
  id: string;
  interviewerId: string;
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.
  startTime: string; // "14:00"
  endTime: string; // "18:00"
  isActive: boolean;
}

export interface PaymentOrder {
  id: string;
  orderRef: string;
  bookingId: string;
  userId: string;
  amount: number;
  currency: string;
  status: 'CREATED' | 'CAPTURED' | 'FAILED' | 'REFUNDED';
  provider: 'RAZORPAY_TEST' | 'RAZORPAY_LIVE' | 'DEV_MOCK';
  providerOrderId: string;
  providerPaymentId?: string;
  signature?: string;
  createdAt: string;
}

export interface Refund {
  id: string;
  refundRef: string;
  bookingId: string;
  amount: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'PROCESSED' | 'REJECTED';
  initiatedBy: string;
  adminNotes?: string;
  providerRefundId?: string;
  createdAt: string;
  processedAt?: string;
}

export type LedgerEntryType =
  | 'PAYMENT_RECEIVED'
  | 'PLATFORM_COMMISSION'
  | 'INTERVIEWER_CREDIT'
  | 'REFUND_DEBIT'
  | 'PAYOUT_DEBIT'
  | 'ADMIN_ADJUSTMENT';

export interface LedgerEntry {
  id: string;
  bookingId?: string;
  userId?: string;
  type: LedgerEntryType;
  amount: number; // positive = credit, negative = debit
  balanceAfter: number;
  description: string;
  referenceId: string;
  createdAt: string;
}

export interface InterviewerEarnings {
  interviewerId: string;
  pendingBalance: number;
  availableBalance: number;
  paidBalance: number;
  totalEarned: number;
  payoutHistory: PayoutRecord[];
}

export interface PayoutRecord {
  id: string;
  payoutRef: string;
  amount: number;
  status: 'PENDING' | 'PROCESSED' | 'FAILED';
  destination: string;
  referenceCode?: string;
  createdAt: string;
  processedAt?: string;
}

export interface FeedbackCriterionScore {
  criterion: string;
  score: number; // 1 to 5
  comments: string;
}

export interface InterviewFeedback {
  id: string;
  bookingId: string;
  interviewerId: string;
  interviewerName: string;
  candidateId: string;
  criteriaScores: FeedbackCriterionScore[];
  overallScore: number;
  strengths: string;
  improvementAreas: string;
  recommendedTopics: string[];
  recommendedNextRound: string;
  practiceReadiness: 'NEEDS_PRACTICE' | 'DEVELOPING' | 'JOB_READY' | 'EXCELLENT';
  submittedAt: string;
}

export interface CandidateReview {
  id: string;
  bookingId: string;
  candidateId: string;
  interviewerId: string;
  rating: number; // 1 to 5
  comment: string;
  createdAt: string;
}

export interface DisputeReport {
  id: string;
  bookingId: string;
  raisedByUserId: string;
  raisedByRole: UserRole;
  reason: string;
  description: string;
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED_REFUND' | 'RESOLVED_DISMISSED';
  adminNotes?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ALERT';
  isRead: boolean;
  link?: string;
  createdAt: string;
}

export interface AdminAuditLog {
  id: string;
  adminId: string;
  adminEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  details: string;
  ipAddress: string;
  createdAt: string;
}

export interface AppSettings {
  commissionPercent: number;
  queueTimeoutMinutes: number;
  claimTimeoutMinutes: number;
  autoRefundOnTimeout: boolean;
  razorpayKeyId: string;
  razorpayKeySecretConfigured: boolean;
  inHouseMeetingEnabled: boolean;
  emailConfigured: boolean;
  platformNotice: string;
}

export interface PlatformMetrics {
  totalUsers: number;
  candidateCount: number;
  interviewerCount: number;
  approvedInterviewersCount: number;
  totalBookings: number;
  completedSessions: number;
  activeQueueCount: number;
  grossPaymentVolume: number;
  platformCommissionRevenue: number;
  interviewerLiabilities: number;
  totalRefunds: number;
  averageRating: number;
  timeoutRate: number;
  noShowRate: number;
}
