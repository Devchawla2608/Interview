-- ====================================================================
-- Interview Arena Database Schema (PostgreSQL)
-- Migration 0001: Initial Schema, Foreign Keys, Indexes, & Initial Seeds
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enums
CREATE TYPE user_role_enum AS ENUM ('CANDIDATE', 'INTERVIEWER', 'ADMIN');
CREATE TYPE tier_code_enum AS ENUM ('TIER_A', 'TIER_B', 'TIER_C');
CREATE TYPE interviewer_status_enum AS ENUM (
  'DRAFT', 'SUBMITTED', 'SCREENING_REQUIRED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED'
);
CREATE TYPE booking_status_enum AS ENUM (
  'AWAITING_PAYMENT', 'PAID', 'QUEUED', 'CLAIMED', 'SCHEDULED', 'READY',
  'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'REFUND_PENDING', 'REFUNDED',
  'NO_SHOW_CANDIDATE', 'NO_SHOW_INTERVIEWER', 'DISPUTED'
);
CREATE TYPE payment_status_enum AS ENUM ('CREATED', 'CAPTURED', 'FAILED', 'REFUNDED');
CREATE TYPE ledger_type_enum AS ENUM (
  'PAYMENT_RECEIVED', 'PLATFORM_COMMISSION', 'INTERVIEWER_CREDIT',
  'REFUND_DEBIT', 'PAYOUT_DEBIT', 'ADMIN_ADJUSTMENT'
);

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  avatar_url TEXT,
  roles user_role_enum[] NOT NULL DEFAULT ARRAY['CANDIDATE'::user_role_enum],
  active_role user_role_enum NOT NULL DEFAULT 'CANDIDATE',
  is_suspended BOOLEAN NOT NULL DEFAULT FALSE,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

-- Candidate Profiles
CREATE TABLE candidate_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  target_roles TEXT[] NOT NULL DEFAULT '{}',
  experience_level VARCHAR(50) NOT NULL DEFAULT 'STUDENT',
  graduation_year INT,
  college_or_employer VARCHAR(200),
  bio TEXT,
  preferred_languages TEXT[] NOT NULL DEFAULT '{"Python", "JavaScript", "Java"}',
  timezone VARCHAR(100) NOT NULL DEFAULT 'Asia/Kolkata',
  total_sessions INT NOT NULL DEFAULT 0,
  total_spent NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Interviewer Profiles
CREATE TABLE interviewer_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  headline VARCHAR(255) NOT NULL,
  bio TEXT,
  experience_years INT NOT NULL DEFAULT 1,
  college_or_employer VARCHAR(200) NOT NULL,
  current_company VARCHAR(150),
  current_role VARCHAR(150),
  skills TEXT[] NOT NULL DEFAULT '{}',
  preferred_tiers tier_code_enum[] NOT NULL DEFAULT '{"TIER_A", "TIER_B", "TIER_C"}',
  languages TEXT[] NOT NULL DEFAULT '{"English", "Hindi"}',
  status interviewer_status_enum NOT NULL DEFAULT 'DRAFT',
  is_available BOOLEAN NOT NULL DEFAULT FALSE,
  rating_avg NUMERIC(3, 2) NOT NULL DEFAULT 5.00,
  rating_count INT NOT NULL DEFAULT 0,
  total_completed_sessions INT NOT NULL DEFAULT 0,
  bank_account_mask VARCHAR(50),
  upi_id VARCHAR(100),
  reviewer_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_interviewer_status ON interviewer_profiles(status);
CREATE INDEX idx_interviewer_available ON interviewer_profiles(is_available);

-- Interviewer Applications
CREATE TABLE interviewer_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status interviewer_status_enum NOT NULL DEFAULT 'SUBMITTED',
  resume_url TEXT,
  screening1_status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  screening1_score INT,
  screening1_notes TEXT,
  screening2_status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  screening2_score INT,
  screening2_notes TEXT,
  admin_notes TEXT,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tiers
