# PM2 Plus Setup Guide

PM2 Plus (formerly Keymetrics), Owlivion Sync Server için gelişmiş monitoring, alerting ve performance tracking sağlar.

## Features

- 📊 **Real-time Dashboard**: CPU, Memory, Event Loop monitoring
- 🚨 **Custom Alerts**: CPU/Memory threshold alerts
- 📈 **Metrics Tracking**: Custom business metrics
- 🐛 **Exception Tracking**: Automatic error reporting
- 📉 **Transaction Tracing**: Slow transaction detection
- 📱 **Mobile App**: iOS/Android monitoring apps

## Setup Steps

### 1. Create PM2 Plus Account

```bash
# Visit: https://pm2.io/
# Sign up for free account (supports up to 4 servers)
```

**Free Tier Includes:**
- Up to 4 servers
- 1 day data retention
- Basic metrics & alerts
- Community support

### 2. Link Server to PM2 Plus

```bash
# On your VPS (31.97.216.36), run:
pm2 link <secret_key> <public_key>

# Keys are found in PM2 Plus Dashboard:
# Bucket Settings -> General -> Connect to PM2 Plus
```

### 3. Update Ecosystem Config

```bash
# Enable PM2 Plus in ecosystem.config.js
# (Already prepared in updated config)

pm2 reload ecosystem.config.js
```

### 4. Verify Connection

```bash
# Check if linked
pm2 info owlivion-sync

# View real-time monitoring
pm2 monit

# Check PM2 Plus dashboard at:
# https://app.pm2.io/
```

## Configuration Options

### Basic Monitoring (Current Setup)

```javascript
{
  pmx: true,           // Enable PMX agent
  automation: true,    // Enable PM2 Plus
}
```

### Advanced Custom Metrics (Optional)

```javascript
{
  pmx: {
    enabled: true,
    network: true,        // Network latency monitoring
    ports: true,          // Port monitoring
    custom_probes: [
      {
        name: 'Active Syncs',
        value: () => getActiveSyncCount()
      },
      {
        name: 'Queue Size',
        value: () => getSyncQueueSize()
      }
    ]
  }
}
```

## Custom Alerts Setup

### Via PM2 Plus Dashboard

1. Go to **Alerts** tab
2. Create new alert rule:
   - **CPU Usage > 80%** for 5 minutes → Email/Slack
   - **Memory > 400MB** for 2 minutes → Email
   - **Process Restarts > 3** in 10 minutes → Email/SMS
   - **Exception Count > 5** in 5 minutes → Email

### Via CLI

```bash
# Set CPU alert
pm2 set pm2-plus:cpu-threshold 80

# Set memory alert
pm2 set pm2-plus:memory-threshold 400

# Set restart alert
pm2 set pm2-plus:restart-threshold 3
```

## Custom Metrics in Code

Update `src/index.js` to report custom metrics:

```javascript
const pmx = require('@pm2/io');

// Custom metric: Active sync operations
const activeSyncs = pmx.metric({
  name: 'Active Syncs',
  type: 'gauge'
});

// Update metric value
activeSyncs.set(syncManager.getActiveCount());

// Custom counter: Total syncs processed
const totalSyncs = pmx.counter({
  name: 'Total Syncs Processed'
});

// Increment on each sync
syncManager.on('sync:complete', () => {
  totalSyncs.inc();
});

// Custom histogram: Sync duration
const syncDuration = pmx.histogram({
  name: 'Sync Duration',
  measurement: 'mean',
  unit: 'ms'
});

// Track sync performance
syncDuration.update(syncTime);
```

## Exception Tracking

PM2 Plus automatically captures:
- Uncaught exceptions
- Unhandled promise rejections
- HTTP errors (with express integration)

### Custom Exception Reporting

