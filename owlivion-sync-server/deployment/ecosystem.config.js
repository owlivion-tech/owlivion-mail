/**
 * PM2 Ecosystem Configuration
 * Production process management for Owlivion Sync Server
 *
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 restart ecosystem.config.js
 *   pm2 stop ecosystem.config.js
 *   pm2 logs owlivion-sync
 *   pm2 monit
 */

module.exports = {
  apps: [
    {
      name: 'owlivion-sync',
      script: './src/index.js',
      cwd: '/opt/owlivion-sync-server',

      // Instances & Clustering
      instances: 2, // Number of instances (use 'max' for all CPU cores)
      exec_mode: 'cluster', // Enable load balancing

      // Environment
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },

      // Restart Policy
      autorestart: true,
      watch: false, // Disable watch in production
      max_memory_restart: '500M', // Restart if memory exceeds 500MB
      max_restarts: 10, // Max restarts in 1 minute
      min_uptime: '10s', // Minimum uptime before considered stable

      // Logs
      log_file: '/var/log/owlivion-sync/combined.log',
      out_file: '/var/log/owlivion-sync/out.log',
      error_file: '/var/log/owlivion-sync/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      log_type: 'json',

      // Process Control
      kill_timeout: 5000, // Timeout before force kill (ms)
      listen_timeout: 3000, // Timeout for app to listen (ms)
      shutdown_with_message: true,

      // Health Check
      wait_ready: true, // Wait for 'ready' event
      ready_timeout: 30000, // Timeout for ready event (30s)

      // Advanced Features
      instance_var: 'INSTANCE_ID', // Env var for instance ID
      increment_var: 'PORT',

      // Monitoring
      pmx: true, // Enable PMX monitoring
      automation: false, // Disable Keymetrics

      // Error Handling
      exp_backoff_restart_delay: 100, // Exponential backoff on restart
    },
  ],

  // Deployment Configuration (optional)
  deploy: {
    production: {
      user: 'owlivion',
      host: '31.97.216.36',
      ref: 'origin/main',
      repo: 'git@github.com:owlivion/owlivion-sync-server.git',
      path: '/opt/owlivion-sync-server',
      'post-deploy':
        'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-deploy-local': '',
      'post-setup': 'npm install',
      ssh_options: ['ForwardAgent=yes'],
    },
  },
};
