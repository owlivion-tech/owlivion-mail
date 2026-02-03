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
import deviceRoutes from './routes/devices.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const API_VERSION = process.env.API_VERSION || 'v1';

// ============================================================================
// Middleware
// ============================================================================

// Security headers
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
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
app.use(`/api/${API_VERSION}/devices`, deviceRoutes);

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
      console.log(`  POST   /api/${API_VERSION}/auth/register`);
      console.log(`  POST   /api/${API_VERSION}/auth/login`);
      console.log(`  POST   /api/${API_VERSION}/auth/refresh`);
      console.log(`  POST   /api/${API_VERSION}/sync/upload`);
      console.log(`  GET    /api/${API_VERSION}/sync/download`);
      console.log(`  GET    /api/${API_VERSION}/sync/status`);
      console.log(`  GET    /api/${API_VERSION}/devices`);
      console.log(`  DELETE /api/${API_VERSION}/devices/:device_id`);
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