CREATE TABLE tiers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code tier_code_enum NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  badge VARCHAR(50) NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  description TEXT NOT NULL,
  commission_percent NUMERIC(5, 2) NOT NULL DEFAULT 20.00,
  default_round_count INT NOT NULL DEFAULT 3,
  display_order INT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Company Preparation Tracks
CREATE TABLE company_tracks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tier_code tier_code_enum NOT NULL REFERENCES tiers(code),
  name VARCHAR(150) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  badge VARCHAR(50) NOT NULL,
  recommended_rounds INT NOT NULL DEFAULT 4,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Round Templates
CREATE TABLE round_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tier_code tier_code_enum NOT NULL REFERENCES tiers(code),
  track_id UUID REFERENCES company_tracks(id) ON DELETE SET NULL,
  round_number INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT NOT NULL,
  duration_mins INT NOT NULL DEFAULT 45,
  price NUMERIC(10, 2) NOT NULL,
  difficulty VARCHAR(50) NOT NULL DEFAULT 'MEDIUM',
  topics TEXT[] NOT NULL DEFAULT '{}',
  rubric_criteria TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Interviewer Availability
CREATE TABLE interviewer_availability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  interviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time VARCHAR(10) NOT NULL,
  end_time VARCHAR(10) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bookings
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_ref VARCHAR(30) NOT NULL UNIQUE,
  candidate_id UUID NOT NULL REFERENCES users(id),
  interviewer_id UUID REFERENCES users(id),
  tier_code tier_code_enum NOT NULL REFERENCES tiers(code),
  track_name VARCHAR(150) NOT NULL,
  round_name VARCHAR(150) NOT NULL,
  round_number INT NOT NULL,
  round_duration_mins INT NOT NULL DEFAULT 45,
  booking_type VARCHAR(20) NOT NULL DEFAULT 'QUEUE',
  status booking_status_enum NOT NULL DEFAULT 'AWAITING_PAYMENT',
  scheduled_at TIMESTAMPTZ,
  preferred_language VARCHAR(50) NOT NULL DEFAULT 'English',
  job_role VARCHAR(100) NOT NULL DEFAULT 'Software Engineer',
  price NUMERIC(10, 2) NOT NULL,
  platform_fee NUMERIC(10, 2) NOT NULL,
  total_amount NUMERIC(10, 2) NOT NULL,
  interviewer_earnings NUMERIC(10, 2) NOT NULL,
  payment_status VARCHAR(50) NOT NULL DEFAULT 'UNPAID',
  meeting_url TEXT,
  meeting_provider VARCHAR(50) NOT NULL DEFAULT 'DEV_FALLBACK_SANDBOX',
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bookings_candidate ON bookings(candidate_id);
CREATE INDEX idx_bookings_interviewer ON bookings(interviewer_id);
CREATE INDEX idx_bookings_status ON bookings(status);

-- Real-time Queue Entries
CREATE TABLE queue_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES users(id),
  tier_code tier_code_enum NOT NULL REFERENCES tiers(code),
  track_name VARCHAR(150) NOT NULL,
  round_name VARCHAR(150) NOT NULL,
  round_number INT NOT NULL,
  job_role VARCHAR(100) NOT NULL,
  duration_mins INT NOT NULL DEFAULT 45,
  preferred_language VARCHAR(50) NOT NULL DEFAULT 'English',
  expected_compensation NUMERIC(10, 2) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'WAITING',
  entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  timeout_at TIMESTAMPTZ NOT NULL,
  claimed_by UUID REFERENCES users(id),
  claimed_at TIMESTAMPTZ
);

CREATE INDEX idx_queue_status ON queue_entries(status);
CREATE INDEX idx_queue_timeout ON queue_entries(timeout_at);

