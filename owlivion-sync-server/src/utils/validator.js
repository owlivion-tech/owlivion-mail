/**
 * Input Validation Utilities
 *
 * Validation rules for API endpoints
 */

import { body, param, query, validationResult } from 'express-validator';

/**
 * Handle validation errors
 */
export const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      errors: errors.array().map((err) => ({
        field: err.path,
        message: err.msg,
      })),
    });
  }

  next();
};

/**
 * Validation rules for user registration
 */
export const registerValidation = [
  body('email')
    .isEmail()
    .withMessage('Invalid email address')
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage('Email too long'),

  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .isLength({ max: 128 })
    .withMessage('Password too long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase, and number'),

  body('device_id')
    .isUUID()
    .withMessage('Invalid device ID format'),

  body('device_name')
    .optional()
    .isString()
    .isLength({ max: 255 })
    .withMessage('Device name too long'),

  body('platform')
    .isIn(['windows', 'macos', 'linux'])
    .withMessage('Invalid platform'),

  validate,
];

/**
 * Validation rules for user login
 */
export const loginValidation = [
  body('email')
    .isEmail()
    .withMessage('Invalid email address')
    .normalizeEmail(),

  body('password')
    .notEmpty()
    .withMessage('Password is required'),

  body('device_id')
    .isUUID()
    .withMessage('Invalid device ID format'),

  validate,
];

/**
 * Validation rules for refresh token
 */
export const refreshTokenValidation = [
  body('refresh_token')
    .notEmpty()
    .withMessage('Refresh token is required'),

  validate,
];

/**
 * Validation rules for sync upload
 */
export const syncUploadValidation = [
  body('data_type')
    .isIn(['accounts', 'contacts', 'preferences', 'signatures'])
    .withMessage('Invalid data type'),

  body('encrypted_blob')
    .notEmpty()
    .withMessage('Encrypted blob is required')
    .isBase64()
    .withMessage('Encrypted blob must be base64 encoded'),

  body('nonce')
    .notEmpty()
    .withMessage('Nonce is required')
    .isBase64()
    .withMessage('Nonce must be base64 encoded'),

  body('checksum')
    .notEmpty()
    .withMessage('Checksum is required')
    .isHexadecimal()
    .withMessage('Checksum must be hexadecimal')
    .isLength({ min: 64, max: 64 })
    .withMessage('Checksum must be 64 characters (SHA-256)'),

  body('version')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Version must be a positive integer'),

  body('device_id')
    .notEmpty()
    .withMessage('Device ID is required'),

  validate,
];

/**
 * Validation rules for sync download
 */
export const syncDownloadValidation = [
  query('data_type')
    .isIn(['accounts', 'contacts', 'preferences', 'signatures'])
    .withMessage('Invalid data type'),

  validate,
];

/**
 * Validation rules for device deletion
 */
export const deviceDeleteValidation = [
  param('device_id')
    .isUUID()
    .withMessage('Invalid device ID format'),

  validate,
];

/**
 * Validation rules for delta sync upload
 */
export const deltaSyncUploadValidation = [
  param('data_type')
    .isIn(['accounts', 'contacts', 'preferences', 'signatures'])
    .withMessage('Invalid data type'),

  body('changes')
    .isArray({ min: 1, max: 1000 })
    .withMessage('Changes must be an array with 1-1000 items'),

  body('device_id')
    .notEmpty()
    .withMessage('Device ID is required'),

  body('client_timestamp')
    .optional()
    .isISO8601()
    .withMessage('Client timestamp must be ISO 8601 format'),

  validate,
];

/**
 * Validation rules for delta sync download
 */
export const deltaSyncDownloadValidation = [
  param('data_type')
    .isIn(['accounts', 'contacts', 'preferences', 'signatures'])
    .withMessage('Invalid data type'),

  query('since')
    .notEmpty()
    .withMessage('since parameter is required')
    .isISO8601()
    .withMessage('since must be ISO 8601 timestamp'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('limit must be between 1 and 1000'),

  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('offset must be a non-negative integer'),

  validate,
];

export default {
  validate,
  registerValidation,
  loginValidation,
  refreshTokenValidation,
  syncUploadValidation,
  syncDownloadValidation,
  deviceDeleteValidation,
  deltaSyncUploadValidation,
  deltaSyncDownloadValidation,
};
