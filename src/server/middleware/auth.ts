import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../auth';
import { store } from '../store';
import { User, UserRole } from '../../types';

export interface AuthenticatedRequest extends Request {
  user?: User | null;
  userId?: string;
}

// Global or route-level token reader
export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token && req.headers['x-auth-token']) {
    token = req.headers['x-auth-token'] as string;
  }

  if (!token) {
    req.user = null;
    req.userId = undefined;
    return next();
  }

  const payload = verifyToken(token);
  if (!payload) {
    req.user = null;
    req.userId = undefined;
    return next();
  }

  const user = store.users.get(payload.userId);
  if (!user || user.isSuspended) {
    req.user = null;
    req.userId = undefined;
    return next();
  }

  req.user = user;
  req.userId = user.id;
  next();
}

// Strict requirement: User must be signed in
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required. Please log in to continue.' });
  }
  next();
}

// Strict requirement: User must have at least one of the specified roles
export function requireRole(...roles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required. Please log in.' });
    }

    const hasRole = roles.some((r) => req.user!.roles.includes(r));
    if (!hasRole) {
      return res.status(403).json({
        error: `Forbidden: This action requires one of the following roles: ${roles.join(', ')}.`,
      });
    }

    next();
  };
}

// Helper shortcuts
export const requireAdmin = requireRole('ADMIN');
export const requireInterviewer = requireRole('INTERVIEWER', 'ADMIN');
