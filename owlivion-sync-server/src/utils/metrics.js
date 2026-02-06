/**
 * Prometheus Metrics for Owlivion Sync Server
 *
 * This module exposes application metrics for Prometheus scraping.
 * Metrics include HTTP request duration, request count, active users, sync operations, etc.
 */

import promClient from 'prom-client';

// Create a Registry
const register = new promClient.Registry();

// Add default metrics (CPU, memory, etc.)
promClient.collectDefaultMetrics({
  register,
  prefix: 'owlivion_sync_',
});

// ============================================================================
// CUSTOM METRICS
// ============================================================================

/**
 * HTTP Request Duration Histogram
 * Tracks response time distribution for all endpoints
 */
export const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10], // Buckets in seconds
  registers: [register],
});

/**
 * HTTP Request Counter
 * Counts total number of requests by method, route, and status code
 */
export const httpRequestTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

/**
 * Active Users Gauge
 * Tracks number of currently active users (based on JWT tokens)
 */
export const activeUsers = new promClient.Gauge({
  name: 'active_users_total',
  help: 'Number of active users in the system',
  registers: [register],
});

/**
 * Sync Operations Counter
 * Tracks sync operations (upload, download) and their status
 */
export const syncOperations = new promClient.Counter({
  name: 'sync_operations_total',
  help: 'Total number of sync operations',
  labelNames: ['type', 'status'], // type: upload/download, status: success/failed
  registers: [register],
});

/**
 * Sync Operation Duration
 * Tracks time taken for sync operations
 */
export const syncDuration = new promClient.Histogram({
  name: 'sync_operation_duration_seconds',
  help: 'Duration of sync operations in seconds',
  labelNames: ['type'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
  registers: [register],
});

/**
 * Database Query Duration
 * Tracks database query performance
 */
export const dbQueryDuration = new promClient.Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['query_type'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2],
  registers: [register],
});

/**
 * Login Attempts Counter
 * Tracks login attempts (success/failed)
 */
export const loginAttempts = new promClient.Counter({
  name: 'login_attempts_total',
  help: 'Total number of login attempts',
  labelNames: ['status'], // success/failed
  registers: [register],
});

/**
 * Delta Sync Bandwidth Savings
 * Tracks bandwidth savings from delta sync
 */
export const deltaSyncBandwidth = new promClient.Counter({
  name: 'delta_sync_bandwidth_bytes',
  help: 'Total bandwidth saved by delta sync in bytes',
  labelNames: ['operation'], // saved/full
  registers: [register],
});

/**
 * Email Operations Counter
 * Tracks email operations (send, receive, sync)
 */
export const emailOperations = new promClient.Counter({
  name: 'email_operations_total',
  help: 'Total number of email operations',
  labelNames: ['operation', 'status'], // operation: send/receive/sync, status: success/failed
  registers: [register],
});

/**
 * Cache Hit/Miss Counter
 * Tracks cache performance
 */
export const cacheOperations = new promClient.Counter({
  name: 'cache_operations_total',
  help: 'Total number of cache operations',
  labelNames: ['operation'], // hit/miss/set
  registers: [register],
});

/**
 * Queue Depth Gauge
 * Tracks number of pending sync operations in queue
 */
export const queueDepth = new promClient.Gauge({
  name: 'queue_depth_total',
  help: 'Number of pending operations in queue',
  labelNames: ['queue_type'], // sync/email/notification
  registers: [register],
});

// ============================================================================
// MIDDLEWARE
// ============================================================================

/**
 * Express middleware to track HTTP request metrics
 *
 * Usage:
 *   app.use(metricsMiddleware);
 */
export function metricsMiddleware(req, res, next) {
  const start = Date.now();

  // Intercept res.end to measure duration
  const originalEnd = res.end;
  res.end = function (...args) {
    const duration = (Date.now() - start) / 1000; // Convert to seconds
    const route = req.route ? req.route.path : req.path;
    const method = req.method;
    const status = res.statusCode;

    // Record metrics
    httpRequestDuration.labels(method, route, status).observe(duration);
    httpRequestTotal.labels(method, route, status).inc();

    // Call original end function
    originalEnd.apply(res, args);
  };

  next();
}

/**
 * Metrics endpoint handler
 * Exposes /metrics endpoint for Prometheus scraping
 *
 * Usage:
 *   app.get('/metrics', metricsEndpoint);
 */
export async function metricsEndpoint(req, res) {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(err);
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Update active users count
 * Call this periodically (e.g., every minute) to update the gauge
 *
 * @param {number} count - Number of active users
 */
export function updateActiveUsers(count) {
  activeUsers.set(count);
}

/**
 * Record a sync operation
 *
 * @param {string} type - Type of sync (upload/download)
 * @param {string} status - Status (success/failed)
 * @param {number} duration - Duration in seconds
 */
export function recordSyncOperation(type, status, duration) {
  syncOperations.labels(type, status).inc();
  syncDuration.labels(type).observe(duration);
}

/**
 * Record a database query
 *
 * @param {string} queryType - Type of query (select/insert/update/delete)
 * @param {number} duration - Duration in seconds
 */
export function recordDbQuery(queryType, duration) {
  dbQueryDuration.labels(queryType).observe(duration);
}

/**
 * Record a login attempt
 *
 * @param {string} status - Status (success/failed)
 */
export function recordLoginAttempt(status) {
  loginAttempts.labels(status).inc();
}

/**
 * Record delta sync bandwidth savings
 *
 * @param {number} savedBytes - Bytes saved
 * @param {number} fullBytes - Full payload size
 */
export function recordDeltaSyncBandwidth(savedBytes, fullBytes) {
  deltaSyncBandwidth.labels('saved').inc(savedBytes);
  deltaSyncBandwidth.labels('full').inc(fullBytes);
}

/**
 * Record an email operation
 *
 * @param {string} operation - Operation type (send/receive/sync)
 * @param {string} status - Status (success/failed)
 */
export function recordEmailOperation(operation, status) {
  emailOperations.labels(operation, status).inc();
}

/**
 * Record cache operation
 *
 * @param {string} operation - Operation type (hit/miss/set)
 */
export function recordCacheOperation(operation) {
  cacheOperations.labels(operation).inc();
}

/**
 * Update queue depth
 *
 * @param {string} queueType - Queue type (sync/email/notification)
 * @param {number} depth - Current queue depth
 */
export function updateQueueDepth(queueType, depth) {
  queueDepth.labels(queueType).set(depth);
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  register,
  metricsMiddleware,
  metricsEndpoint,
  updateActiveUsers,
  recordSyncOperation,
  recordDbQuery,
  recordLoginAttempt,
  recordDeltaSyncBandwidth,
  recordEmailOperation,
  recordCacheOperation,
  updateQueueDepth,
};
