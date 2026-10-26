# Interview Arena — System Architecture

## 1. Overview & High-Level Design

**Interview Arena** is a full-stack platform providing paid simulated mock interviews for college students, freshers, and experienced job seekers.

The platform structures preparation into three tiers:
- **Tier A (₹100)**: Top-tier tech preparation (Google, Meta, Amazon, Microsoft, Uber, Netflix). 3–5 rounds from algorithmic coding to distributed system design.
- **Tier B (₹80)**: Established tech & unicorn companies. 2–3 rounds covering DSA, OOP, databases, and full-stack engineering.
- **Tier C (₹60)**: Campus placement and junior roles. 1–2 rounds covering fundamentals, debugging, and behavioral readiness.

---

## 2. Component Architecture

```
┌────────────────────────────────────────────────────────┐
│             React 19 + Tailwind CSS Frontend           │
│  - Candidate Arena (Catalog, Pathway Progress, Reports)│
│  - Interviewer Portal (Availability Radar, Payouts)    │
│  - Super Admin Dashboard (Metrics, Ledger, Approvals)  │
│  - Session Workspace (Meet, Timer, Rubrics, Notes)     │
└───────────────────────────┬────────────────────────────┘
                            │ REST / SSE (/api/queue/stream)
┌───────────────────────────▼────────────────────────────┐
│               Node.js Express Full-Stack Server        │
│  - Auth & Role Switching (Single Account, Multi-Role)  │
│  - Server-Validated Pricing (Never trusts client price)│
│  - Atomic Claiming Engine with Row-Level Mutex Lock    │
│  - Razorpay Test Gateway & Webhook Signature Verifier  │
│  - Append-Only Financial Accounting Ledger             │
│  - Provider-Agnostic Meeting Adapter                   │
└───────────────────────────┬────────────────────────────┘
                            │ SQL / Transactions
┌───────────────────────────▼────────────────────────────┐
│            PostgreSQL Database & Migration DDL         │
│  - 0001_initial_schema.sql (18 Relational Tables)      │
│  - Foreign Keys, Indexes, UUIDs, Triggers              │
└────────────────────────────────────────────────────────┘
```

---

## 3. Atomic Concurrency & Matchmaking Queue

The matchmaking queue guarantees **strict FIFO ordering** and **atomic single-assignment**:

1. **Candidate Booking Fulfillment**:
   - Once a payment is confirmed via webhook or signature verification, exactly **one** queue entry is created with status `WAITING` and a configurable timeout (default: 15 mins).
2. **Atomic Acceptance**:
   - When an approved interviewer clicks "Accept & Claim", the server acquires a row-level mutex lock on `bookingId`.
   - The transaction verifies that:
     1. The session is currently in `QUEUED` / `WAITING` status.
     2. The interviewer is `APPROVED`.
     3. The interviewer is qualified for the target tier (`TIER_A`, `TIER_B`, or `TIER_C`).
     4. The interviewer does not have another active overlapping session in `CLAIMED` or `IN_PROGRESS` state.
   - If two interviewers submit acceptance at the exact same millisecond, only the first transaction succeeds. The second receives an explicit HTTP 409 conflict message: *"This interview request is currently being claimed by another interviewer."*
3. **Queue Timeouts**:
   - A background sweep checks for waiting sessions past `timeoutAt`.
   - Unclaimed sessions are automatically cancelled and a 100% full refund is issued to the candidate.

---

## 4. Immutable Accounting Ledger

The platform treats financial consistency as mission-critical. Historical entries are never updated; all adjustments are recorded via append-only ledger entries:
- `PAYMENT_RECEIVED`: Credited when candidate payment is captured (e.g. +₹100).
- `PLATFORM_COMMISSION`: Platform revenue retained upon session completion (20%, e.g. +₹20).
- `INTERVIEWER_CREDIT`: Interviewer earnings credited upon rubric submission (80%, e.g. +₹80).
- `REFUND_DEBIT`: Debited when session is cancelled or timed out (-₹100).
- `PAYOUT_DEBIT`: Debited when interviewer withdraws available balance to UPI/Bank (-₹80).

---

## 5. Meeting Integration Strategy

- **Google Calendar API**: When `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are provided, the system creates calendar events with Google Meet conference data.
- **Development Fallback Sandbox**: When Google OAuth credentials are not provided in the environment, the platform clearly labels the fallback and provisions an encrypted sandbox room (`https://meet.jit.si/InterviewArena-<ref>`), ensuring the end-to-end user workflow can be immediately tested and used.
