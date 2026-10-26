import { Router } from 'express';
import { store } from '../store';
import { UserRole, User, CandidateProfile, InterviewerProfile } from '../../types';
import { hashPassword, verifyPassword, signToken, SUPER_ADMIN_EMAIL } from '../auth';
import { authenticateToken, requireAuth, AuthenticatedRequest } from '../middleware/auth';
import {
  mongoSaveUser,
  mongoSaveCandidateProfile,
  mongoSaveInterviewerProfile,
} from '../../db/mongodb';

export const authRouter = Router();

// Get current session user
authRouter.get('/me', authenticateToken, (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const candidateProfile = store.candidateProfiles.get(req.user.id);
  const interviewerProfile = store.interviewerProfiles.get(req.user.id);

  return res.json({
    user: {
      ...req.user,
      candidateProfile,
      interviewerProfile,
    },
  });
});

// Register new account
authRouter.post('/register', async (req, res) => {
  try {
    const { email, password, fullName, role = 'CANDIDATE' } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'A valid email address is required.' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }
    if (!fullName || fullName.trim().length === 0) {
      return res.status(400).json({ error: 'Full name is required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if user already exists
    const existing = Array.from(store.users.values()).find(
      (u) => u.email.toLowerCase() === normalizedEmail
    );
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists. Please sign in.' });
    }

    // Role assignment: super admin always gets all roles
    let assignedRoles: UserRole[] = ['CANDIDATE'];
    let defaultActiveRole: UserRole = 'CANDIDATE';

    if (normalizedEmail === SUPER_ADMIN_EMAIL.toLowerCase()) {
      assignedRoles = ['ADMIN', 'INTERVIEWER', 'CANDIDATE'];
      defaultActiveRole = 'ADMIN';
    } else if (role === 'INTERVIEWER') {
      assignedRoles = ['INTERVIEWER', 'CANDIDATE'];
      defaultActiveRole = 'INTERVIEWER';
    }

    const newId = 'usr_' + Math.random().toString(36).substring(2, 10);
    const { salt, hash } = hashPassword(password);

    const newUser: User = {
      id: newId,
      email: normalizedEmail,
      fullName: fullName.trim(),
      roles: assignedRoles,
      activeRole: defaultActiveRole,
      isSuspended: false,
      emailVerified: true,
      createdAt: new Date().toISOString(),
    };

    store.users.set(newId, newUser);
    store.userCredentials.set(newId, { salt, hash });

    // Create Candidate Profile
    const candProfile: CandidateProfile = {
      id: 'prof_cand_' + newId,
      userId: newId,
      targetRoles: ['Software Engineer'],
      experienceLevel: 'FRESHER',
      preferredLanguages: ['Python', 'JavaScript'],
      timezone: 'Asia/Kolkata',
      totalSessions: 0,
      totalSpent: 0,
    };
    store.candidateProfiles.set(newId, candProfile);
    newUser.candidateProfile = candProfile;

    // Create Interviewer Profile if applicable
    if (assignedRoles.includes('INTERVIEWER')) {
      const intProfile: InterviewerProfile = {
        id: 'prof_int_' + newId,
        userId: newId,
        headline: normalizedEmail === SUPER_ADMIN_EMAIL.toLowerCase() ? 'Super Administrator & Lead Evaluator' : 'Technical Interviewer',
        bio: '',
        experienceYears: 2,
        collegeOrEmployer: '',
        skills: ['Data Structures', 'System Design'],
        preferredTiers: ['TIER_A', 'TIER_B', 'TIER_C'],
        languages: ['English'],
        status: normalizedEmail === SUPER_ADMIN_EMAIL.toLowerCase() ? 'APPROVED' : 'SCREENING_REQUIRED',
        isAvailable: normalizedEmail === SUPER_ADMIN_EMAIL.toLowerCase(),
        ratingAvg: 5.0,
        ratingCount: 0,
        totalCompletedSessions: 0,
      };
      store.interviewerProfiles.set(newId, intProfile);
      newUser.interviewerProfile = intProfile;
      mongoSaveInterviewerProfile(intProfile);
    }

    // Persist to MongoDB
    mongoSaveUser({ ...newUser, passwordHash: hash, salt });
    mongoSaveCandidateProfile(candProfile);

    // Welcome notification
    store.addNotification(
      newId,
      'Welcome to Interview Arena!',
      'Your account is ready. Explore Tier A, B, and C practice tracks to supercharge your interview preparation.',
      'SUCCESS'
    );

    const token = signToken(newUser);

    return res.status(201).json({
      success: true,
      token,
      user: newUser,
    });
  } catch (err: any) {
    console.error('Registration error:', err);
    return res.status(500).json({ error: 'Internal server error during registration.' });
  }
});

// Login
authRouter.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = Array.from(store.users.values()).find(
      (u) => u.email.toLowerCase() === normalizedEmail
    );

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (user.isSuspended) {
      return res.status(403).json({ error: 'Account suspended. Please contact platform administrator.' });
    }

    const credentials = store.userCredentials.get(user.id);
    if (!credentials) {
      // If bootstrapped admin and matching default password
      if (normalizedEmail === SUPER_ADMIN_EMAIL.toLowerCase()) {
        const initialPassword = process.env.JWT_SECRET || 'RamRam2608@';
        if (password === initialPassword) {
          const { salt, hash } = hashPassword(password);
          store.userCredentials.set(user.id, { salt, hash });
        } else {
          return res.status(401).json({ error: 'Invalid email or password.' });
        }
      } else {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }
    } else {
      const isValid = verifyPassword(password, credentials.hash, credentials.salt);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }
    }

    user.candidateProfile = store.candidateProfiles.get(user.id);
    user.interviewerProfile = store.interviewerProfiles.get(user.id);

    const token = signToken(user);

    return res.json({
      success: true,
      token,
      user,
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error during login.' });
  }
});

