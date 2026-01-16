import { Request, Response, NextFunction } from 'express';
import { verifyToken, extractTokenFromHeader, TokenPayload } from '../lib/auth.js';
import { prisma } from './prisma.js';

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
  userData?: Awaited<ReturnType<typeof prisma.user.findUnique>>;
  isMaster?: boolean;
  masterTenantId?: string | null;
}

export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractTokenFromHeader(req.headers.authorization);

  if (!token) {
    res.status(401).json({ error: 'Unauthorized', message: 'No token provided' });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: { tenant: true }
  });

  if (!user || user.status !== 'ACTIVE') {
    res.status(401).json({ error: 'Unauthorized', message: 'User not found or inactive' });
    return;
  }

  req.user = payload;
  req.userData = user;
  req.isMaster = user.isMaster;
  req.masterTenantId = user.masterTenantId;
  next();
}

export function optionalAuthMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const token = extractTokenFromHeader(req.headers.authorization);
  
  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      req.user = payload;
    }
  }
  
  next();
}
