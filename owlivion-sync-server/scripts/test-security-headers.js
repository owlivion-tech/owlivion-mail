/**
 * Security Headers Test Server
 * Minimal server to test security header configuration without database
 */

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3001; // Use different port to avoid conflicts

// Trust first proxy
app.set('trust proxy', 1);

// Enhanced security headers (same as main server)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    hsts: {
      maxAge: 31536000,
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
  res.setHeader(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), payment=()'
  );
  res.setHeader('Expect-CT', 'max-age=86400, enforce');
  next();
});

// CORS configuration
const allowedOrigins = process.env.CORS_ORIGINS?.split(',').map((origin) => origin.trim()) || ['*'];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Security headers test server',
    timestamp: new Date().toISOString(),
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🔒 Security Headers Test Server`);
  console.log(`📍 Listening on: http://localhost:${PORT}`);
  console.log(`🌍 CORS origins: ${allowedOrigins.join(', ')}`);
  console.log(`\n✅ Server ready for testing!\n`);
  console.log(`Test with: curl -I http://localhost:${PORT}/health`);
  console.log(`\nPress Ctrl+C to stop.\n`);
});
