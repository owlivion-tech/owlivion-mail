/**
 * Authentication Middleware
 *
 * JWT token verification middleware
 */

import { verifyAccessToken } from '../config/jwt.js';

/**
 * Authenticate JWT token
 * Extracts token from Authorization header and verifies it
 */
export const authenticate = (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No token provided',
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = verifyAccessToken(token);

    // Attach user info to request
    req.user = {
      userId: decoded.user_id,
      deviceId: decoded.device_id,
    };

    next();
  } catch (error) {
    if (error.message === 'Token expired') {
      return res.status(401).json({
        success: false,
        error: 'Token expired',
        code: 'TOKEN_EXPIRED',
      });
    } else if (error.message === 'Invalid token') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token',
        code: 'INVALID_TOKEN',
      });
    }

    return res.status(401).json({
      success: false,
      error: 'Authentication failed',
    });
  }
};

/**
 * Optional authentication
 * Does not fail if token is missing, but validates if present
 */
export const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyAccessToken(token);

      req.user = {
        userId: decoded.user_id,
        deviceId: decoded.device_id,
      };
    }

    next();
  } catch (error) {
    // Ignore token errors for optional auth
    next();
  }
};

export default {
  authenticate,
  optionalAuth,
};
