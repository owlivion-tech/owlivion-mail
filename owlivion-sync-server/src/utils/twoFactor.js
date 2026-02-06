/**
 * Two-Factor Authentication (2FA) Utility
 * TOTP-based implementation compatible with Google Authenticator, Authy, etc.
 */

import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';

/**
 * Generate a new 2FA secret for user
 * @param {String} userEmail - User's email address
 * @returns {Object} { secret, otpauth_url }
 */
export const generateSecret = (userEmail) => {
  const secret = speakeasy.generateSecret({
    name: `Owlivion Mail (${userEmail})`,
    issuer: 'Owlivion',
    length: 32,
    encoding: 'base32',
  });

  return {
    secret: secret.base32,
    otpauth_url: secret.otpauth_url,
  };
};

/**
 * Generate QR code data URL for authenticator app
 * @param {String} otpauth_url - OTP Auth URL from secret generation
 * @returns {Promise<String>} Data URL for QR code image
 */
export const generateQRCode = async (otpauth_url) => {
  try {
    return await QRCode.toDataURL(otpauth_url);
  } catch (error) {
    throw new Error(`Failed to generate QR code: ${error.message}`);
  }
};

/**
 * Verify TOTP token
 * @param {String} secret - Base32 encoded secret
 * @param {String} token - 6-digit code from authenticator app
 * @param {Number} window - Time window (±N steps, default 2 = ±60 seconds)
 * @returns {Boolean} True if token is valid
 */
export const verifyToken = (secret, token, window = 2) => {
  // Remove any spaces or dashes from token
  const cleanToken = token.replace(/[\s-]/g, '');

  // Validate token format (6 digits)
  if (!/^\d{6}$/.test(cleanToken)) {
    return false;
  }

  return speakeasy.totp.verify({
    secret: secret,
    encoding: 'base32',
    token: cleanToken,
    window: window,
  });
};

/**
 * Generate backup codes (10 codes, 8 characters each)
 * @returns {Array<String>} Array of backup codes
 */
export const generateBackupCodes = () => {
  const codes = [];
  for (let i = 0; i < 10; i++) {
    // Generate random 8-character alphanumeric code
    const code = crypto
      .randomBytes(4)
      .toString('hex')
      .toUpperCase()
      .match(/.{1,4}/g)
      .join('-'); // Format: XXXX-XXXX

    codes.push(code);
  }
  return codes;
};

/**
 * Hash backup code for secure storage
 * @param {String} code - Plain text backup code
 * @returns {String} SHA-256 hash of code
 */
export const hashBackupCode = (code) => {
  // Remove dashes before hashing
  const cleanCode = code.replace(/-/g, '');
  return crypto.createHash('sha256').update(cleanCode).digest('hex');
};

/**
 * Verify backup code against hash
 * @param {String} code - Plain text backup code from user
 * @param {String} hash - Stored hash to verify against
 * @returns {Boolean} True if code matches hash
 */
export const verifyBackupCode = (code, hash) => {
  const codeHash = hashBackupCode(code);
  return codeHash === hash;
};

/**
 * Hash array of backup codes
 * @param {Array<String>} codes - Array of plain text codes
 * @returns {Array<String>} Array of hashed codes
 */
export const hashBackupCodes = (codes) => {
  return codes.map(hashBackupCode);
};

/**
 * Validate backup code format
 * @param {String} code - Backup code to validate
 * @returns {Boolean} True if format is valid
 */
export const isValidBackupCodeFormat = (code) => {
  // Format: XXXX-XXXX (8 hex characters with dash)
  return /^[0-9A-F]{4}-[0-9A-F]{4}$/i.test(code);
};

/**
 * Generate TOTP token (for testing purposes)
 * @param {String} secret - Base32 encoded secret
 * @returns {String} Current TOTP token
 */
export const generateToken = (secret) => {
  return speakeasy.totp({
    secret: secret,
    encoding: 'base32',
  });
};
