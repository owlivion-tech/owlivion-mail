/**
 * Owlivion Sync Server
 * Entry Point
 *
 * Zero-Knowledge Account Sync Backend API
 */

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';

import { testConnection } from './config/database.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import { generalLimiter } from './utils/rateLimiter.js';

// Import routes
import authRoutes from './routes/auth.js';
import syncRoutes from './routes/sync.js';
import deltaSyncRoutes from './routes/delta-sync.js';
import deviceRoutes from './routes/devices.js';
import sessionsRoutes from './routes/sessions.js';
import auditRoutes from './routes/audit.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const API_VERSION = process.env.API_VERSION || 'v1';

// ============================================================================
// Environment Validation
// ============================================================================

// Validate required environment variables
const requiredEnvVars = [
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'DB_PASSWORD',
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    console.error('   Please check your .env file and ensure all required variables are set.');
    process.exit(1);
  }

  // Warn about weak defaults
  const value = process.env[envVar];
  if (
    value.includes('change-this') ||
    value.includes('change_this') ||
    value.includes('your_') ||
    value === 'default' ||
    value.length < 32
  ) {
    console.warn(`⚠️  WARNING: Environment variable ${envVar} appears to use a weak/default value!`);
    console.warn('   This is a SECURITY RISK in production. Please use a strong, random value.');
    if (process.env.NODE_ENV === 'production') {
      console.error('   Refusing to start in production with weak secrets.');
      process.exit(1);
    }
  }
}

// ============================================================================
// Middleware
// ============================================================================

// Trust first proxy (for IP logging behind Nginx/Cloudflare)
app.set('trust proxy', 1);

// Enhanced security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"], // For styled components
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: { policy: 'no-referrer' },
    noSniff: true,
    frameguard: { action: 'deny' },
    xssFilter: true,
  })
);

// Additional custom security headers
app.use((req, res, next) => {
  // Permissions Policy (formerly Feature-Policy)
  res.setHeader(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), payment=()'
  );

  // Expect-CT (Certificate Transparency)
  res.setHeader('Expect-CT', 'max-age=86400, enforce');

  next();
});

// Strict CORS configuration
const allowedOrigins = process.env.CORS_ORIGINS?.split(',').map((origin) => origin.trim()) || [];

if (allowedOrigins.length === 0) {
  console.warn('⚠️  WARNING: CORS_ORIGINS not configured - allowing all origins (*)');
  console.warn('   This is a SECURITY RISK in production!');
  if (process.env.NODE_ENV === 'production') {
    console.error('   Refusing to start in production without CORS configuration.');
    process.exit(1);
  }
  // Development fallback
  allowedOrigins.push('*');
}

console.log('🔒 CORS allowed origins:', allowedOrigins);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g., mobile apps, curl)
      if (!origin) {
        return callback(null, true);
      }

      // Check if origin is allowed
      if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    optionsSuccessStatus: 200,
  })
);

// Body parsing
app.use(express.json({ limit: '10mb' })); // Increased for encrypted blobs
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// General rate limiting
app.use(generalLimiter);

// ============================================================================
// Routes
// ============================================================================

// Health check
app.get('/', (req, res) => {
  res.json({
    service: 'Owlivion Sync Server',
    version: '1.0.0',
    status: 'online',
    timestamp: new Date().toISOString(),
  });
});

// API health check
app.get(`/api/${API_VERSION}/health`, (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use(`/api/${API_VERSION}/auth`, authRoutes);
app.use(`/api/${API_VERSION}/sync`, syncRoutes);
app.use(`/api/${API_VERSION}/sync`, deltaSyncRoutes); // Delta sync endpoints
app.use(`/api/${API_VERSION}/devices`, deviceRoutes);
app.use(`/api/${API_VERSION}/sessions`, sessionsRoutes);
app.use(`/api/${API_VERSION}/audit`, auditRoutes);

// ============================================================================
// Error Handling
// ============================================================================

// 404 handler
app.use(notFound);

// Error handler
app.use(errorHandler);

// ============================================================================
// Server Initialization
// ============================================================================

const startServer = async () => {
  try {
    // Test database connection
    console.log('🔄 Testing database connection...');
    const dbConnected = await testConnection();

    if (!dbConnected) {
      console.error('❌ Failed to connect to database. Exiting...');
      process.exit(1);
    }

    // Start server
    app.listen(PORT, HOST, () => {
      console.log('');
      console.log('🚀 Owlivion Sync Server Started');
      console.log('═══════════════════════════════════════');
      console.log(`📍 Server: http://${HOST}:${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📊 API Version: ${API_VERSION}`);
      console.log(`🔐 Database: ${process.env.DB_NAME}@${process.env.DB_HOST}`);
      console.log('═══════════════════════════════════════');
      console.log('');
      console.log('Available endpoints:');
      console.log('  Authentication:');
      console.log(`    POST   /api/${API_VERSION}/auth/register`);
      console.log(`    POST   /api/${API_VERSION}/auth/login`);
      console.log(`    POST   /api/${API_VERSION}/auth/refresh`);
      console.log('  Full Sync:');
      console.log(`    POST   /api/${API_VERSION}/sync/upload`);
      console.log(`    GET    /api/${API_VERSION}/sync/download`);
      console.log(`    GET    /api/${API_VERSION}/sync/status`);
      console.log('  Delta Sync:');
      console.log(`    POST   /api/${API_VERSION}/sync/:data_type/delta`);
      console.log(`    GET    /api/${API_VERSION}/sync/:data_type/delta?since=timestamp`);
      console.log(`    GET    /api/${API_VERSION}/sync/:data_type/deleted?since=timestamp`);
      console.log('  Devices:');
      console.log(`    GET    /api/${API_VERSION}/devices`);
      console.log(`    DELETE /api/${API_VERSION}/devices/:device_id`);
      console.log('  Sessions:');
      console.log(`    GET    /api/${API_VERSION}/sessions`);
      console.log(`    DELETE /api/${API_VERSION}/sessions/:device_id`);
      console.log(`    DELETE /api/${API_VERSION}/sessions (all except current)`);
      console.log('  Audit:');
      console.log(`    GET    /api/${API_VERSION}/audit/logs`);
      console.log(`    GET    /api/${API_VERSION}/audit/stats`);
      console.log(`    GET    /api/${API_VERSION}/audit/export`);
      console.log('');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  app.close(() => {
    console.log('HTTP server closed');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  process.exit(0);
});

// Start the server
startServer();

export default app;
