import {
  User,
  CandidateProfile,
  InterviewerProfile,
  InterviewerApplication,
  Tier,
  CompanyTrack,
  RoundTemplate,
  Booking,
  QueueEntry,
  InterviewerAvailabilitySlot,
  PaymentOrder,
  Refund,
  LedgerEntry,
  InterviewerEarnings,
  PayoutRecord,
  InterviewFeedback,
  CandidateReview,
  DisputeReport,
  NotificationItem,
  AdminAuditLog,
  AppSettings,
  PlatformMetrics,
  TierCode,
} from '../types';
import { hashPassword } from './auth';
import {
  mongoSaveUser,
  mongoSaveCandidateProfile,
  mongoSaveInterviewerProfile,
  mongoSaveBooking,
  mongoSaveQueueEntry,
  mongoSaveFeedback,
  mongoSaveReview,
  mongoSaveLedgerEntry,
  mongoLoadAll,
} from '../db/mongodb';

class MemoryStore {
  users: Map<string, User> = new Map();
  userCredentials: Map<string, { hash: string; salt: string }> = new Map();
  candidateProfiles: Map<string, CandidateProfile> = new Map();
  interviewerProfiles: Map<string, InterviewerProfile> = new Map();
  interviewerApplications: Map<string, InterviewerApplication> = new Map();
  tiers: Map<string, Tier> = new Map();
  companyTracks: Map<string, CompanyTrack> = new Map();
  roundTemplates: Map<string, RoundTemplate> = new Map();
  bookings: Map<string, Booking> = new Map();
  queueEntries: Map<string, QueueEntry> = new Map();
  availability: Map<string, InterviewerAvailabilitySlot> = new Map();
  paymentOrders: Map<string, PaymentOrder> = new Map();
  refunds: Map<string, Refund> = new Map();
  ledger: LedgerEntry[] = [];
  earnings: Map<string, InterviewerEarnings> = new Map();
  feedback: Map<string, InterviewFeedback> = new Map();
  reviews: Map<string, CandidateReview> = new Map();
  disputes: Map<string, DisputeReport> = new Map();
  notifications: NotificationItem[] = [];
  auditLogs: AdminAuditLog[] = [];
  settings: AppSettings;

  // Lock for atomic operations (e.g. claim queue)
  private claimLocks: Set<string> = new Set();

  // Event listeners for SSE
  private listeners: Set<(event: { type: string; data: unknown }) => void> = new Set();

  constructor() {
    this.settings = {
      commissionPercent: 20,
      queueTimeoutMinutes: 15,
      claimTimeoutMinutes: 5,
      autoRefundOnTimeout: true,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_arena_demo',
      razorpayKeySecretConfigured: Boolean(process.env.RAZORPAY_KEY_SECRET),
      inHouseMeetingEnabled: true,
      emailConfigured: Boolean(process.env.RESEND_API_KEY || process.env.EMAIL_API_KEY),
      platformNotice:
        'Practice interviews are educational simulations conducted by approved peers or industry professionals. Not affiliated with or endorsed by referenced companies.',
    };

    this.seedCatalog();
    this.seedUsers();
    // Zero dummy mock bookings: production SaaS starts with a clean slate!
  }

  // Load existing data from MongoDB on startup
  async syncFromMongoDB(): Promise<void> {
    try {
      const data = await mongoLoadAll();
      if (!data) return;

      if (data.users && data.users.length > 0) {
        for (const u of data.users) {
          this.users.set(u.id, u);
          if (u.passwordHash && u.salt) {
            this.userCredentials.set(u.id, { hash: u.passwordHash, salt: u.salt });
          }
        }
      }
      if (data.candidateProfiles) {
        for (const cp of data.candidateProfiles) {
          this.candidateProfiles.set(cp.userId, cp);
        }
      }
      if (data.interviewerProfiles) {
        for (const ip of data.interviewerProfiles) {
          this.interviewerProfiles.set(ip.userId, ip);
        }
      }
      if (data.bookings) {
        for (const b of data.bookings) {
          this.bookings.set(b.id, b);
        }
      }
      if (data.queueEntries) {
        for (const q of data.queueEntries) {
          this.queueEntries.set(q.bookingId, q);
        }
      }
      if (data.feedback) {
        for (const f of data.feedback) {
          this.feedback.set(f.bookingId, f);
        }
      }
      if (data.reviews) {
        for (const r of data.reviews) {
          this.reviews.set(r.bookingId, r);
        }
      }
      if (data.ledger && data.ledger.length > 0) {
        this.ledger = data.ledger;
      }
      console.log(`[Interview Arena] Successfully synced ${this.users.size} users and ${this.bookings.size} bookings from MongoDB.`);
    } catch (err) {
      console.error('[Interview Arena] MongoDB sync error:', err);
    }
  }

