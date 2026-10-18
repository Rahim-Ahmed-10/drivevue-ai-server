import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User, { IUser, UserRole } from '../models/User';
import connectDB from '../config/db'; // Ensure DB connection for serverless

export interface AuthRequest extends Request {
  user?: IUser;
}

interface JwtPayload {
  id: string;
  role: UserRole;
}

export const protect = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  let token: string | undefined;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];

      const jwtSecret = process.env.JWT_SECRET || 'drivevue_super_secret_jwt_key_2026';

      // 1. Verify JWT Token using strict secret
      const decoded = jwt.verify(token, jwtSecret) as JwtPayload;

      // 2. Ensure DB connection for Vercel Serverless Function
      await connectDB();

      // 3. Find User in Database
      const user = await User.findById(decoded.id).select('-password');

      if (!user) {
        res.status(401).json({
          success: false,
          code: 'USER_NOT_FOUND',
          message: 'User account no longer exists. Please register or sign in again.',
        });
        return;
      }

      req.user = user;
      next();
    } catch (error) {
      res.status(401).json({
        success: false,
        code: 'INVALID_TOKEN',
        message: 'Not authorized, token verification failed.',
      });
    }
  } else {
    res.status(401).json({
      success: false,
      code: 'NO_TOKEN',
      message: 'Not authorized, no token provided.',
    });
  }
};

export const authorize = (...roles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: `Forbidden: role '${req.user?.role}' does not have access to this resource`,
      });
      return;
    }
    next();
  };
};

/**
 * Middleware to verify that the authenticated user possesses an ADMIN role.
 */
export const verifyAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      status: 'error',
      success: false,
      message: 'Unauthorized: Authentication required before admin verification.',
    });
    return;
  }

  const userRole = (req.user.role as string) || '';
  const isRoleAdmin =
    userRole.toLowerCase() === 'admin' ||
    userRole === 'ADMIN';

  if (!isRoleAdmin) {
    res.status(403).json({
      status: 'error',
      success: false,
      message: "Forbidden: Access denied. User role is not 'admin'.",
    });
    return;
  }

  next();
};

export const verifyToken = protect;
export const authorizeRoles = authorize;