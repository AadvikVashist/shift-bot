import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../helpers/auth/verifier';

export interface AuthedRequest extends Request {
  userId?: string;
}

export async function authMiddleware(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  const token = req.headers['x-auth-token'] as string | undefined;
  if (!token) {
    return res.status(401).json({ error: 'Missing auth token' });
  }
  try {
    const { userId } = await verifyToken(token);
    req.userId = userId;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid auth token' });
  }
} 