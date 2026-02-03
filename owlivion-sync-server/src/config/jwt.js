/**
 * JWT Configuration
 *
 * Handles JWT token generation and verification
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'change-this-refresh-secret-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

/**
 * Generate access token
 * @param {object} payload - Token payload (user_id, device_id)
 * @returns {string} JWT token
 */
export const generateAccessToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'owlivion-sync',
  });
};

/**
 * Generate refresh token
 * @param {object} payload - Token payload (user_id, device_id)
 * @returns {string} JWT refresh token
 */
export const generateRefreshToken = (payload) => {
  return jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRES_IN,
    issuer: 'owlivion-sync',
  });
};

/**
 * Verify access token
 * @param {string} token - JWT token
 * @returns {object} Decoded token payload
 * @throws {Error} If token is invalid or expired
 */
export const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET, {
      issuer: 'owlivion-sync',
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token expired');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    }
    throw error;
  }
};

/**
 * Verify refresh token
 * @param {string} token - JWT refresh token
 * @returns {object} Decoded token payload
 * @throws {Error} If token is invalid or expired
 */
export const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET, {
      issuer: 'owlivion-sync',
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Refresh token expired');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid refresh token');
    }
    throw error;
  }
};

/**
 * Hash refresh token for storage
 * @param {string} token - Refresh token
 * @returns {string} SHA-256 hash of token
 */
export const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Get token expiration time in seconds
 * @param {string} expiresIn - Expiration string (e.g., '1h', '7d')
 * @returns {number} Expiration in seconds
 */
export const getExpirationSeconds = (expiresIn) => {
  const matches = expiresIn.match(/^(\d+)([smhd])$/);
  if (!matches) return 3600; // Default 1 hour

  const value = parseInt(matches[1]);
  const unit = matches[2];

  const multipliers = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
  };

  return value * (multipliers[unit] || 3600);
};

/**
 * Get refresh token expiration date
 * @returns {Date} Expiration date
 */
export const getRefreshTokenExpiration = () => {
  const seconds = getExpirationSeconds(JWT_REFRESH_EXPIRES_IN);
  return new Date(Date.now() + seconds * 1000);
};

export default {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
  getRefreshTokenExpiration,
};
