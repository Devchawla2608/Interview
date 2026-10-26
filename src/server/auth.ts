import crypto from 'crypto';
import { User, UserRole } from '../types';

export const SUPER_ADMIN_EMAIL = 'deepanshu.chawla2608@gmail.com';
const JWT_SECRET = process.env.JWT_SECRET || 'RamRam2608@';

export interface TokenPayload {
  userId: string;
  email: string;
  roles: UserRole[];
  activeRole: UserRole;
  iat: number;
  exp: number;
}

// Secure PBKDF2 Password Hashing
export function hashPassword(password: string): { salt: string; hash: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const computed = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    const hashBuffer = Buffer.from(hash, 'hex');
    const computedBuffer = Buffer.from(computed, 'hex');
    if (hashBuffer.length !== computedBuffer.length) return false;
    return crypto.timingSafeEqual(hashBuffer, computedBuffer);
  } catch {
    return false;
  }
}

// Helper: base64url encode/decode
function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

// Generate JWT token (30-day session)
export function signToken(user: Pick<User, 'id' | 'email' | 'roles' | 'activeRole'>): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const expiryDays = Number(process.env.SESSION_EXPIRY_DAYS) || 30;
  const exp = now + expiryDays * 24 * 60 * 60;

  const payload: TokenPayload = {
    userId: user.id,
    email: user.email.toLowerCase(),
    roles: user.roles,
    activeRole: user.activeRole,
    iat: now,
    exp,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

// Verify JWT token
export function verifyToken(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, signature] = parts;
    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    if (signature !== expectedSignature) return null;

    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as TokenPayload;
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null; // Expired
    }

    return payload;
  } catch {
    return null;
  }
}