```javascript
const pmx = require('@pm2/io');

try {
  // Risky operation
  await syncUser(userId);
} catch (error) {
  // Report to PM2 Plus
  pmx.notifyError(error, {
    userId,
    operation: 'sync',
    context: 'user_sync'
  });

  throw error;
}
```

## Transaction Tracing

Enable transaction tracing for HTTP requests:

```javascript
const pmx = require('@pm2/io');

// Trace specific routes
pmx.init({
  transactions: true,
  http: true,
  http_latency: 200,      // Trace requests > 200ms
  http_code: [500, 502],  // Trace these status codes
});
```

## Notification Channels

Configure in PM2 Plus Dashboard:

### Email Notifications
1. **Settings** → **Notifications** → **Email**
2. Add email addresses
3. Set notification frequency

### Slack Integration
1. **Settings** → **Integrations** → **Slack**
2. Connect Slack workspace
3. Choose channel
4. Configure alert levels

### Webhook Integration
1. **Settings** → **Integrations** → **Webhook**
2. Add webhook URL
3. Configure payload format

## Dashboard Views

### Overview Tab
- Server health status
- CPU/Memory usage graphs
- Active processes
- Recent exceptions

### Metrics Tab
- Custom metrics dashboard
- Historical data
- Metric comparisons

### Transactions Tab
- Slow transaction list
- Latency percentiles
- Transaction breakdown

### Exceptions Tab
- Exception list
- Stack traces
- Occurrence frequency
- Affected routes

## Mobile App

Download PM2 Plus app:
- **iOS**: https://apps.apple.com/app/pm2-plus/id1456946515
- **Android**: https://play.google.com/store/apps/details?id=io.keymetrics.mobile

## Troubleshooting

### Link Failed

```bash
# Check PM2 version
pm2 --version  # Should be >= 5.0.0

# Update PM2
npm install -g pm2@latest

# Clear PM2 cache
pm2 kill
pm2 resurrect

# Try linking again
pm2 link <secret> <public>
```

### No Data in Dashboard

```bash
# Check PMX module
pm2 ls

# Verify process has PMX enabled
pm2 describe owlivion-sync | grep pmx

# Check logs
pm2 logs owlivion-sync --lines 100 | grep -i pmx
```

### Metrics Not Showing

```bash
# Install @pm2/io if missing
cd /opt/owlivion-sync-server
npm install @pm2/io

# Restart processes
pm2 reload ecosystem.config.js
```

## Security Considerations

- ✅ **Public/Secret keys** are safe to use (server-side only)
- ✅ **No source code** is sent to PM2 Plus
- ✅ **Only metrics & logs** are transmitted (encrypted)
- ⚠️ **Sensitive data**: Ensure logs don't contain passwords/tokens
- ⚠️ **Network**: PM2 Plus uses HTTPS (port 443)

## Cost Optimization

**Free Tier Limits:**
- 4 servers max
- 1 day retention
- Basic features

**If you need more:**
- **Business Plan** ($59/month): 20 servers, 7-day retention
- **Enterprise Plan** ($199/month): Unlimited servers, 30-day retention

**Alternative (Free):**
- Keep basic PM2 Plus for real-time monitoring
- Use your custom health checks + Grafana for long-term storage

## Next Steps

1. ✅ Link server to PM2 Plus: `pm2 link <secret> <public>`
2. ✅ Update ecosystem config (see updated file)
3. ✅ Reload PM2: `pm2 reload ecosystem.config.js`
4. ✅ Configure alerts in PM2 Plus dashboard
5. ⏳ (Optional) Add custom metrics to codebase
6. ⏳ (Optional) Setup Slack/Email notifications
7. ⏳ (Optional) Install mobile app

## Resources

- 📚 **Documentation**: https://pm2.io/docs/
- 🎥 **Video Guide**: https://www.youtube.com/watch?v=EO4HN5mYQJ4
- 💬 **Community**: https://github.com/Unitech/pm2/issues
- 📧 **Support**: support@pm2.io
