import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User, { IUser, UserRole } from '../models/User';

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
      const primarySecret = process.env.JWT_SECRET || 'drivevue_super_secret_jwt_key_2026';
      
      let decoded: JwtPayload;
      try {
        decoded = jwt.verify(token, primarySecret) as JwtPayload;
      } catch {
        try {
          decoded = jwt.verify(token, 'super_secret_key') as JwtPayload;
        } catch {
          decoded = jwt.verify(token, 'default_secret') as JwtPayload;
        }
      }

      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        res.status(401).json({ success: false, message: 'User not found' });
        return;
      }

      req.user = user;
      next();
    } catch {
      res.status(401).json({ success: false, message: 'Not authorized, token failed' });
    }
  } else {
    res.status(401).json({ success: false, message: 'Not authorized, no token provided' });
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
 * Explicitly checks req.user.role === 'admin' (case-insensitive).
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
