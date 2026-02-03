/**
 * Rate Limiting Utilities
 *
 * Different rate limits for different endpoint types
 */

import rateLimit from 'express-rate-limit';

/**
 * General API rate limiter
 * Default: 100 requests per minute
 */
export const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000, // 1 minute
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    success: false,
    error: 'Too many requests, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Auth rate limiter (stricter)
 * 5 requests per minute per IP
 */
export const authLimiter = rateLimit({
  windowMs: 60000, // 1 minute
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 5,
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count all requests
});

/**
 * Registration rate limiter (very strict)
 * 3 registrations per hour per IP
 */
export const registerLimiter = rateLimit({
  windowMs: 3600000, // 1 hour
  max: 3,
  message: {
    success: false,
    error: 'Too many registration attempts, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Sync upload rate limiter
 * 10 uploads per minute per user
 */
export const syncUploadLimiter = rateLimit({
  windowMs: 60000, // 1 minute
  max: 10,
  message: {
    success: false,
    error: 'Too many sync uploads, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit by user ID instead of IP
    return req.user?.userId || req.ip;
  },
});

/**
 * Sync download rate limiter
 * 20 downloads per minute per user
 */
export const syncDownloadLimiter = rateLimit({
  windowMs: 60000, // 1 minute
  max: 20,
  message: {
    success: false,
    error: 'Too many sync downloads, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user?.userId || req.ip;
  },
});

export default {
  generalLimiter,
  authLimiter,
  registerLimiter,
  syncUploadLimiter,
  syncDownloadLimiter,
};
