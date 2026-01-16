/**
 * Multi-Tenant Authentication System for OpenCode
 * 
 * This module provides JWT-based authentication with tenant isolation.
 * Integrates with the ChatIAS multi-tenant architecture.
 */

import { createCookie, getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { sign, verify, decode } from 'hono/jwt';
import { Context } from 'hono';

// ============================================================================
// TYPES
// ============================================================================

export interface TenantSession {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  userId: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
  apiKey?: string;
}

export interface AuthContext {
  session: TenantSession | null;
  isAuthenticated: boolean;
  tenantId: string | null;
  userId: string | null;
}

export interface JWTPayload {
  sub: string;        // userId
  tid: string;        // tenantId
  tslug: string;      // tenant slug
  tname: string;      // tenant name
  email: string;
  name: string;
  role: string;
  perms: string[];    // permissions
  iat: number;
  exp: number;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-in-production';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';
const COOKIE_NAME = 'chatias_session';
const COOKIE_MAX_AGE = 60 * 60 * 24; // 24 hours

// ============================================================================
// TOKEN FUNCTIONS
// ============================================================================

/**
 * Generate JWT token for authenticated session
 */
export async function generateToken(session: TenantSession): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const expiry = Math.floor(Date.now() / 1000) + (parseTime(JWT_EXPIRY) || 86400);

  const payload: JWTPayload = {
    sub: session.userId,
    tid: session.tenantId,
    tslug: session.tenantSlug,
    tname: session.tenantName,
    email: session.email,
    name: session.name,
    role: session.role,
    perms: session.permissions,
    iat: now,
    exp: expiry
  };

  return await sign(payload, JWT_SECRET);
}

/**
 * Verify and decode JWT token
 */
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const payload = await verify(token, JWT_SECRET);
    return payload as unknown as JWTPayload;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

/**
 * Decode token without verification (for debugging)
 */
export function decodeToken(token: string): JWTPayload | null {
  try {
    const decoded = decode(token);
    return decoded.payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

// ============================================================================
// COOKIE FUNCTIONS
// ============================================================================

/**
 * Set authentication cookie
 */
export function setAuthCookie(c: Context, token: string): void {
  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/'
  });
}

/**
 * Get authentication cookie
 */
export function getAuthCookie(c: Context): string | undefined {
  return getCookie(c, COOKIE_NAME);
}

/**
 * Clear authentication cookie
 */
export function clearAuthCookie(c: Context): void {
  deleteCookie(c, COOKIE_NAME, { path: '/' });
}

// ============================================================================
// AUTH CONTEXT
// ============================================================================

/**
 * Get authentication context from request
 */
export async function getAuthContext(c: Context): Promise<AuthContext> {
  const token = getAuthCookie(c);
  
  if (!token) {
    return {
      session: null,
      isAuthenticated: false,
      tenantId: null,
      userId: null
    };
  }

  const payload = await verifyToken(token);
  
  if (!payload) {
    return {
      session: null,
      isAuthenticated: false,
      tenantId: null,
      userId: null
    };
  }

  const session: TenantSession = {
    tenantId: payload.tid,
    tenantSlug: payload.tslug,
    tenantName: payload.tname,
    userId: payload.sub,
    email: payload.email,
    name: payload.name,
    role: payload.role,
    permissions: payload.perms
  };

  return {
    session,
    isAuthenticated: true,
    tenantId: payload.tid,
    userId: payload.sub
  };
}

/**
 * Require authentication - throws if not authenticated
 */
export async function requireAuth(c: Context): Promise<TenantSession> {
  const auth = await getAuthContext(c);
  
  if (!auth.isAuthenticated || !auth.session) {
    throw new AuthError('Authentication required', 'UNAUTHORIZED', 401);
  }

  return auth.session;
}

/**
 * Require specific permission
 */
export async function requirePermission(c: Context, permission: string): Promise<TenantSession> {
  const session = await requireAuth(c);
  
  if (!session.permissions.includes('admin') && !session.permissions.includes(permission)) {
    throw new AuthError(
      `Permission '${permission}' required`,
      'FORBIDDEN',
      403
    );
  }

  return session;
}

// ============================================================================
// API KEY AUTHENTICATION
// ============================================================================

/**
 * Authenticate using API key (header)
 */
export async function authenticateApiKey(
  apiKey: string,
  tenantRegistry: any
): Promise<TenantSession | null> {
  // API key format: sk_XXXXX
  if (!apiKey.startsWith('sk_')) {
    return null;
  }

  const prefix = apiKey.substring(0, 8);
  
  // In a real implementation, look up in database
  // For now, we'll use a simple validation
  // This would integrate with the UserRepository
  
  return null; // Implement with database lookup
}

// ============================================================================
// AUTH MIDDLEWARE
// ============================================================================

/**
 * Authentication middleware for Hono routes
 */
export function authMiddleware() {
  return async function(c: Context, next: () => Promise<void>) {
    try {
      const auth = await getAuthContext(c);
      (c as any).auth = auth;
      await next();
    } catch (error) {
      if (error instanceof AuthError) {
        return c.json({
          success: false,
          error: error.message,
          code: error.code
        }, error.status);
      }
      throw error;
    }
  };
}

/**
 * Optional auth middleware - doesn't require auth but populates context
 */
export function optionalAuthMiddleware() {
  return async function(c: Context, next: () => Promise<void>) {
    const auth = await getAuthContext(c);
    (c as any).auth = auth;
    await next();
  };
}

// ============================================================================
// TENANT CONTEXT
// ============================================================================

/**
 * Get tenant ID from request (path, header, or query)
 */
export function getTenantId(c: Context): string | null {
  // Check path parameter
  const tenantSlug = c.req.param('tenant');
  if (tenantSlug) {
    return tenantSlug;
  }

  // Check header
  const headerTenant = c.req.header('X-Tenant-ID');
  if (headerTenant) {
    return headerTenant;
  }

  // Check auth context
  const auth = (c as any).auth as AuthContext | undefined;
  if (auth?.tenantId) {
    return auth.tenantId;
  }

  return null;
}

/**
 * Validate tenant access for authenticated user
 */
export async function validateTenantAccess(
  c: Context,
  tenantId: string
): Promise<boolean> {
  const auth = await getAuthContext(c);
  
  if (!auth.isAuthenticated) {
    return false;
  }

  // User can only access their own tenant
  return auth.tenantId === tenantId;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function parseTime(time: string): number {
  const match = time.match(/^(\d+)([smhd])$/);
  if (!match) return 0;

  const value = parseInt(match[1]);
  const unit = match[2];

  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 60 * 60;
    case 'd': return value * 60 * 60 * 24;
    default: return 0;
  }
}

// ============================================================================
// CUSTOM ERRORS
// ============================================================================

export class AuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number = 400
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export type { TenantSession, AuthContext, JWTPayload };
export {
  generateToken,
  verifyToken,
  decodeToken,
  setAuthCookie,
  getAuthCookie,
  clearAuthCookie,
  getAuthContext,
  requireAuth,
  requirePermission,
  authenticateApiKey,
  authMiddleware,
  optionalAuthMiddleware,
  getTenantId,
  validateTenantAccess,
  AuthError
};