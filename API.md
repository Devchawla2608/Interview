# Interview Arena — REST & Real-Time API Documentation

## Base URL
`/api`

All authenticated requests require `x-user-id` and optional `x-user-role` headers in the preview environment, or standard session cookies in production.

---

## 1. Authentication (`/api/auth`)

### `GET /api/auth/me`
Returns current user profile, roles, candidate profile, and interviewer profile.

### `POST /api/auth/login`
**Body:** `{ email: string }`
Authenticates a user account.

### `POST /api/auth/register`
**Body:** `{ email: string, fullName: string, role: 'CANDIDATE' | 'INTERVIEWER' }`
Registers a new user and sets up initial candidate profile.

### `POST /api/auth/switch-role`
**Body:** `{ role: 'CANDIDATE' | 'INTERVIEWER' | 'ADMIN' }`
Switches active role for the current account.

---

## 2. Catalog (`/api/catalog`)

### `GET /api/catalog`
Returns available Tiers (Tier A ₹100, Tier B ₹80, Tier C ₹60), company tracks (Google, Meta, Amazon, Microsoft, Uber, FinTech, High-Growth, Campus), and round templates with rubric criteria.

---

## 3. Bookings (`/api/bookings`)

### `GET /api/bookings`
Returns session bookings filtered by user role (Candidate, Interviewer, or Admin).

### `GET /api/bookings/:id`
Returns single booking record, rubric feedback, and candidate review.

### `POST /api/bookings/create`
**Body:**
```json
{
  "tierCode": "TIER_A",
  "trackName": "Google Track",
  "roundName": "Round 1: Coding Screen",
  "roundNumber": 1,
  "roundDurationMins": 45,
  "bookingType": "QUEUE",
  "preferredLanguage": "Python",
  "jobRole": "Full-Stack Engineer"
}
```
Validates price strictly on the server and generates a booking with `AWAITING_PAYMENT` status.

### `POST /api/bookings/:id/cancel`
**Body:** `{ "reason": "Candidate requested cancellation" }`
Cancels session and automatically initiates 100% full refund if paid.

---

## 4. Real-Time Queue (`/api/queue`)

### `GET /api/queue/stream` (Server-Sent Events)
Live event stream broadcasting `QUEUE_UPDATED`, `BOOKING_CLAIMED`, `MEETING_READY`, and `FEEDBACK_SUBMITTED` events.

### `GET /api/queue`
Returns eligible waiting queue requests for approved interviewers.

### `GET /api/queue/my`
Returns candidate's active queue status, position number, and estimated waiting time.

### `POST /api/queue/:bookingId/claim`
**Atomic claim endpoint**: Acquires row-level mutex lock, assigns the interviewer, provisions the meeting workspace, updates the booking to `CLAIMED`, and broadcasts event.

---

## 5. Payments (`/api/payments`)

### `POST /api/payments/create-order`
**Body:** `{ "bookingId": string }`
Creates Razorpay test order.

### `POST /api/payments/verify`
**Body:**
```json
{
  "bookingId": string,
  "orderRecordId": string,
  "razorpayPaymentId": string,
  "razorpayOrderId": string,
  "razorpaySignature": string
}
```
Verifies signature, updates booking to `PAID`, enters queue, and records in immutable ledger.

---

## 6. Interviewer & Screenings (`/api/interviewer`)

### `POST /api/interviewer/apply`
Submits application to become an interviewer.

### `POST /api/interviewer/toggle-availability`
Toggles online/offline availability for approved interviewers.

### `GET /api/interviewer/earnings`
Returns pending balance, available balance, paid balance, and payout transfer history.

### `POST /api/interviewer/request-payout`
**Body:** `{ "amount": number, "destination": string }`
Initiates payout transfer to UPI ID or bank account with ledger debit.

---

## 7. Feedback & Reviews (`/api/feedback`)

### `POST /api/feedback/submit`
**Body:**
```json
{
  "bookingId": string,
  "criteriaScores": [{ "criterion": string, "score": number, "comments": string }],
  "strengths": string,
  "improvementAreas": string,
  "recommendedTopics": string[],
  "recommendedNextRound": string,
  "practiceReadiness": "JOB_READY"
}
```
Submits structured rubric scores, marks session `COMPLETED`, credits interviewer earnings (80%), and credits platform commission (20%).

### `POST /api/feedback/review`
Candidate rates interviewer (1–5 stars) and submits public review.

---

## 8. Admin Management (`/api/admin`)

- `GET /api/admin/metrics`: Live database-backed platform metrics
- `GET /api/admin/users`: Search & filter users
- `POST /api/admin/users/:id/status`: Suspend or reactivate user accounts
- `GET /api/admin/interviewer-applications`: List screening applications
- `POST /api/admin/interviewer-applications/:id/evaluate`: Score screening 1 & 2, approve/reject
- `POST /api/admin/tiers/:code`: Update tier prices and commission rates
- `GET /api/admin/ledger`: Inspect complete append-only accounting ledger
- `GET /api/admin/refunds`: Review refund requests
- `POST /api/admin/refunds/:id/action`: Approve or reject refunds
- `GET /api/admin/disputes`: Review user dispute reports
- `POST /api/admin/disputes/:id/resolve`: Resolve dispute with refund or dismissal
- `GET /api/admin/audit-logs`: Full immutable audit trail
- `GET/POST /api/admin/settings`: Configure timeouts, commission %, and platform notices