-- Payment Orders
CREATE TABLE payment_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_ref VARCHAR(50) NOT NULL UNIQUE,
  booking_id UUID NOT NULL REFERENCES bookings(id),
  user_id UUID NOT NULL REFERENCES users(id),
  amount NUMERIC(10, 2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  status payment_status_enum NOT NULL DEFAULT 'CREATED',
  provider VARCHAR(50) NOT NULL DEFAULT 'RAZORPAY_TEST',
  provider_order_id VARCHAR(150) NOT NULL,
  provider_payment_id VARCHAR(150),
  signature VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Refunds
CREATE TABLE refunds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  refund_ref VARCHAR(50) NOT NULL UNIQUE,
  booking_id UUID NOT NULL REFERENCES bookings(id),
  amount NUMERIC(10, 2) NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  initiated_by UUID NOT NULL REFERENCES users(id),
  admin_notes TEXT,
  provider_refund_id VARCHAR(150),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Immutable Accounting Ledger
CREATE TABLE ledger_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID REFERENCES bookings(id),
  user_id UUID REFERENCES users(id),
  type ledger_type_enum NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  balance_after NUMERIC(12, 2) NOT NULL,
  description TEXT NOT NULL,
  reference_id VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ledger_booking ON ledger_entries(booking_id);
CREATE INDEX idx_ledger_user ON ledger_entries(user_id);
CREATE INDEX idx_ledger_type ON ledger_entries(type);

-- Interview Feedback
CREATE TABLE interview_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  interviewer_id UUID NOT NULL REFERENCES users(id),
  candidate_id UUID NOT NULL REFERENCES users(id),
  criteria_scores JSONB NOT NULL,
  overall_score NUMERIC(3, 1) NOT NULL,
  strengths TEXT NOT NULL,
  improvement_areas TEXT NOT NULL,
  recommended_topics TEXT[] NOT NULL DEFAULT '{}',
  recommended_next_round VARCHAR(150) NOT NULL,
  practice_readiness VARCHAR(50) NOT NULL DEFAULT 'DEVELOPING',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Candidate Reviews
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES users(id),
  interviewer_id UUID NOT NULL REFERENCES users(id),
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Disputes & Reports
CREATE TABLE disputes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id),
  raised_by_user_id UUID NOT NULL REFERENCES users(id),
  raised_by_role user_role_enum NOT NULL,
  reason VARCHAR(150) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'OPEN',
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(150) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'INFO',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Admin Audit Logs
CREATE TABLE admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(100) NOT NULL,
  target_id VARCHAR(100) NOT NULL,
  details TEXT,
  ip_address VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- App Settings
CREATE TABLE app_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  commission_percent NUMERIC(5, 2) NOT NULL DEFAULT 20.00,
  queue_timeout_minutes INT NOT NULL DEFAULT 15,
  claim_timeout_minutes INT NOT NULL DEFAULT 5,
  auto_refund_on_timeout BOOLEAN NOT NULL DEFAULT TRUE,
  platform_notice TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ====================================================================
-- Initial Seed Data
-- ====================================================================

INSERT INTO tiers (code, name, badge, price, description, commission_percent, default_round_count, display_order)
VALUES
('TIER_A', 'Tier A — Top-tier Preparation', 'FAANG / Tier-1', 100.00, 'Top-tier tech company preparation (Google, Meta, Amazon, Microsoft, Uber, etc.). Rigorous coding, advanced algorithmic problem solving, system design, and leadership principles.', 20.00, 5, 1),
('TIER_B', 'Tier B — Established Company Preparation', 'Established Tech', 80.00, 'Established high-growth and mid-market tech companies. Practical coding, data structures, databases, OOP, role-specific engineering, and behavioral evaluation.', 20.00, 3, 2),
('TIER_C', 'Tier C — Entry-Level & Fundamentals', 'Fundamentals', 60.00, 'Campus placements, entry-level roles, and service companies. Solid fundamentals in algorithms, SQL, OOP, debugging, and HR/behavioral readiness.', 20.00, 2, 3);

INSERT INTO app_settings (id, commission_percent, queue_timeout_minutes, claim_timeout_minutes, auto_refund_on_timeout)
VALUES (1, 20.00, 15, 5, TRUE);
