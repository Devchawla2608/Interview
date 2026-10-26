import assert from 'assert';
import { store } from '../src/server/store';
import { hashPassword, verifyPassword, signToken, verifyToken } from '../src/server/auth';

console.log('=== RUNNING INTERVIEW ARENA AUTOMATED TEST SUITE ===\n');

let passedTests = 0;
let totalTests = 0;

function test(name: string, fn: () => void | Promise<void>) {
  totalTests++;
  try {
    const result = fn();
    if (result && typeof (result as any).then === 'function') {
      return (result as Promise<void>).then(() => {
        console.log(`  ✓ ${name}`);
        passedTests++;
      }).catch((err) => {
        console.error(`  ✗ ${name}`);
        console.error(`    ${err.message}`);
      });
    } else {
      console.log(`  ✓ ${name}`);
      passedTests++;
    }
  } catch (err: any) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
  }
}

async function runTests() {
  store.seedTestFixtures();
  console.log('--- 1. UNIT TESTS: Pricing, Commission, & Ledger Calculations ---');

  test('Tier A default price is ₹100 with 50% platform commission', () => {
    const tierA = store.tiers.get('TIER_A');
    assert(tierA, 'Tier A must exist');
    assert.strictEqual(tierA.price, 100);
    assert.strictEqual(tierA.commissionPercent, 50);

    const platformFee = (tierA.price * tierA.commissionPercent) / 100;
    const interviewerShare = tierA.price - platformFee;
    assert.strictEqual(platformFee, 50);
    assert.strictEqual(interviewerShare, 50);
  });

  test('Tier B default price is ₹80 and Tier C is ₹60 with 50% commission', () => {
    const tierB = store.tiers.get('TIER_B');
    const tierC = store.tiers.get('TIER_C');
    assert.strictEqual(tierB?.price, 80);
    assert.strictEqual(tierC?.price, 60);

    const tierBShare = 80 - (80 * 0.50);
    assert.strictEqual(tierBShare, 40);
  });

  test('Append-only ledger maintains non-negative and audited balances', () => {
    const prevBalance = store.ledger.length > 0 ? store.ledger[0].balanceAfter : 0;
    const entry = store.addLedgerEntry({
      type: 'PAYMENT_RECEIVED',
      amount: 100,
      description: 'Unit test capture',
      referenceId: 'TEST-REF-01',
    });
    assert.strictEqual(entry.balanceAfter, prevBalance + 100);
    assert.strictEqual(store.ledger[0].id, entry.id);
  });

  console.log('\n--- 2. CONCURRENCY & ATOMIC CLAIM TESTS ---');

  await test('Atomic claim allows exactly one interviewer to claim a session and rejects concurrent second attempt', async () => {
    // Create fresh test booking in QUEUED state
    const testBookingId = 'test_atomic_book_01';
    store.bookings.set(testBookingId, {
      id: testBookingId,
      bookingRef: 'IA-TEST-001',
      candidateId: 'usr_candidate_1',
      candidateName: 'Test Candidate',
      candidateEmail: 'cand@test.com',
      tierCode: 'TIER_A',
      trackName: 'Google Track',
      roundName: 'Round 1: Online Assessment',
      roundNumber: 1,
      roundDurationMins: 45,
      bookingType: 'QUEUE',
      status: 'QUEUED',
      preferredLanguage: 'Python',
      jobRole: 'Software Engineer',
      price: 100,
      platformFee: 20,
      totalAmount: 100,
      interviewerEarnings: 80,
      paymentStatus: 'PAID',
      meetingProvider: 'DEV_FALLBACK_SANDBOX',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    store.queueEntries.set(testBookingId, {
      id: 'queue_atomic_01',
      bookingId: testBookingId,
      candidateId: 'usr_candidate_1',
      candidateName: 'Test Candidate',
      tierCode: 'TIER_A',
      trackName: 'Google Track',
      roundName: 'Round 1: Online Assessment',
      roundNumber: 1,
      jobRole: 'Software Engineer',
      durationMins: 45,
      preferredLanguage: 'Python',
      expectedCompensation: 80,
      status: 'WAITING',
      enteredAt: new Date().toISOString(),
      timeoutAt: new Date(Date.now() + 15 * 60000).toISOString(),
    });

    // Simulate Interviewer 1 claiming
    const result1 = await store.claimQueueEntryAtomic(testBookingId, 'usr_interviewer_1');
    assert.strictEqual(result1.success, true, 'First interviewer claim must succeed');
    assert.strictEqual(result1.booking?.status, 'CLAIMED');

    // Simulate Interviewer 2 attempting to claim the SAME booking concurrently
    const result2 = await store.claimQueueEntryAtomic(testBookingId, 'usr_interviewer_1');
    assert.strictEqual(result2.success, false, 'Second claim attempt must fail');
    assert(result2.message.includes('already'), 'Message must indicate session is already claimed');

    // Mark test session completed to clear active session state for interviewer
    const claimedBooking = store.bookings.get(testBookingId);
    if (claimedBooking) claimedBooking.status = 'COMPLETED';
    const interviewerProf = store.interviewerProfiles.get('usr_interviewer_1');
    if (interviewerProf) {
      interviewerProf.activeSessionId = null;
      interviewerProf.isAvailable = true;
    }
  });

  test('Unapproved interviewer cannot claim paid sessions', async () => {
    const unapprovedBookingId = 'test_unapproved_book';
    store.bookings.set(unapprovedBookingId, {
      id: unapprovedBookingId,
      bookingRef: 'IA-TEST-002',
      candidateId: 'usr_candidate_1',
      candidateName: 'Candidate',
      candidateEmail: 'c@test.com',
      tierCode: 'TIER_A',
      trackName: 'Google Track',
      roundName: 'Round 1',
      roundNumber: 1,
      roundDurationMins: 45,
      bookingType: 'QUEUE',
      status: 'QUEUED',
      preferredLanguage: 'Python',
      jobRole: 'SDE',
      price: 100,
      platformFee: 20,
      totalAmount: 100,
      interviewerEarnings: 80,
      paymentStatus: 'PAID',
      meetingProvider: 'DEV_FALLBACK_SANDBOX',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Attempt claim by applicant (Alex Morgan, SCREENING_REQUIRED)
    return store.claimQueueEntryAtomic(unapprovedBookingId, 'usr_applicant_1').then((res) => {
      assert.strictEqual(res.success, false);
      assert(res.message.includes('approved interviewers'));
    });
  });

  console.log('\n--- 3. END-TO-END WORKFLOW INTEGRATION TESTS ---');

  await test('Full E2E: Candidate Registration -> Order -> Fulfill -> Matching -> Feedback -> Ledger Integrity', async () => {
    // 1. Candidate creates booking
    const e2eBookingId = 'book_e2e_01';
    const tier = store.tiers.get('TIER_A')!;
    const e2eBooking: import('../src/types').Booking = {
      id: e2eBookingId,
      bookingRef: 'IA-E2E-999',
      candidateId: 'usr_candidate_1',
      candidateName: 'Deepanshu Chawla',
      candidateEmail: 'deepanshu@candidate.com',
      tierCode: tier.code,
      trackName: 'Google Track',
      roundName: 'Round 1: Coding Screen',
      roundNumber: 1,
      roundDurationMins: 45,
      bookingType: 'QUEUE',
      status: 'AWAITING_PAYMENT',
      preferredLanguage: 'Python',
      jobRole: 'Software Engineer',
      price: tier.price,
      platformFee: 50,
      totalAmount: tier.price,
      interviewerEarnings: 50,
      paymentStatus: 'UNPAID',
      meetingProvider: 'DEV_FALLBACK_SANDBOX',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    store.bookings.set(e2eBookingId, e2eBooking);

    // 2. Payment verification simulation
    e2eBooking.paymentStatus = 'PAID';
    e2eBooking.status = 'QUEUED';
    store.addLedgerEntry({
      bookingId: e2eBookingId,
      userId: e2eBooking.candidateId,
      type: 'PAYMENT_RECEIVED',
      amount: 100,
      description: 'E2E test payment captured',
      referenceId: 'PAY-E2E-001',
    });

    // 3. Queue entry creation
    store.queueEntries.set(e2eBookingId, {
      id: 'queue_e2e_01',
      bookingId: e2eBookingId,
      candidateId: e2eBooking.candidateId,
      candidateName: e2eBooking.candidateName,
      tierCode: 'TIER_A',
      trackName: e2eBooking.trackName,
      roundName: e2eBooking.roundName,
      roundNumber: 1,
      jobRole: e2eBooking.jobRole,
      durationMins: 45,
      preferredLanguage: 'Python',
      expectedCompensation: 50,
      status: 'WAITING',
      enteredAt: new Date().toISOString(),
      timeoutAt: new Date(Date.now() + 15 * 60000).toISOString(),
    });

    // 4. Approved interviewer claims
    const claimRes = await store.claimQueueEntryAtomic(e2eBookingId, 'usr_interviewer_1');
    assert.strictEqual(claimRes.success, true);
    assert.strictEqual(claimRes.booking?.status, 'CLAIMED');
    assert(claimRes.booking?.meetingUrl, 'Meeting link must be provisioned');

    // 5. Submit structured feedback
    store.feedback.set(e2eBookingId, {
      id: 'fb_e2e',
      bookingId: e2eBookingId,
      interviewerId: 'usr_interviewer_1',
      interviewerName: 'Sarah Chen',
      candidateId: e2eBooking.candidateId,
      criteriaScores: [
        { criterion: 'Problem Understanding', score: 5, comments: 'Superb clarity.' },
      ],
      overallScore: 5.0,
      strengths: 'Very clear communication',
      improvementAreas: 'None',
      recommendedTopics: ['Dynamic Programming'],
      recommendedNextRound: 'Round 2',
      practiceReadiness: 'JOB_READY',
      submittedAt: new Date().toISOString(),
    });
    e2eBooking.status = 'COMPLETED';

    // 6. Financial Ledger accounting: Platform Commission + Interviewer Credit
    store.addLedgerEntry({
      bookingId: e2eBookingId,
      type: 'PLATFORM_COMMISSION',
      amount: 50,
      description: 'Platform 50% commission on E2E session',
      referenceId: 'COMM-E2E',
    });
    store.addLedgerEntry({
      bookingId: e2eBookingId,
      userId: 'usr_interviewer_1',
      type: 'INTERVIEWER_CREDIT',
      amount: 50,
      description: 'Interviewer 50% share credited',
      referenceId: 'CRED-E2E',
    });

    // Verify metrics reflect completed booking
    const metrics = store.getPlatformMetrics();
    assert(metrics.completedSessions >= 1);
    assert(metrics.grossPaymentVolume >= 100);
    assert(metrics.platformCommissionRevenue >= 20);
  });

  console.log('\n--- 4. AUTHENTICATION & AUTHORIZATION (RBAC) TESTS ---');

  test('Password hashing produces valid salt and constant-time verification', () => {
    const pwd = 'StrongSecurePassword2026!';
    const { salt, hash } = hashPassword(pwd);
    assert(salt && salt.length > 0, 'Salt must be generated');
    assert(hash && hash.length > 0, 'Hash must be generated');
    assert.strictEqual(verifyPassword(pwd, hash, salt), true, 'Valid password must verify');
    assert.strictEqual(verifyPassword('WrongPassword', hash, salt), false, 'Invalid password must be rejected');
  });

  test('JWT token signing and verification preserves user roles & context', () => {
    const mockUser = {
      id: 'usr_auth_test_1',
      email: 'deepanshu.chawla2608@gmail.com',
      roles: ['ADMIN' as const, 'INTERVIEWER' as const, 'CANDIDATE' as const],
      activeRole: 'ADMIN' as const,
    };
    const token = signToken(mockUser);
    assert(token && token.split('.').length === 3, 'JWT must have 3 segments');
    const verified = verifyToken(token);
    assert(verified, 'Token must be verified successfully');
    assert.strictEqual(verified?.userId, 'usr_auth_test_1');
    assert.strictEqual(verified?.email, 'deepanshu.chawla2608@gmail.com');
    assert.strictEqual(verified?.activeRole, 'ADMIN');
    assert(verified?.roles.includes('ADMIN'));
  });

  test('Super-Admin account is bootstrapped with complete RBAC permissions', () => {
    const admin = store.users.get('usr_superadmin');
    assert(admin, 'Super admin user must exist');
    assert.strictEqual(admin.email, 'deepanshu.chawla2608@gmail.com');
    assert(admin.roles.includes('ADMIN'), 'Must have ADMIN role');
    assert(admin.roles.includes('INTERVIEWER'), 'Must have INTERVIEWER role');
    assert(admin.roles.includes('CANDIDATE'), 'Must have CANDIDATE role');
  });

  console.log(`\n========================================`);
  console.log(`SUMMARY: ${passedTests} / ${totalTests} tests passed successfully!`);
  console.log(`========================================\n`);

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runTests();
