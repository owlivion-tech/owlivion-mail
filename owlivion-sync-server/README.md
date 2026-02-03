# Owlivion Sync Server

Backend API for Owlivion Mail cross-device account synchronization.

## Architecture

- **Framework**: Node.js + Express
- **Database**: PostgreSQL 14+
- **Authentication**: JWT (Access + Refresh tokens)
- **Security**: E2E encryption (server stores encrypted blobs)
- **API Version**: v1

## Features

- 🔐 **Zero-Knowledge Architecture** - Server never sees plaintext data
- 🔑 **JWT Authentication** - Secure token-based auth with refresh tokens
- 📊 **Sync Management** - Upload/download encrypted sync data
- 🖥️ **Device Management** - Register and manage multiple devices
- 🛡️ **Rate Limiting** - Prevent abuse and brute-force attacks
- 📝 **Audit Logging** - Track all sync operations

## Data Types Synced

1. **Accounts** - Email account settings (IMAP/SMTP configs, no passwords)
2. **Contacts** - Address book
3. **Preferences** - App settings and preferences
4. **Signatures** - Email signatures

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new Owlivion Account
- `POST /api/v1/auth/login` - Login and get tokens
- `POST /api/v1/auth/refresh` - Refresh access token

### Sync
- `POST /api/v1/sync/upload` - Upload encrypted sync data
- `GET /api/v1/sync/download?data_type=contacts` - Download encrypted data
- `GET /api/v1/sync/status` - Get sync status for all data types

### Devices
- `GET /api/v1/devices` - List registered devices
- `DELETE /api/v1/devices/:device_id` - Revoke device access

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- npm or yarn

### Installation

1. Clone and install dependencies:
```bash
cd owlivion-sync-server
npm install
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Create database:
```bash
createdb owlivion_sync
```

4. Run migrations:
```bash
npm run db:migrate
```

5. Start server:
```bash
# Development
npm run dev

# Production
npm start
```

## Database Schema

See `src/db/schema.sql` for the complete PostgreSQL schema.

**Tables:**
- `users` - User accounts
- `devices` - Registered devices per user
- `sync_data` - Encrypted sync data blobs
- `sync_history` - Audit log of sync operations

## Environment Variables

See `.env.example` for all available configuration options.

**Critical Settings:**
- `JWT_SECRET` - Change in production!
- `JWT_REFRESH_SECRET` - Change in production!
- `DB_PASSWORD` - Strong password for PostgreSQL

## Security

- ✅ Bcrypt password hashing (12 rounds)
- ✅ JWT token expiration (1h access, 7d refresh)
- ✅ Rate limiting (configurable per endpoint)
- ✅ Helmet.js security headers
- ✅ Input validation on all endpoints
- ✅ CORS configuration
- ✅ SQL injection prevention (parameterized queries)

## Rate Limits

| Endpoint | Rate Limit |
|----------|-----------|
| `/auth/register` | 3 per hour per IP |
| `/auth/login` | 5 per minute per IP |
| `/sync/upload` | 10 per minute per user |
| `/sync/download` | 20 per minute per user |
| `/devices` | 10 per minute per user |

## Development

### Running Tests
```bash
npm test
```

### Database Migrations
```bash
# Run migrations
npm run db:migrate

# Seed test data
npm run db:seed
```

### Logs
Development logs are written to console.
Production logs can be configured via LOG_LEVEL environment variable.

## Deployment

### VPS Deployment (31.97.216.36)

1. Install Node.js and PostgreSQL on VPS
2. Clone repository
3. Configure production .env
4. Setup PostgreSQL database
5. Run migrations
6. Use PM2 for process management:
```bash
npm install -g pm2
pm2 start src/index.js --name owlivion-sync
pm2 save
pm2 startup
```

### Nginx Reverse Proxy

```nginx
server {
    listen 443 ssl http2;
    server_name sync.owlivion.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

## Monitoring

Consider adding:
- PM2 monitoring dashboard
- PostgreSQL query performance monitoring
- Error tracking (e.g., Sentry)
- Uptime monitoring

## License

MIT License - See LICENSE file for details