  // SSE Broadcaster
  subscribe(fn: (event: { type: string; data: unknown }) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  broadcast(type: string, data: unknown) {
    for (const listener of this.listeners) {
      try {
        listener({ type, data });
      } catch (err) {
        console.error('SSE broadcast error:', err);
      }
    }
  }

  addNotification(userId: string, title: string, message: string, type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ALERT' = 'INFO', link?: string) {
    const item: NotificationItem = {
      id: 'notif_' + Math.random().toString(36).substring(2, 9),
      userId,
      title,
      message,
      type,
      isRead: false,
      link,
      createdAt: new Date().toISOString(),
    };
    this.notifications.unshift(item);
    this.broadcast('NEW_NOTIFICATION', { userId, notification: item });
    return item;
  }

  logAudit(
    adminId: string,
    adminEmail: string,
    action: string,
    targetType: string,
    targetId: string,
    details: string,
    ipAddress: string = '127.0.0.1'
  ): AdminAuditLog {
    const log: AdminAuditLog = {
      id: 'audit_' + Math.random().toString(36).substring(2, 9),
      adminId,
      adminEmail,
      action,
      targetType,
      targetId,
      details,
      ipAddress,
      createdAt: new Date().toISOString(),
    };
    this.auditLogs.unshift(log);
    return log;
  }

  addLedgerEntry(entry: Omit<LedgerEntry, 'id' | 'createdAt' | 'balanceAfter'>): LedgerEntry {
    const prevBalance = this.ledger.length > 0 ? this.ledger[0].balanceAfter : 0;
    const newBalance = prevBalance + entry.amount;
    const item: LedgerEntry = {
      ...entry,
      id: 'ledg_' + Math.random().toString(36).substring(2, 9),
      balanceAfter: newBalance,
      createdAt: new Date().toISOString(),
    };
    this.ledger.unshift(item);
    mongoSaveLedgerEntry(item);
    return item;
  }

  // Atomic queue claim using row-level locking simulation
  async claimQueueEntryAtomic(bookingId: string, interviewerUserId: string): Promise<{ success: boolean; message: string; booking?: Booking }> {
    if (this.claimLocks.has(bookingId)) {
      return { success: false, message: 'This interview request is currently being claimed by another interviewer.' };
    }

    this.claimLocks.add(bookingId);
    try {
      const booking = this.bookings.get(bookingId);
      if (!booking) {
        return { success: false, message: 'Booking not found.' };
      }

      if (booking.status !== 'QUEUED') {
        return {
          success: false,
          message: `Cannot claim: session is already ${booking.status.toLowerCase().replace('_', ' ')}.`,
        };
      }

      const interviewer = this.users.get(interviewerUserId);
      if (!interviewer) {
        return { success: false, message: 'Interviewer user not found.' };
      }

      const interviewerProf = this.interviewerProfiles.get(interviewerUserId);
      if (!interviewerProf || interviewerProf.status !== 'APPROVED') {
        return { success: false, message: 'Only approved interviewers can accept paid sessions.' };
      }

      // Check qualifications
      if (!interviewerProf.preferredTiers.includes(booking.tierCode)) {
        return { success: false, message: `You are not qualified or registered for ${booking.tierCode}.` };
      }

      // Check overlapping active sessions
      const hasActive = Array.from(this.bookings.values()).some(
        (b) =>
          b.interviewerId === interviewerUserId &&
          ['CLAIMED', 'IN_PROGRESS', 'READY'].includes(b.status) &&
          b.id !== bookingId
      );
      if (hasActive) {
        return { success: false, message: 'You already have an active claimed interview in progress. Complete it first.' };
      }

      // Update Booking
      booking.interviewerId = interviewerUserId;
      booking.interviewerName = interviewer.fullName;
      booking.status = 'CLAIMED';
      booking.updatedAt = new Date().toISOString();

      // Meeting provisioning: 100% In-house WebRTC meeting room
      booking.meetingProvider = 'IN_HOUSE_MEET';
      booking.meetingUrl = `/workspace/${booking.id}`;

      // Update Queue Entry
      const queueEntry = this.queueEntries.get(bookingId);
      if (queueEntry) {
        queueEntry.status = 'CLAIMED';
        queueEntry.claimedBy = interviewerUserId;
        queueEntry.claimedAt = new Date().toISOString();
        mongoSaveQueueEntry(queueEntry);
      }

      mongoSaveBooking(booking);

      // Notifications
      this.addNotification(
        booking.candidateId,
        'Interviewer Assigned!',
        `Your ${booking.trackName} (${booking.roundName}) session was accepted by ${interviewer.fullName}. Meeting workspace is ready.`,
        'SUCCESS',
        `/workspace/${booking.id}`
      );
      this.addNotification(
        interviewerUserId,
        'Session Claimed Successfully',
        `You have been assigned to interview ${booking.candidateName} for ${booking.trackName}. Meeting link has been generated.`,
        'SUCCESS',
        `/workspace/${booking.id}`
      );

      this.broadcast('BOOKING_CLAIMED', { bookingId, interviewerId: interviewerUserId });
      this.broadcast('QUEUE_UPDATED', Array.from(this.queueEntries.values()));

      return { success: true, message: 'Interview session claimed successfully!', booking };
    } finally {
      this.claimLocks.delete(bookingId);
    }
  }

  // Live platform metrics
  getPlatformMetrics(): PlatformMetrics {
    const bookingsList = Array.from(this.bookings.values());
    const completed = bookingsList.filter((b) => b.status === 'COMPLETED');
    const waiting = Array.from(this.queueEntries.values()).filter((q) => q.status === 'WAITING');
    const timeouts = Array.from(this.queueEntries.values()).filter((q) => q.status === 'TIMEOUT');
    const noShows = bookingsList.filter((b) => b.status === 'NO_SHOW_CANDIDATE' || b.status === 'NO_SHOW_INTERVIEWER');

    const grossVolume = bookingsList
      .filter((b) => b.paymentStatus === 'PAID')
      .reduce((sum, b) => sum + b.totalAmount, 0);

    const commissionRevenue = bookingsList
      .filter((b) => b.status === 'COMPLETED')
      .reduce((sum, b) => sum + b.platformFee, 0);

    const interviewerLiabilities = bookingsList
      .filter((b) => b.status === 'COMPLETED')
      .reduce((sum, b) => sum + b.interviewerEarnings, 0);

    const totalRefunds = Array.from(this.refunds.values())
      .filter((r) => r.status === 'PROCESSED')
      .reduce((sum, r) => sum + r.amount, 0);

    const allReviews = Array.from(this.reviews.values());
    const avgRating = allReviews.length > 0
      ? Number((allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length).toFixed(1))
      : 5.0;

    const approvedCount = Array.from(this.interviewerProfiles.values()).filter((p) => p.status === 'APPROVED').length;

    return {
      totalUsers: this.users.size,
      candidateCount: Array.from(this.users.values()).filter((u) => u.roles.includes('CANDIDATE')).length,
      interviewerCount: Array.from(this.users.values()).filter((u) => u.roles.includes('INTERVIEWER')).length,
      approvedInterviewersCount: approvedCount,
      totalBookings: bookingsList.length,
      completedSessions: completed.length,
      activeQueueCount: waiting.length,
      grossPaymentVolume: grossVolume,
      platformCommissionRevenue: commissionRevenue,
      interviewerLiabilities,
      totalRefunds,
      averageRating: avgRating,
      timeoutRate: bookingsList.length > 0 ? Number(((timeouts.length / bookingsList.length) * 100).toFixed(1)) : 0,
      noShowRate: bookingsList.length > 0 ? Number(((noShows.length / bookingsList.length) * 100).toFixed(1)) : 0,
    };
  }

  private seedCatalog() {
    // Tiers
    const tierA: Tier = {
      id: 'tier_a',
      code: 'TIER_A',
      name: 'Tier A — Top-Tier Tech Preparation',
      badge: 'FAANG / Top-Tier',
      price: 100,
      description:
        'Rigorous mock interview track modeled on hiring bars of Google, Meta, Amazon, Microsoft, Uber, and Netflix. Deep technical rigor, algorithmic optimization, edge-case probing, and structured design.',
      commissionPercent: 20,
      defaultRoundCount: 5,
      order: 1,
      isActive: true,
    };

    const tierB: Tier = {
      id: 'tier_b',
      code: 'TIER_B',
      name: 'Tier B — Established Tech Preparation',
      badge: 'Established Companies',
      price: 80,
      description:
        'Targeted preparation for established tech leaders, high-growth startups, and mid-market firms. Practical data structures, database queries, framework architecture, and real-world system engineering.',
      commissionPercent: 20,
      defaultRoundCount: 3,
      order: 2,
      isActive: true,
    };

    const tierC: Tier = {
      id: 'tier_c',
      code: 'TIER_C',
      name: 'Tier C — Entry-Level & Fundamentals',
      badge: 'Foundations & Campus',
      price: 60,
      description:
        'Focused on campus recruitment, junior engineer roles, and service tech companies. Strong foundation in OOP, SQL, basic algorithmic patterns, clean coding, and behavioral confidence.',
      commissionPercent: 20,
      defaultRoundCount: 2,
      order: 3,
      isActive: true,
    };

    this.tiers.set('TIER_A', tierA);
    this.tiers.set('TIER_B', tierB);
    this.tiers.set('TIER_C', tierC);

    // Company Tracks
    const tracks: CompanyTrack[] = [
      // Tier A
      { id: 'track_google', tierCode: 'TIER_A', name: 'Google Track', slug: 'google-track', badge: 'Tier A', description: 'Algorithmic efficiency, graph theory, distributed system thinking, and Googleyness.', recommendedRounds: 5, isActive: true },
      { id: 'track_meta', tierCode: 'TIER_A', name: 'Meta Track', slug: 'meta-track', badge: 'Tier A', description: 'Fast-paced algorithmic coding, live debugging, product architecture, and behavioral impact.', recommendedRounds: 4, isActive: true },
      { id: 'track_amazon', tierCode: 'TIER_A', name: 'Amazon Track', slug: 'amazon-track', badge: 'Tier A', description: 'Coding & system design grounded strictly in Amazon Leadership Principles (Customer Obsession, Ownership).', recommendedRounds: 4, isActive: true },
      { id: 'track_microsoft', tierCode: 'TIER_A', name: 'Microsoft Track', slug: 'microsoft-track', badge: 'Tier A', description: 'Strong computer science foundations, tree/graph algorithms, scalable cloud architecture, and growth mindset.', recommendedRounds: 4, isActive: true },
      { id: 'track_uber', tierCode: 'TIER_A', name: 'Uber Track', slug: 'uber-track', badge: 'Tier A', description: 'Real-time spatial data structures, concurrency, low-latency API design, and trade-offs under scale.', recommendedRounds: 4, isActive: true },

      // Tier B
      { id: 'track_swiggy_zomato', tierCode: 'TIER_B', name: 'High-Growth Tech Track', slug: 'high-growth-tech', badge: 'Tier B', description: 'Full-stack problem solving, event-driven architecture, caching strategies, and REST API design.', recommendedRounds: 3, isActive: true },
      { id: 'track_fintech', tierCode: 'TIER_B', name: 'FinTech Engineering Track', slug: 'fintech-engineering', badge: 'Tier B', description: 'ACID transactions, idempotency, distributed locks, database indexing, and secure design.', recommendedRounds: 3, isActive: true },
      { id: 'track_saas', tierCode: 'TIER_B', name: 'Enterprise SaaS Track', slug: 'enterprise-saas', badge: 'Tier B', description: 'Multi-tenant architecture, backend concurrency, observability, and clean OOP abstractions.', recommendedRounds: 3, isActive: true },

      // Tier C
      { id: 'track_campus', tierCode: 'TIER_C', name: 'Campus Placement Track', slug: 'campus-placement', badge: 'Tier C', description: 'Core CS subjects: Data Structures, OOP (Java/C++), OS memory management, and SQL normalization.', recommendedRounds: 2, isActive: true },
      { id: 'track_service', tierCode: 'TIER_C', name: 'Services & IT Firms Track', slug: 'services-it-firms', badge: 'Tier C', description: 'Aptitude-aligned coding, practical debugging, relational schemas, and HR/communication round.', recommendedRounds: 2, isActive: true },
    ];

    for (const t of tracks) {
      this.companyTracks.set(t.id, t);
    }

    // Round Templates
    const roundDefs: RoundTemplate[] = [
      // Tier A Rounds
      {
        id: 'round_a_1',
        tierCode: 'TIER_A',
        roundNumber: 1,
        name: 'Round 1: Online Assessment / Algorithmic Screen',
        description: 'Time-constrained coding covering arrays, two-pointers, hash tables, and binary search.',
        durationMins: 45,
        price: 100,
        difficulty: 'MEDIUM',
        topics: ['Arrays & Strings', 'Sliding Window', 'Binary Search', 'Time & Space Complexity'],
        rubricCriteria: ['Problem Understanding', 'Approach & Optimal Time Complexity', 'Code Correctness', 'Edge Cases Handling'],
        isActive: true,
      },
      {
        id: 'round_a_2',
        tierCode: 'TIER_A',
        roundNumber: 2,
        name: 'Round 2: Technical Coding Interview',
        description: 'In-depth coding on non-linear data structures: trees, graphs, DFS/BFS, and heaps.',
        durationMins: 60,
        price: 100,
        difficulty: 'HARD',
        topics: ['Binary Trees & BST', 'Graph Traversals (DFS/BFS)', 'Topological Sort', 'Priority Queues'],
        rubricCriteria: ['Clarifying Questions', 'Data Structure Selection', 'Algorithmic Optimization', 'Clean Modular Code', 'Dry Run & Testing'],
        isActive: true,
      },
      {
        id: 'round_a_3',
        tierCode: 'TIER_A',
        roundNumber: 3,
        name: 'Round 3: Advanced Technical & Dynamic Programming',
        description: 'Hard-level algorithmic challenges: DP memoization/tabulation, Trie, and complex recursion.',
        durationMins: 60,
        price: 100,
        difficulty: 'HARD',
        topics: ['Dynamic Programming', 'State Transitions', 'Backtracking', 'Bit Manipulation'],
        rubricCriteria: ['Mathematical Intuition', 'Subproblem Formulation', 'Space Optimization', 'Resilience under pressure'],
        isActive: true,
      },
      {
        id: 'round_a_4',
        tierCode: 'TIER_A',
        roundNumber: 4,
        name: 'Round 4: Scalable System Design',
        description: 'Architecting high-scale distributed systems: load balancers, caching, sharding, and fault tolerance.',
        durationMins: 60,
        price: 100,
        difficulty: 'EXPERT',
        topics: ['High-Level Architecture', 'Database Sharding & Caching (Redis)', 'Message Queues (Kafka)', 'CAP Theorem & Trade-offs'],
        rubricCriteria: ['Requirement Scoping & Math Calculations', 'Component Architecture', 'Bottleneck Identification', 'Data Consistency Models'],
        isActive: true,
      },
      {
        id: 'round_a_5',
        tierCode: 'TIER_A',
        roundNumber: 5,
        name: 'Round 5: Executive Behavioral & Leadership Principles',
        description: 'Deep dive into past project failures, technical disagreements, ownership, and engineering values.',
        durationMins: 45,
        price: 100,
        difficulty: 'HARD',
        topics: ['STAR Method', 'Conflict Resolution', 'Ambiguity Handling', 'Innovation & Mentorship'],
        rubricCriteria: ['Actionable STAR Response', 'Humility & Self-Reflection', 'Leadership Impact', 'Culture Fit'],
        isActive: true,
      },

      // Tier B Rounds
      {
        id: 'round_b_1',
        tierCode: 'TIER_B',
        roundNumber: 1,
        name: 'Round 1: Practical Problem Solving & Data Structures',
        description: 'Hands-on problem solving focused on practical algorithms, hash maps, queues, and string manipulation.',
        durationMins: 45,
        price: 80,
        difficulty: 'MEDIUM',
        topics: ['Stack & Queue Applications', 'Hash Maps', 'Sorting Algorithms', 'String Parsing'],
        rubricCriteria: ['Code Structure & Readability', 'Efficiency', 'Test Case Generation', 'Communication'],
        isActive: true,
      },
      {
        id: 'round_b_2',
        tierCode: 'TIER_B',
        roundNumber: 2,
        name: 'Round 2: API Architecture & Backend System Engineering',
        description: 'Building microservices: schema design, REST/gRPC contracts, indexing, and connection pools.',
        durationMins: 60,
        price: 80,
        difficulty: 'HARD',
        topics: ['RESTful Standards', 'Database Indexing (B-Tree/Hash)', 'Caching Patterns', 'Authentication (JWT/OAuth)'],
        rubricCriteria: ['API Ergonomics', 'Database Modeling', 'Failure Handling', 'Scalability Awareness'],
        isActive: true,
      },
      {
        id: 'round_b_3',
        tierCode: 'TIER_B',
        roundNumber: 3,
        name: 'Round 3: Behavioral & Project Experience Deep Dive',
        description: 'Walkthrough of past production projects, architecture choices, trade-offs, and team collaboration.',
        durationMins: 45,
        price: 80,
        difficulty: 'MEDIUM',
        topics: ['Production Incident Handling', 'Tech Stack Selection', 'Code Review Habits', 'Cross-functional Collaboration'],
        rubricCriteria: ['Articulating Past Architecture', 'Ownership of Deliverables', 'Constructive Communication', 'Technical Depth'],
        isActive: true,
      },

      // Tier C Rounds
      {
        id: 'round_c_1',
        tierCode: 'TIER_C',
        roundNumber: 1,
        name: 'Round 1: Fundamentals & Basic Algorithmic Coding',
        description: 'Foundational programming in language of choice, basic data structures, and logical reasoning.',
        durationMins: 45,
        price: 60,
        difficulty: 'ENTRY',
        topics: ['String Manipulation', 'Loops & Recursion', 'Basic Array Search & Sorting', 'OOP Basics'],
        rubricCriteria: ['Syntax & Language Fundamentals', 'Logical Thinking', 'Basic Testing', 'Receptiveness to Hints'],
        isActive: true,
      },
      {
        id: 'round_c_2',
        tierCode: 'TIER_C',
        roundNumber: 2,
        name: 'Round 2: Practical Technical & Project Discussion',
        description: 'Review of academic or capstone projects, small live debugging exercise, and simple SQL queries.',
        durationMins: 45,
        price: 60,
        difficulty: 'ENTRY',
        topics: ['College Project Overview', 'SQL Select & Aggregation', 'Debugging Simple Code', 'Web Basics (HTTP)'],
        rubricCriteria: ['Clarity on College Project', 'SQL Basics', 'Code Explanation', 'Curiosity to Learn'],
        isActive: true,
      },
      {
        id: 'round_c_3',
        tierCode: 'TIER_C',
        roundNumber: 3,
        name: 'Round 3: HR & Behavioral Readiness',
        description: 'Introduction, career goals, strengths/weaknesses, teamwork scenarios, and interview etiquette.',
        durationMins: 30,
        price: 60,
        difficulty: 'ENTRY',
        topics: ['Self Introduction', 'Career Aspirations', 'Handling Pressure', 'Communication Skills'],
        rubricCriteria: ['Confidence & Articulation', 'Preparation Level', 'Positive Attitude', 'Professionalism'],
        isActive: true,
      },
    ];

    for (const r of roundDefs) {
      this.roundTemplates.set(r.id, r);
    }
  }

  private seedUsers() {
    // Bootstrap Super-Administrator: deepanshu.chawla2608@gmail.com
    const adminId = 'usr_superadmin';
    const superAdminUser: User = {
      id: adminId,
      email: 'deepanshu.chawla2608@gmail.com',
      fullName: 'Deepanshu Chawla',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
      roles: ['ADMIN', 'INTERVIEWER', 'CANDIDATE'],
      activeRole: 'ADMIN',
      isSuspended: false,
      emailVerified: true,
      createdAt: new Date().toISOString(),
    };

    const adminCandProfile: CandidateProfile = {
      id: 'prof_cand_' + adminId,
      userId: adminId,
      targetRoles: ['Full-Stack Engineer', 'Engineering Lead'],
      experienceLevel: '5+_YEARS',
      preferredLanguages: ['TypeScript', 'Python', 'Go'],
      timezone: 'Asia/Kolkata',
      totalSessions: 0,
      totalSpent: 0,
    };

    const adminInterviewerProfile: InterviewerProfile = {
      id: 'prof_int_' + adminId,
      userId: adminId,
      headline: 'Super Administrator & Lead Technical Evaluator',
      bio: 'Platform Owner & Technical Evaluator.',
      experienceYears: 6,
      collegeOrEmployer: 'Interview Arena Leadership',
      currentCompany: 'Interview Arena',
      currentRole: 'Lead Architect',
      skills: ['System Design', 'Algorithms', 'Full Stack', 'Cloud Architecture'],
      preferredTiers: ['TIER_A', 'TIER_B', 'TIER_C'],
      languages: ['English', 'Hindi'],
      status: 'APPROVED',
      isAvailable: true,
      ratingAvg: 5.0,
      ratingCount: 1,
      totalCompletedSessions: 0,
      bankAccountMask: 'ICICI •••• 2608',
      upiId: process.env.UPI_MERCHANT_VPA || 'dev.chawla2608-3@okicici',
      reviewerNotes: 'Super Administrator Account.',
    };

    superAdminUser.candidateProfile = adminCandProfile;
    superAdminUser.interviewerProfile = adminInterviewerProfile;

    this.users.set(adminId, superAdminUser);
    this.candidateProfiles.set(adminId, adminCandProfile);
    this.interviewerProfiles.set(adminId, adminInterviewerProfile);

    // Initial password hash from JWT_SECRET or default
    const initialPassword = process.env.JWT_SECRET || 'RamRam2608@';
    const { salt, hash } = hashPassword(initialPassword);
    this.userCredentials.set(adminId, { hash, salt });

    // Sync to MongoDB asynchronously if connected
    mongoSaveUser({ ...superAdminUser, passwordHash: hash, salt });
    mongoSaveCandidateProfile(adminCandProfile);
    mongoSaveInterviewerProfile(adminInterviewerProfile);
  }

  // Helper method for automated testing suite fixtures
  seedTestFixtures() {
    if (!this.users.has('usr_interviewer_1')) {
      const interviewerUser: User = {
        id: 'usr_interviewer_1',
        email: 'sarah.lead@interviewer.com',
        fullName: 'Sarah Chen',
        roles: ['INTERVIEWER', 'CANDIDATE'],
        activeRole: 'INTERVIEWER',
        isSuspended: false,
        emailVerified: true,
        createdAt: new Date().toISOString(),
      };
      const interviewerProfile: InterviewerProfile = {
        id: 'prof_usr_interviewer_1',
        userId: 'usr_interviewer_1',
        headline: 'Senior Staff Engineer',
        bio: 'Ex-Google SDE',
        experienceYears: 7,
        collegeOrEmployer: 'Stanford University',
        currentCompany: 'Cloud Tech',
        currentRole: 'Senior Staff Engineer',
        skills: ['Data Structures', 'System Design'],
        preferredTiers: ['TIER_A', 'TIER_B', 'TIER_C'],
        languages: ['English'],
        status: 'APPROVED',
        isAvailable: true,
        ratingAvg: 4.9,
        ratingCount: 28,
        totalCompletedSessions: 28,
      };
      this.users.set('usr_interviewer_1', interviewerUser);
      this.interviewerProfiles.set('usr_interviewer_1', interviewerProfile);
    }

    if (!this.users.has('usr_applicant_1')) {
      const applicantUser: User = {
        id: 'usr_applicant_1',
        email: 'alex.morgan@applied.com',
        fullName: 'Alex Morgan',
        roles: ['CANDIDATE'],
        activeRole: 'CANDIDATE',
        isSuspended: false,
        emailVerified: true,
        createdAt: new Date().toISOString(),
      };
      const applicantProfile: InterviewerProfile = {
        id: 'prof_usr_applicant_1',
        userId: 'usr_applicant_1',
        headline: 'Software Engineer',
        bio: 'Applying interviewer',
        experienceYears: 3,
        collegeOrEmployer: 'FinTech Solutions',
        skills: ['Java', 'Spring Boot'],
        preferredTiers: ['TIER_A', 'TIER_B'],
        languages: ['English'],
        status: 'SCREENING_REQUIRED',
        isAvailable: false,
        ratingAvg: 0,
        ratingCount: 0,
        totalCompletedSessions: 0,
      };
      this.users.set('usr_applicant_1', applicantUser);
      this.interviewerProfiles.set('usr_applicant_1', applicantProfile);
    }
  }
}

export const store = new MemoryStore();
