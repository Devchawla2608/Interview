import {
  User,
  Tier,
  CompanyTrack,
  RoundTemplate,
  Booking,
  QueueEntry,
  InterviewerEarnings,
  InterviewerApplication,
  PlatformMetrics,
  AdminAuditLog,
  LedgerEntry,
  Refund,
  DisputeReport,
  NotificationItem,
  AppSettings,
  InterviewFeedback,
  CandidateReview,
} from '../types';

let authToken: string | null = localStorage.getItem('ia_jwt_token');

export function getAuthToken(): string | null {
  return authToken;
}

export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) {
    localStorage.setItem('ia_jwt_token', token);
  } else {
    localStorage.removeItem('ia_jwt_token');
  }
}

export function isAuthenticated(): boolean {
  return Boolean(authToken);
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(endpoint, { ...options, headers });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    if (response.status === 401 && endpoint !== '/api/auth/login' && endpoint !== '/api/auth/register') {
      // Token expired or invalid
      setAuthToken(null);
    }
    throw new Error(errorBody.error || `Request failed with status ${response.status}`);
  }
  return response.json();
}

export const api = {
  // Auth
  getMe: () => request<{ user: User }>('/api/auth/me'),

  login: async (email: string, password: string) => {
    const res = await request<{ success: boolean; token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (res.token) {
      setAuthToken(res.token);
    }
    return res;
  },

  register: async (fullName: string, email: string, password: string, role: string) => {
    const res = await request<{ success: boolean; token: string; user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ fullName, email, password, role }),
    });
    if (res.token) {
      setAuthToken(res.token);
    }
    return res;
  },

  logout: async () => {
    try {
      await request('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    } finally {
      setAuthToken(null);
    }
  },

  switchRole: async (role: string) => {
    const res = await request<{ success: boolean; token: string; user: User }>('/api/auth/switch-role', {
      method: 'POST',
      body: JSON.stringify({ role }),
    });
    if (res.token) {
      setAuthToken(res.token);
    }
    return res;
  },

  updateProfile: (data: any) => request<{ success: boolean; user: User }>('/api/auth/profile', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // Catalog (Public)
  getCatalog: () => request<{ tiers: Tier[]; tracks: CompanyTrack[]; rounds: RoundTemplate[]; platformNotice: string }>('/api/catalog'),

  // Bookings (Protected)
  getBookings: () => request<{ bookings: Booking[] }>('/api/bookings'),
  getBookingDetails: (id: string) => request<{ booking: Booking; feedback?: InterviewFeedback; review?: CandidateReview }>(`/api/bookings/${id}`),
  createBooking: (data: any) => request<{ success: boolean; booking: Booking; razorpayKeyId: string }>('/api/bookings/create', { method: 'POST', body: JSON.stringify(data) }),
  cancelBooking: (id: string, reason: string) => request<{ success: boolean; booking: Booking }>(`/api/bookings/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),
  startSession: (id: string) => request<{ success: boolean; booking: Booking }>(`/api/bookings/${id}/start`, { method: 'POST' }),

  // Queue (Protected)
  getQueue: () => request<{ queue: QueueEntry[]; totalWaiting: number; isInterviewerApproved: boolean }>('/api/queue'),
  getMyQueueStatus: () => request<{ inQueue: boolean; entry?: QueueEntry; booking?: Booking; position?: number; totalInQueue?: number; estimatedWaitMins?: number }>('/api/queue/my'),
  claimQueueEntry: (bookingId: string) => request<{ success: boolean; message: string; booking: Booking }>(`/api/queue/${bookingId}/claim`, { method: 'POST' }),

  // Payments (Protected)
  getPaymentConfig: () => request<{ upiMerchantVpa: string; upiMerchantName: string; acceptedPromoCodes: string[]; keyId: string }>('/api/payments/config'),
  createPaymentOrder: (bookingId: string) => request<{ success: boolean; orderId: string; orderRecordId: string; amount: number; currency: string; keyId: string; bookingRef: string; provider: string; upiMerchantVpa?: string; upiMerchantName?: string }>('/api/payments/create-order', { method: 'POST', body: JSON.stringify({ bookingId }) }),
  applyPromoCode: (bookingId: string, promoCode: string) => request<{ success: boolean; message: string; booking: Booking }>('/api/payments/apply-promo', { method: 'POST', body: JSON.stringify({ bookingId, promoCode }) }),
  verifyPayment: (data: any) => request<{ success: boolean; message: string; booking: Booking }>('/api/payments/verify', { method: 'POST', body: JSON.stringify(data) }),

  // Bookings lifecycle
  interviewerCheckIn: (bookingId: string) => request<{ success: boolean; message: string; booking: Booking }>(`/api/bookings/${bookingId}/check-in`, { method: 'POST' }),
  reportInterviewerAbsent: (bookingId: string, reason?: string) => request<{ success: boolean; message: string; warningCount: number; isBlocked: boolean }>(`/api/bookings/${bookingId}/report-absent`, { method: 'POST', body: JSON.stringify({ reason }) }),
  requestBookingRefund: (bookingId: string, reason: string) => request<{ success: boolean; message: string; refund?: any }>(`/api/bookings/${bookingId}/request-refund`, { method: 'POST', body: JSON.stringify({ reason }) }),
  fileBookingDispute: (bookingId: string, category: string, reason: string, requestedResolution?: string) => request<{ success: boolean; message: string; dispute?: any }>(`/api/bookings/${bookingId}/dispute`, { method: 'POST', body: JSON.stringify({ category, reason, requestedResolution }) }),

  // Candidate Profile Questionnaire
  updateCandidateProfile: (data: any) => request<{ success: boolean; user: User; candidateProfile: any }>('/api/auth/profile', { method: 'POST', body: JSON.stringify(data) }),

  // Interviewer (Protected)
  getInterviewerProfile: () => request<{ profile?: any; application?: InterviewerApplication }>('/api/interviewer/profile'),
  updateInterviewerProfile: (data: any) => request<{ success: boolean; profile: any }>('/api/interviewer/profile/update', { method: 'POST', body: JSON.stringify(data) }),
  applyInterviewer: (data: any) => request<{ success: boolean; profile: any; application: InterviewerApplication }>('/api/interviewer/apply', { method: 'POST', body: JSON.stringify(data) }),
  toggleAvailability: () => request<{ success: boolean; isAvailable: boolean }>('/api/interviewer/toggle-availability', { method: 'POST' }),
  getInterviewerEarnings: () => request<{ earnings: InterviewerEarnings; completedSessions: Booking[] }>('/api/interviewer/earnings'),
  requestPayout: (amount: number, destination: string) => request<{ success: boolean; payout: any; earnings: InterviewerEarnings }>('/api/interviewer/request-payout', { method: 'POST', body: JSON.stringify({ amount, destination }) }),
  getAvailabilitySlots: () => request<{ slots: any[] }>('/api/interviewer/availability'),
  updateAvailabilitySlots: (slots: any[]) => request<{ success: boolean; slots: any[] }>('/api/interviewer/availability', { method: 'POST', body: JSON.stringify({ slots }) }),
  getInterviewerCalendar: () => request<{ bookedSessions: Booking[]; blockedSlots: any[]; availabilitySlots: any[] }>('/api/interviewer/calendar'),
  addInterviewerBlockedSlot: (data: { title: string; date: string; startTime: string; endTime: string; reason?: string }) => request<{ success: boolean; slot: any }>('/api/interviewer/calendar/block', { method: 'POST', body: JSON.stringify(data) }),
  removeInterviewerBlockedSlot: (id: string) => request<{ success: boolean; message: string }>(`/api/interviewer/calendar/block/${id}`, { method: 'DELETE' }),
  getScheduledRequests: () => request<{ scheduledRequests: (Booking & { isBlockedForMe: boolean; blockedReason?: string })[] }>('/api/interviewer/scheduled-requests'),
  acceptScheduledBooking: (bookingId: string) => request<{ success: boolean; message: string; booking: Booking }>(`/api/interviewer/accept-scheduled/${bookingId}`, { method: 'POST' }),
  getAdminInterviewerCalendar: (id: string) => request<{ interviewer: any; bookedSessions: Booking[]; blockedSlots: any[]; availabilitySlots: any[] }>(`/api/admin/interviewers/${id}/calendar`),

  // Feedback & Reviews (Protected)
  submitFeedback: (data: any) => request<{ success: boolean; feedback: InterviewFeedback; booking: Booking }>('/api/feedback/submit', { method: 'POST', body: JSON.stringify(data) }),
  submitReview: (bookingId: string, rating: number, comment: string) => request<{ success: boolean; review: CandidateReview }>('/api/feedback/review', { method: 'POST', body: JSON.stringify({ bookingId, rating, comment }) }),
  reportDispute: (bookingId: string, reason: string, description: string) => request<{ success: boolean; dispute: DisputeReport }>('/api/feedback/dispute', { method: 'POST', body: JSON.stringify({ bookingId, reason, description }) }),

  // Admin (Protected - Super Admin Only)
  getAdminMetrics: () => request<{ metrics: PlatformMetrics }>('/api/admin/metrics'),
  getAdminUsers: () => request<{ users: User[] }>('/api/admin/users'),
  setUserStatus: (id: string, isSuspended: boolean, reason?: string) => request<{ success: boolean; user: User }>(`/api/admin/users/${id}/status`, { method: 'POST', body: JSON.stringify({ isSuspended, reason }) }),
  getAdminApplications: () => request<{ applications: InterviewerApplication[] }>('/api/admin/interviewer-applications'),
  evaluateApplication: (id: string, data: any) => request<{ success: boolean; application: InterviewerApplication }>(`/api/admin/interviewer-applications/${id}/evaluate`, { method: 'POST', body: JSON.stringify(data) }),
  updateTier: (code: string, data: any) => request<{ success: boolean; tier: Tier }>(`/api/admin/tiers/${code}`, { method: 'POST', body: JSON.stringify(data) }),
  saveRound: (data: any) => request<{ success: boolean; round: RoundTemplate }>('/api/admin/rounds', { method: 'POST', body: JSON.stringify(data) }),
  getLedger: () => request<{ ledger: LedgerEntry[] }>('/api/admin/ledger'),
  getRefunds: () => request<{ refunds: Refund[] }>('/api/admin/refunds'),
  actionRefund: (id: string, action: 'APPROVE' | 'REJECT', adminNotes?: string) => request<{ success: boolean; refund: Refund }>(`/api/admin/refunds/${id}/action`, { method: 'POST', body: JSON.stringify({ action, adminNotes }) }),
  getDisputes: () => request<{ disputes: DisputeReport[] }>('/api/admin/disputes'),
  resolveDispute: (id: string, resolution: string, adminNotes?: string) => request<{ success: boolean; dispute: DisputeReport }>(`/api/admin/disputes/${id}/resolve`, { method: 'POST', body: JSON.stringify({ resolution, adminNotes }) }),
  getAdminInterviewerWarnings: () => request<{ interviewers: any[] }>('/api/admin/interviewer-warnings'),
  clearInterviewerWarnings: (id: string) => request<{ success: boolean; message: string }>(`/api/admin/interviewers/${id}/clear-warnings`, { method: 'POST' }),
  toggleBlockInterviewer: (id: string, isBlocked: boolean, reason?: string) => request<{ success: boolean; message: string }>(`/api/admin/interviewers/${id}/toggle-block`, { method: 'POST', body: JSON.stringify({ isBlocked, reason }) }),
  getAuditLogs: () => request<{ logs: AdminAuditLog[] }>('/api/admin/audit-logs'),
  getSettings: () => request<{ settings: AppSettings }>('/api/admin/settings'),
  updateSettings: (data: any) => request<{ success: boolean; settings: AppSettings }>('/api/admin/settings', { method: 'POST', body: JSON.stringify(data) }),

  // Notifications (Protected)
  getNotifications: () => request<{ notifications: NotificationItem[] }>('/api/notifications'),
  markNotificationRead: (id: string) => request<{ success: boolean }>(`/api/notifications/${id}/read`, { method: 'POST' }),
  markAllNotificationsRead: () => request<{ success: boolean }>('/api/notifications/read-all', { method: 'POST' }),
};
