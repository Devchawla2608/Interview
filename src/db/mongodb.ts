import { MongoClient, Db, Collection } from 'mongodb';
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
  LedgerEntry,
  PaymentOrder,
  Refund,
  InterviewFeedback,
  CandidateReview,
  DisputeReport,
  NotificationItem,
  AdminAuditLog,
  AppSettings,
} from '../types';

let client: MongoClient | null = null;
let db: Db | null = null;
let isConnected = false;

const MONGODB_URI = process.env.MONGODB_URI;

export async function connectMongoDB(): Promise<{ connected: boolean; message: string }> {
  try {
    if (client && isConnected) {
      return { connected: true, message: 'MongoDB already connected.' };
    }

    if (!MONGODB_URI) {
      console.log('[Interview Arena] No MONGODB_URI configured. Running in high-performance in-memory transactional store mode.');
      return { connected: false, message: 'No MONGODB_URI specified.' };
    }

    // Check if the URI is a template placeholder (e.g. contains <db_password>)
    if (MONGODB_URI.includes('<db_password>') || MONGODB_URI.includes('<password>')) {
      console.warn('[Interview Arena] Notice: MONGODB_URI in .env contains "<db_password>". Please provide your Atlas database password in .env to connect to your live MongoDB cloud cluster. Running in high-performance local store mode.');
      return { connected: false, message: 'MONGODB_URI contains placeholder <db_password>' };
    }

    client = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 3000,
      connectTimeoutMS: 3000,
    });

    await client.connect();
    db = client.db();
    isConnected = true;
    console.log('[Interview Arena] Connected to MongoDB database successfully.');

    // Initialize collections & indexes
    await setupIndexes();

    return { connected: true, message: 'Connected to MongoDB.' };
  } catch (err: any) {
    isConnected = false;
    console.warn(`[Interview Arena] MongoDB connection at ${MONGODB_URI} not active (${err.message}). Using high-performance in-memory transactional store.`);
    return { connected: false, message: err.message };
  }
}

export function isMongoDBConnected(): boolean {
  return isConnected;
}

export function getDatabase(): Db | null {
  return db;
}

// Collections
export function getCollection<T extends Document = any>(name: string): Collection<T> | null {
  if (!db || !isConnected) return null;
  return db.collection<T>(name);
}

async function setupIndexes() {
  if (!db) return;
  try {
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('bookings').createIndex({ bookingRef: 1 }, { unique: true });
    await db.collection('queue_entries').createIndex({ bookingId: 1 }, { unique: true });
    await db.collection('queue_entries').createIndex({ status: 1 });
    await db.collection('ledger').createIndex({ referenceId: 1 });
    await db.collection('tiers').createIndex({ code: 1 }, { unique: true });
    await db.collection('company_tracks').createIndex({ slug: 1 }, { unique: true });
  } catch (err) {
    console.error('Error creating MongoDB indexes:', err);
  }
}

// MongoDB Persistence Helpers
export async function mongoSaveUser(user: User & { passwordHash?: string; salt?: string }): Promise<void> {
  if (!db || !isConnected) return;
  try {
    await db.collection('users').updateOne(
      { id: user.id },
      { $set: user },
      { upsert: true }
    );
  } catch (err) {
    console.error('[MongoDB] Failed to save user:', err);
  }
}

export async function mongoSaveCandidateProfile(profile: CandidateProfile): Promise<void> {
  if (!db || !isConnected) return;
  try {
    await db.collection('candidate_profiles').updateOne(
      { userId: profile.userId },
      { $set: profile },
      { upsert: true }
    );
  } catch (err) {
    console.error('[MongoDB] Failed to save candidate profile:', err);
  }
}

export async function mongoSaveInterviewerProfile(profile: InterviewerProfile): Promise<void> {
  if (!db || !isConnected) return;
  try {
    await db.collection('interviewer_profiles').updateOne(
      { userId: profile.userId },
      { $set: profile },
      { upsert: true }
    );
  } catch (err) {
    console.error('[MongoDB] Failed to save interviewer profile:', err);
  }
}

export async function mongoSaveBooking(booking: Booking): Promise<void> {
  if (!db || !isConnected) return;
  try {
    await db.collection('bookings').updateOne(
      { id: booking.id },
      { $set: booking },
      { upsert: true }
    );
  } catch (err) {
    console.error('[MongoDB] Failed to save booking:', err);
  }
}

export async function mongoSaveQueueEntry(queueEntry: QueueEntry): Promise<void> {
  if (!db || !isConnected) return;
  try {
    await db.collection('queue_entries').updateOne(
      { bookingId: queueEntry.bookingId },
      { $set: queueEntry },
      { upsert: true }
    );
  } catch (err) {
    console.error('[MongoDB] Failed to save queue entry:', err);
  }
}

export async function mongoSaveFeedback(feedback: InterviewFeedback): Promise<void> {
  if (!db || !isConnected) return;
  try {
    await db.collection('feedback').updateOne(
      { bookingId: feedback.bookingId },
      { $set: feedback },
      { upsert: true }
    );
  } catch (err) {
    console.error('[MongoDB] Failed to save feedback:', err);
  }
}

export async function mongoSaveReview(review: CandidateReview): Promise<void> {
  if (!db || !isConnected) return;
  try {
    await db.collection('reviews').updateOne(
      { bookingId: review.bookingId },
      { $set: review },
      { upsert: true }
    );
  } catch (err) {
    console.error('[MongoDB] Failed to save review:', err);
  }
}

export async function mongoSaveLedgerEntry(entry: LedgerEntry): Promise<void> {
  if (!db || !isConnected) return;
  try {
    await db.collection('ledger').insertOne(entry as any);
  } catch (err) {
    console.error('[MongoDB] Failed to save ledger entry:', err);
  }
}

export async function mongoLoadAll(): Promise<{
  users: (User & { passwordHash?: string; salt?: string })[];
  candidateProfiles: CandidateProfile[];
  interviewerProfiles: InterviewerProfile[];
  bookings: Booking[];
  queueEntries: QueueEntry[];
  feedback: InterviewFeedback[];
  reviews: CandidateReview[];
  ledger: LedgerEntry[];
} | null> {
  if (!db || !isConnected) return null;
  try {
    const [
      users,
      candidateProfiles,
      interviewerProfiles,
      bookings,
      queueEntries,
      feedback,
      reviews,
      ledger,
    ] = await Promise.all([
      db.collection('users').find({}).toArray() as unknown as Promise<(User & { passwordHash?: string; salt?: string })[]>,
      db.collection('candidate_profiles').find({}).toArray() as unknown as Promise<CandidateProfile[]>,
      db.collection('interviewer_profiles').find({}).toArray() as unknown as Promise<InterviewerProfile[]>,
      db.collection('bookings').find({}).toArray() as unknown as Promise<Booking[]>,
      db.collection('queue_entries').find({}).toArray() as unknown as Promise<QueueEntry[]>,
      db.collection('feedback').find({}).toArray() as unknown as Promise<InterviewFeedback[]>,
      db.collection('reviews').find({}).toArray() as unknown as Promise<CandidateReview[]>,
      db.collection('ledger').find({}).toArray() as unknown as Promise<LedgerEntry[]>,
    ]);

    return {
      users,
      candidateProfiles,
      interviewerProfiles,
      bookings,
      queueEntries,
      feedback,
      reviews,
      ledger,
    };
  } catch (err) {
    console.error('[MongoDB] Failed to load data:', err);
    return null;
  }
}
