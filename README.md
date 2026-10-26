# Interview Arena — Complete Full-Stack Web Application

**Interview Arena** is a complete, production-grade mock interview marketplace and live practice platform. Job seekers and students can book and practice live technical interviews with vetted peers and industry professionals across Tier A (₹100), Tier B (₹80), and Tier C (₹60) company preparation pathways.

---

## 1. Quick Start

### Prerequisites
- Node.js 20+
- npm

### Installation & Run
```bash
# 1. Install dependencies
npm install

# 2. Run automated tests (Unit, Concurrency, and E2E)
npm test

# 3. Start development server
npm run dev
```

The application will start on **http://localhost:3000** with hot reloading and full-stack Express API routes active.

---

## 2. Authentication & Admin Account

The platform uses real JWT authentication with PBKDF2 password hashing and strict Role-Based Access Control (RBAC):

| Role | Email | Password | Access Details |
|------|-------|----------|----------------|
| **Super Admin** | `deepanshu.chawla2608@gmail.com` | `RamRam2608@` | Full system control: Admin Control Center, Live Metrics, User Management, Interviewer Approvals, Financial Ledger, and Perspective Switching. |
| **New Candidate** | Any email (via "Create Account") | Set by user | Access to Practice Tracks, Candidate Arena, Live WebRTC Workspace, and Booking Queue. |
| **New Interviewer** | Register with "Interviewer" role | Set by user | Access to Interviewer Application, Claim Queue, Sessions, and Earnings once approved. |

> Unauthenticated visitors can only view the public track catalog. Protected dashboards and session claim queues are strictly guarded.

---

## 3. Core Features Implemented

1. **Tier-Based Preparation Tracks & Configurable Rounds**:
   - **Tier A (₹100)**: Top-tier tech preparation (Google, Meta, Amazon, Microsoft, Uber). 5 rounds covering OA screening, non-linear algorithms, advanced DP, distributed system design, and behavioral leadership.
   - **Tier B (₹80)**: Established high-growth and FinTech tracks. 3 rounds covering CS fundamentals, SQL schemas, framework architecture, and past project deep-dives.
   - **Tier C (₹60)**: Campus placement and junior engineering tracks. 2 rounds covering OOP fundamentals, basic loops, and HR readiness.
2. **Atomic Queue & Matchmaking Engine**:
   - Real-time FIFO queue with Server-Sent Events (SSE) streaming at `/api/queue/stream`.
   - **Row-level mutex lock**: guarantees that when two interviewers click "Accept & Claim" simultaneously, exactly one transaction succeeds. The second receives an explicit HTTP 409 conflict.
   - Overlap prevention: interviewers cannot claim overlapping sessions.
   - Automatic 15-minute queue timeout with automatic 100% full refund.
3. **Deep UPI Payment Integration**:
   - Scannable dynamic UPI QR code generated with standard `upi://pay?pa=...` parameters.
   - 1-click launch for GPay, PhonePe, Paytm, and BHIM.
   - Direct UPI ID / VPA collect requests and 12-digit UTR confirmation.
   - Immutable append-only ledger tracking `PAYMENT_RECEIVED`, `PLATFORM_COMMISSION` (20%), `INTERVIEWER_CREDIT` (80%), `REFUND_DEBIT`, and `PAYOUT_DEBIT`.
   - Interviewer payout withdrawal directly to registered UPI ID with instant simulated verification.
4. **In-House Video Meeting Solution (Arena Meet)**:
   - Embedded real-time video conference with zero 3rd-party external redirects.
   - Dual participant video streams with camera on/off, microphone mute/unmute, and screen sharing.
   - In-call instant text messaging between candidate and interviewer.
   - Integrated live code runner with syntax highlighting and instant execution output!
5. **MongoDB Database Architecture**:
   - Integrated MongoDB client in `src/db/mongodb.ts` with collection indexes and schema definitions.
   - High-availability docker composition with `mongo:7.0` and Mongo Express management UI.
   - Automatic dev fallback to transactional store when standalone.
6. **Light & Dark Theme Switcher**:
   - 1-click Sun/Moon toggle in navigation bar with persistent theme memory.
   - Crisp, high-contrast light theme with dedicated cards and typography.
4. **Interviewer 2-Stage Screening Process**:
   - "Become an Interviewer" application pipeline.
   - Requires completion of Screening Interview 1 (Coding) and Screening Interview 2 (Behavioral Rubric).
   - Admin evaluation dashboard to record scores and grant approval.
5. **Session Workspace & Post-Interview Rubrics**:
   - Dedicated meeting workspace with live video connectivity.
   - Live countdown timer with Start, Pause, and Reset.
   - Interview execution checklist.
   - Private interviewer evaluation scratchpad.
   - Shared problem and code scratchpad.
   - Multi-criteria structured feedback rubric: Problem Understanding, Optimal Complexity, Code Cleanliness, Edge Cases, and Communication.
   - Candidate 1–5 star rating and review.
   - Problem / Dispute reporting mechanism.
6. **Super Admin Dashboard (Mandatory)**:
   - Database-backed live metrics (Gross Volume, Platform Revenue, Interviewer Liabilities, Timeouts).
   - User management with suspension and audit logs.
   - Tier price configuration (edit Tier A ₹100, Tier B ₹80, Tier C ₹60).
   - Round curriculum management.
   - Live queue and booking monitor with manual overrides.
   - Refund approval/rejection with automatic ledger balance debit.
   - Dispute resolution.
   - System settings and integration health status.

---

## 4. Integration Setup

### Payment Gateway (Razorpay)
1. Sign up at [dashboard.razorpay.com](https://dashboard.razorpay.com).
2. Go to **Settings -> API Keys** and generate Test Keys.
3. Copy `Key Id` and `Key Secret` to `.env`:
   ```bash
   RAZORPAY_KEY_ID="rzp_test_..."
   RAZORPAY_KEY_SECRET="your_secret_here"
   ```
4. Configure Webhooks pointing to `https://<YOUR_APP_URL>/api/payments/webhook`.

### Google Calendar & Meet Integration
1. Open [Google Cloud Console](https://console.cloud.google.com).
2. Create or select a project and enable the **Google Calendar API**.
3. Create OAuth 2.0 Credentials (Web Application) and add your redirect URI:
   `https://<YOUR_APP_URL>/api/auth/google/callback`
4. Set credentials in `.env`:
   ```bash
   GOOGLE_CLIENT_ID="your_google_client_id.apps.googleusercontent.com"
   GOOGLE_CLIENT_SECRET="your_google_client_secret"
   ```
5. *Note: If Google Meet credentials are not set, Interview Arena cleanly falls back to an encrypted real-time video sandbox with transparent UI labeling.*

---

## 5. Docker & Production Deployment

To run with PostgreSQL using Docker Compose:
```bash
docker-compose up --build
```
This automatically boots PostgreSQL 16 on port 5432, executes `migrations/0001_initial_schema.sql`, builds the production frontend, and starts the containerized service on port 3000.

---

## 6. Automated Testing

Run the test suite with:
```bash
npm test
```
The test suite validates:
- Tier pricing and 20% platform commission calculation
- Append-only ledger accounting rules
- Concurrency and atomic queue claim locks (rejection of duplicate acceptance)
- Qualification checks (unapproved applicants cannot claim paid sessions)
- End-to-end booking -> payment -> matching -> feedback -> financial reconciliation