// Switch active role (for users with multiple roles)
authRouter.post('/switch-role', authenticateToken, requireAuth, (req: AuthenticatedRequest, res) => {
  const { role } = req.body as { role: UserRole };
  const user = req.user!;

  if (!user.roles.includes(role)) {
    return res.status(403).json({ error: `You do not have the ${role} role.` });
  }

  user.activeRole = role;
  const token = signToken(user);

  return res.json({ success: true, token, user });
});

// Update Profile
authRouter.post('/profile', authenticateToken, requireAuth, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const { fullName, bio, targetRoles, experienceLevel, preferredLanguages, graduationYear, collegeOrEmployer } = req.body;

  if (fullName) user.fullName = fullName;

  let candProfile = store.candidateProfiles.get(user.id);
  if (!candProfile) {
    candProfile = {
      id: 'prof_' + user.id,
      userId: user.id,
      targetRoles: targetRoles || ['Software Engineer'],
      experienceLevel: experienceLevel || 'STUDENT',
      preferredLanguages: preferredLanguages || ['Python'],
      timezone: 'Asia/Kolkata',
      totalSessions: 0,
      totalSpent: 0,
    };
  }

  if (bio !== undefined) candProfile.bio = bio;
  if (targetRoles) candProfile.targetRoles = targetRoles;
  if (experienceLevel) candProfile.experienceLevel = experienceLevel;
  if (preferredLanguages) candProfile.preferredLanguages = preferredLanguages;
  if (graduationYear) candProfile.graduationYear = Number(graduationYear);
  if (collegeOrEmployer) candProfile.collegeOrEmployer = collegeOrEmployer;

  store.candidateProfiles.set(user.id, candProfile);
  user.candidateProfile = candProfile;

  mongoSaveUser(user);
  mongoSaveCandidateProfile(candProfile);

  return res.json({ success: true, user, candidateProfile: candProfile });
});

// Logout
authRouter.post('/logout', (req, res) => {
  return res.json({ success: true, message: 'Logged out successfully.' });
});
