import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { env } from '../config/env.ts';
import { logger } from '../lib/logger.ts';

// Extend the Request object to include the user payload
// This is how we pass the authenticated userId down to the controller
interface CustomRequest extends Request {
  user?: JwtPayload & { userId: string };
}

/**
 * Validates the JWT provided in the Authorization header.
 * Attaches the decoded user payload (userId) to the request object.
 */
export const authMiddleware = (
  req: CustomRequest,
  res: Response,
  next: NextFunction
) => {
  // 1. Check for token in the Authorization header: Bearer <token>
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access Denied: No token provided or token format is invalid.' });
  }

  // Extract the token part
  const token = authHeader.split(' ')[1];

  try {
    // 2. Verify and Decode the Token
    // Uses the JWT_SECRET from the env file
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload & { userId: string };

    // 3. Attach the user data to the request object
    req.user = decoded;
    
    // Log for visibility, but keep user data brief
    logger.debug({ userId: decoded.userId }, 'Token verified for user');

    // 4. Pass control to the next middleware/controller
    next();
  } catch (err) {
    // Handle expired tokens, invalid signatures, etc.
    logger.warn(err, 'Token verification failed');
    return res.status(403).json({ error: 'Access Denied: Invalid or expired token.' });
  }
};