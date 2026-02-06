# Owlivion Sync Server - Scaling Guide

> **Phase 6: Production Scaling & Multi-Region Deployment**
>
> Bu doküman, Owlivion Sync Server'ın horizontal scaling, monitoring, ve multi-region deployment süreçlerini detaylandırır.

## 📊 Current Infrastructure

**Production Environment:**
- **VPS:** 31.97.216.36 (owlivion.com, owlcrypt.com)
- **OS:** Ubuntu 20.04 LTS
- **Database:** PostgreSQL 14
- **Reverse Proxy:** Nginx (Dockerized)
- **Process Manager:** PM2
- **SSL/TLS:** Let's Encrypt (auto-renewal)
- **Monitoring:** UptimeRobot (uptime), PM2 Plus (process monitoring)

**Current Limitations:**
- Single VPS (no redundancy)
- Manual scaling (no load balancing)
- Limited observability (no APM, tracing)
- No geographic distribution
- No automatic failover

---

## 🎯 Scaling Strategy

### Phase 6.1: Monitoring Stack (Week 1)
**Priority:** HIGH - Essential for informed scaling decisions

1. **Prometheus + Grafana Stack**
   - Metrics collection (Prometheus)
   - Visualization (Grafana dashboards)
   - Alert manager integration
   - Node exporter (system metrics)
   - PostgreSQL exporter (DB metrics)

2. **Application Performance Monitoring (APM)**
   - Response time tracking
   - Database query performance
   - Memory usage patterns
   - CPU utilization
   - Sync operation metrics

3. **Custom Metrics**
   - Sync operations/minute
   - Active users
   - API endpoint latency
   - Database connection pool usage
   - Queue depth (delta sync)

### Phase 6.2: Load Balancing (Week 2-3)
**Priority:** MEDIUM - Needed for horizontal scaling

1. **HAProxy Setup**
   - Layer 7 load balancing
   - Health check endpoints
   - Sticky sessions (JWT-based)
   - SSL termination

2. **Application Server Scaling**
   - Clone VPS instance (secondary node)
   - Shared PostgreSQL cluster
   - Session storage in Redis
   - File sync (rsync or NFS)

3. **Database Scaling**
   - PostgreSQL replication (master-slave)
   - Read replicas for sync operations
   - Connection pooling (PgBouncer)

### Phase 6.3: Multi-Region Deployment (Week 4+)
**Priority:** LOW - Future growth

1. **Geographic Distribution**
   - Secondary VPS (different region)
   - CDN integration (Cloudflare/AWS CloudFront)
   - Regional DNS routing

2. **Disaster Recovery**
   - Automated database backups (cross-region)
   - Failover automation
   - Recovery testing procedures

---

## 📈 Part 1: Monitoring Stack Setup

### 1.1 Prometheus Installation

Prometheus will collect metrics from Node.js app, PostgreSQL, and system.

**Installation Steps:**

```bash
# On production VPS (31.97.216.36)
cd /opt
sudo wget https://github.com/prometheus/prometheus/releases/download/v2.47.0/prometheus-2.47.0.linux-amd64.tar.gz
sudo tar xvfz prometheus-2.47.0.linux-amd64.tar.gz
sudo mv prometheus-2.47.0.linux-amd64 prometheus
sudo useradd --no-create-home --shell /bin/false prometheus
sudo chown -R prometheus:prometheus /opt/prometheus
```

**Configuration:** `/opt/prometheus/prometheus.yml`

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    cluster: 'owlivion-sync-prod'
    environment: 'production'

# Alertmanager configuration
alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - localhost:9093

# Load rules once and periodically evaluate them
rule_files:
  - "alerts/*.yml"

# Scrape configurations
scrape_configs:
  # Prometheus self-monitoring
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  # Node Exporter (system metrics)
  - job_name: 'node'
    static_configs:
      - targets: ['localhost:9100']
        labels:
          instance: 'owlivion-sync-server'

  # PostgreSQL Exporter
  - job_name: 'postgresql'
    static_configs:
      - targets: ['localhost:9187']
        labels:
          database: 'owlivion_sync'

  # Node.js Application (custom metrics)
  - job_name: 'owlivion-sync-api'
    static_configs:
      - targets: ['localhost:3000']
        labels:
          app: 'sync-server'
    metrics_path: '/metrics'
```

**Systemd Service:** `/etc/systemd/system/prometheus.service`

```ini
[Unit]
Description=Prometheus Monitoring System
Wants=network-online.target
After=network-online.target

[Service]
User=prometheus
Group=prometheus
Type=simple
ExecStart=/opt/prometheus/prometheus \
  --config.file=/opt/prometheus/prometheus.yml \
  --storage.tsdb.path=/var/lib/prometheus \
  --web.console.templates=/opt/prometheus/consoles \
  --web.console.libraries=/opt/prometheus/console_libraries \
  --storage.tsdb.retention.time=30d

Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

**Enable and Start:**

```bash
sudo systemctl daemon-reload
sudo systemctl enable prometheus
sudo systemctl start prometheus
sudo systemctl status prometheus
```

### 1.2 Node Exporter (System Metrics)

```bash
cd /opt
sudo wget https://github.com/prometheus/node_exporter/releases/download/v1.6.1/node_exporter-1.6.1.linux-amd64.tar.gz
sudo tar xvfz node_exporter-1.6.1.linux-amd64.tar.gz
sudo mv node_exporter-1.6.1.linux-amd64 node_exporter
sudo useradd --no-create-home --shell /bin/false node_exporter
sudo chown -R node_exporter:node_exporter /opt/node_exporter
```

**Systemd Service:** `/etc/systemd/system/node_exporter.service`

```ini
[Unit]
Description=Prometheus Node Exporter
Wants=network-online.target
After=network-online.target

[Service]
User=node_exporter
Group=node_exporter
Type=simple
ExecStart=/opt/node_exporter/node_exporter

Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable node_exporter
sudo systemctl start node_exporter
```

### 1.3 PostgreSQL Exporter

```bash
cd /opt
sudo wget https://github.com/prometheus-community/postgres_exporter/releases/download/v0.14.0/postgres_exporter-0.14.0.linux-amd64.tar.gz
sudo tar xvfz postgres_exporter-0.14.0.linux-amd64.tar.gz
sudo mv postgres_exporter-0.14.0.linux-amd64 postgres_exporter
sudo useradd --no-create-home --shell /bin/false postgres_exporter
sudo chown -R postgres_exporter:postgres_exporter /opt/postgres_exporter
```

**Database User:**

```sql
-- Create monitoring user
CREATE USER postgres_exporter WITH PASSWORD 'change-this-password';
GRANT pg_monitor TO postgres_exporter;
```

**Environment File:** `/opt/postgres_exporter/.env`

```bash
DATA_SOURCE_NAME="postgresql://postgres_exporter:change-this-password@localhost:5432/owlivion_sync?sslmode=disable"
```

**Systemd Service:** `/etc/systemd/system/postgres_exporter.service`

```ini
[Unit]
Description=Prometheus PostgreSQL Exporter
Wants=network-online.target
After=network-online.target postgresql.service

[Service]
User=postgres_exporter
Group=postgres_exporter
Type=simple
EnvironmentFile=/opt/postgres_exporter/.env
ExecStart=/opt/postgres_exporter/postgres_exporter

Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable postgres_exporter
sudo systemctl start postgres_exporter
```

### 1.4 Grafana Installation

```bash
# Add Grafana repository
sudo apt-get install -y software-properties-common
sudo add-apt-repository "deb https://packages.grafana.com/oss/deb stable main"
wget -q -O - https://packages.grafana.com/gpg.key | sudo apt-key add -
sudo apt-get update

# Install Grafana
sudo apt-get install grafana

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable grafana-server
sudo systemctl start grafana-server
```

**Default Access:**
- URL: `http://31.97.216.36:3001` (or configure subdomain)
- Default credentials: admin / admin (change immediately!)

**Nginx Reverse Proxy Config:**

```nginx
server {
    listen 443 ssl http2;
    server_name grafana.owlivion.com;

    ssl_certificate /etc/letsencrypt/live/owlivion.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/owlivion.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Add DNS Record:**
```
A record: grafana.owlivion.com → 31.97.216.36
```

### 1.5 Node.js Application Metrics

We'll use `prom-client` library to expose custom metrics.

**Install dependency:**

```bash
cd /home/owlivion-sync-server
npm install prom-client
```

**Implementation:** Add to `src/index.js` (see metrics.js below)

### 1.6 Alert Rules

**File:** `/opt/prometheus/alerts/sync-server-alerts.yml`

```yaml
groups:
  - name: sync_server_alerts
    interval: 30s
    rules:
      # High CPU Usage
      - alert: HighCPUUsage
        expr: 100 - (avg by (instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High CPU usage on {{ $labels.instance }}"
          description: "CPU usage is above 80% (current: {{ $value }}%)"

      # High Memory Usage
      - alert: HighMemoryUsage
        expr: (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100 > 85
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage on {{ $labels.instance }}"
          description: "Memory usage is above 85% (current: {{ $value }}%)"

      # Disk Space Low
      - alert: DiskSpaceLow
        expr: (node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) * 100 < 15
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Disk space low on {{ $labels.instance }}"
          description: "Less than 15% disk space available (current: {{ $value }}%)"

      # API High Latency
      - alert: APIHighLatency
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "API latency is high"
          description: "95th percentile latency is above 1 second (current: {{ $value }}s)"

      # Database Connection Pool Exhaustion
      - alert: DatabasePoolExhausted
        expr: pg_stat_database_numbackends / pg_settings_max_connections > 0.8
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Database connection pool near exhaustion"
          description: "Using {{ $value | humanizePercentage }} of max connections"

      # High Error Rate
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is above 5% (current: {{ $value | humanizePercentage }})"
```

---

## 🔧 Part 2: Load Balancing Setup

### 2.1 HAProxy Installation

**Why HAProxy?**
- Layer 7 load balancing (HTTP/HTTPS)
- Health checks with automatic failover
- Sticky sessions (important for JWT tokens)
- SSL termination
- Better performance than Nginx for load balancing

**Installation:**

```bash
sudo apt-get update
sudo apt-get install haproxy
```

**Configuration:** `/etc/haproxy/haproxy.cfg`

```haproxy
global
    log /dev/log local0
    log /dev/log local1 notice
    chroot /var/lib/haproxy
    stats socket /run/haproxy/admin.sock mode 660 level admin
    stats timeout 30s
    user haproxy
    group haproxy
    daemon

    # SSL Settings
    ssl-default-bind-ciphers ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384
    ssl-default-bind-options no-sslv3 no-tlsv10 no-tlsv11

defaults
    log     global
    mode    http
    option  httplog
    option  dontlognull
    timeout connect 5000
    timeout client  50000
    timeout server  50000
    errorfile 400 /etc/haproxy/errors/400.http
    errorfile 403 /etc/haproxy/errors/403.http
    errorfile 408 /etc/haproxy/errors/408.http
    errorfile 500 /etc/haproxy/errors/500.http
    errorfile 502 /etc/haproxy/errors/502.http
    errorfile 503 /etc/haproxy/errors/503.http
    errorfile 504 /etc/haproxy/errors/504.http

# Stats page
frontend stats
    bind *:8404
    stats enable
    stats uri /stats
    stats refresh 10s
    stats auth admin:change-this-password

# Frontend (HTTPS)
frontend https_frontend
    bind *:443 ssl crt /etc/letsencrypt/live/owlivion.com/haproxy.pem
    mode http

    # HSTS Header
    http-response set-header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"

    # Rate limiting (basic)
    stick-table type ip size 100k expire 30s store http_req_rate(10s)
    http-request track-sc0 src
    http-request deny deny_status 429 if { sc_http_req_rate(0) gt 100 }

    # ACL for API paths
    acl is_api path_beg /api/

    # Use backend based on ACL
    use_backend sync_servers if is_api
    default_backend sync_servers

# Backend (Node.js servers)
backend sync_servers
    mode http
    balance roundrobin
    option httpchk GET /api/v1/health
    http-check expect status 200

    # Sticky sessions (based on JWT token in cookie)
    cookie SERVER insert indirect nocache

    # Server list (add more as needed)
    server node1 localhost:3000 check cookie node1 weight 100
    # server node2 10.0.0.2:3000 check cookie node2 weight 100
    # server node3 10.0.0.3:3000 check cookie node3 weight 100

    # Health check settings
    option httpchk
    http-check send meth GET uri /api/v1/health
    http-check expect status 200
```

**SSL Certificate (Combine for HAProxy):**

```bash
# HAProxy needs combined cert + key in one file
sudo cat /etc/letsencrypt/live/owlivion.com/fullchain.pem \
        /etc/letsencrypt/live/owlivion.com/privkey.pem \
        > /etc/letsencrypt/live/owlivion.com/haproxy.pem
sudo chmod 600 /etc/letsencrypt/live/owlivion.com/haproxy.pem
```

**Auto-renewal hook:** `/etc/letsencrypt/renewal-hooks/post/haproxy-reload.sh`

```bash
#!/bin/bash
cat /etc/letsencrypt/live/owlivion.com/fullchain.pem \
    /etc/letsencrypt/live/owlivion.com/privkey.pem \
    > /etc/letsencrypt/live/owlivion.com/haproxy.pem
chmod 600 /etc/letsencrypt/live/owlivion.com/haproxy.pem
systemctl reload haproxy
```

```bash
sudo chmod +x /etc/letsencrypt/renewal-hooks/post/haproxy-reload.sh
```

**Enable and Start:**

```bash
sudo systemctl enable haproxy
sudo systemctl start haproxy
sudo systemctl status haproxy
```

**Firewall Update:**

```bash
# Allow HAProxy stats port (restrict to specific IPs in production)
sudo ufw allow from your.ip.address to any port 8404 proto tcp
```

### 2.2 Redis for Session Storage

When scaling horizontally, we need shared session storage.

**Installation:**

```bash
sudo apt-get install redis-server
```

**Configuration:** `/etc/redis/redis.conf`

```conf
# Bind to localhost only (use private network in multi-server setup)
bind 127.0.0.1

# Set password
requirepass change-this-redis-password

# Persistence
save 900 1
save 300 10
save 60 10000

# Max memory
maxmemory 256mb
maxmemory-policy allkeys-lru
```

**Enable and Start:**

```bash
sudo systemctl enable redis-server
sudo systemctl start redis-server
```

**Update Node.js App:**

```bash
cd /home/owlivion-sync-server
npm install redis connect-redis express-session
```

### 2.3 PostgreSQL Connection Pooling (PgBouncer)

**Installation:**

```bash
sudo apt-get install pgbouncer
```

**Configuration:** `/etc/pgbouncer/pgbouncer.ini`

```ini
[databases]
owlivion_sync = host=localhost port=5432 dbname=owlivion_sync

[pgbouncer]
listen_addr = 127.0.0.1
listen_port = 6432
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = transaction
max_client_conn = 500
default_pool_size = 25
reserve_pool_size = 5
reserve_pool_timeout = 3
```

**User List:** `/etc/pgbouncer/userlist.txt`

```
"owlivion" "md5<hash of password>"
```

Generate hash:

```bash
echo -n "passwordusername" | md5sum
```

**Enable and Start:**

```bash
sudo systemctl enable pgbouncer
sudo systemctl start pgbouncer
```

**Update Database Connection String:**

```
# Before:
postgresql://owlivion:password@localhost:5432/owlivion_sync

# After (via PgBouncer):
postgresql://owlivion:password@localhost:6432/owlivion_sync
```

---

## 🌍 Part 3: Multi-Region Deployment

### 3.1 Secondary VPS Setup

**Provider Options:**
- Hetzner (Germany) - €4.51/mo for 2 vCPU, 4GB RAM
- DigitalOcean (Frankfurt) - $12/mo for 2 vCPU, 2GB RAM
- Vultr (Amsterdam) - $6/mo for 1 vCPU, 2GB RAM

**Architecture:**

```
Primary Region (Turkey): 31.97.216.36
├─ HAProxy (load balancer)
├─ Node.js app (PM2)
├─ PostgreSQL (master)
└─ Redis (master)

Secondary Region (Europe):
├─ HAProxy (load balancer)
├─ Node.js app (PM2)
├─ PostgreSQL (read replica)
└─ Redis (replica)
```

### 3.2 PostgreSQL Replication

**On Primary (31.97.216.36):**

Edit `/etc/postgresql/14/main/postgresql.conf`:

```conf
wal_level = replica
max_wal_senders = 3
wal_keep_size = 64
```

Edit `/etc/postgresql/14/main/pg_hba.conf`:

```
# Allow replication from secondary VPS
host replication replicator <SECONDARY_IP>/32 md5
```

Create replication user:

```sql
CREATE ROLE replicator WITH REPLICATION PASSWORD 'change-this-password' LOGIN;
```

Restart PostgreSQL:

```bash
sudo systemctl restart postgresql
```

**On Secondary VPS:**

```bash
# Stop PostgreSQL
sudo systemctl stop postgresql

# Remove existing data
sudo rm -rf /var/lib/postgresql/14/main/*

# Base backup from primary
sudo -u postgres pg_basebackup -h <PRIMARY_IP> -D /var/lib/postgresql/14/main -U replicator -P -v -R -X stream -C -S standby1

# Start PostgreSQL
sudo systemctl start postgresql
```

**Monitoring Replication Lag:**

```sql
-- On primary
SELECT client_addr, state, sent_lsn, write_lsn, replay_lsn, sync_state
FROM pg_stat_replication;

-- On replica
SELECT now() - pg_last_xact_replay_timestamp() AS replication_lag;
```

### 3.3 Geographic DNS Routing

**Option 1: Cloudflare (Recommended)**

1. Add domain to Cloudflare
2. Enable "Load Balancing" feature ($5/mo)
3. Create origin pools:
   - Pool 1: Primary VPS (31.97.216.36)
   - Pool 2: Secondary VPS (Europe)
4. Configure health checks
5. Set routing policy: Geo-based or failover

**Option 2: AWS Route 53**

1. Create hosted zone for owlivion.com
2. Create health checks for each region
3. Configure geolocation routing policy:
   - Turkey/Middle East → Primary VPS
   - Europe → Secondary VPS
   - Default → Primary VPS

### 3.4 CDN Integration

**Cloudflare CDN (Free):**

1. Enable Cloudflare proxy (orange cloud)
2. Configure cache rules
3. Enable Always Online
4. Configure Page Rules:
   - Cache static assets (60 minutes)
   - Bypass cache for API routes

**Benefits:**
- DDoS protection (free)
- SSL/TLS (free)
- CDN caching
- Web Application Firewall (paid)

---

## 📊 Metrics & Dashboards

### Key Metrics to Monitor

**System Metrics:**
- CPU usage (target: < 70%)
- Memory usage (target: < 80%)
- Disk I/O (IOPS)
- Network bandwidth

**Application Metrics:**
- Request rate (req/sec)
- Response time (p50, p95, p99)
- Error rate (target: < 1%)
- Active connections

**Database Metrics:**
- Query latency
- Connection pool usage
- Cache hit ratio
- Replication lag (if applicable)

**Business Metrics:**
- Active users
- Sync operations/minute
- Delta sync bandwidth savings
- Email operations/second

### Grafana Dashboard JSON

See `monitoring/grafana-dashboards/owlivion-sync-overview.json` for pre-configured dashboard.

---

## 🚨 Alerting Strategy

### Alert Channels

1. **Email** - Critical alerts only
2. **Slack/Discord** - All alerts
3. **PagerDuty** - Production outages (optional)

### Alert Severity Levels

- **P0 (Critical):** Service down, database unavailable
  - Response time: Immediate
  - Example: All servers unhealthy, database unreachable

- **P1 (High):** Degraded performance, high error rate
  - Response time: 15 minutes
  - Example: Error rate > 5%, API latency > 2s

- **P2 (Medium):** Resource warnings
  - Response time: 1 hour
  - Example: CPU > 80%, memory > 85%

- **P3 (Low):** Informational
  - Response time: Next business day
  - Example: Disk space < 30%, SSL cert expiring in 14 days

---

## 🔐 Security Considerations

1. **Firewall Rules:**
   - Block Prometheus/Grafana from public access
   - Whitelist monitoring tools to specific IPs

2. **Authentication:**
   - Change default Grafana credentials
   - Use strong passwords for exporters
   - Enable 2FA for Grafana admin

3. **Data Retention:**
   - Prometheus: 30 days (configurable)
   - Logs: 7 days (increase for compliance)

4. **Encryption:**
   - Use TLS for all inter-node communication
   - Encrypt PostgreSQL replication stream

---

## 📈 Cost Estimate

**Monitoring Stack (Monthly):**
- Prometheus: Free (self-hosted)
- Grafana: Free (self-hosted)
- Exporters: Free
- Storage: ~5GB (~€0.50)

**Load Balancing:**
- HAProxy: Free (self-hosted)
- Redis: Free (self-hosted)
- PgBouncer: Free (self-hosted)

**Multi-Region:**
- Secondary VPS: €4.51/mo (Hetzner)
- Cloudflare Load Balancing: $5/mo (optional)
- Cloudflare CDN: Free

**Total Monthly Cost:** ~€10-15 (~$11-16)

---

## 🛠️ Deployment Checklist

### Phase 6.1: Monitoring (Week 1)
- [ ] Install Prometheus
- [ ] Install Node Exporter
- [ ] Install PostgreSQL Exporter
- [ ] Configure alert rules
- [ ] Install Grafana
- [ ] Import dashboards
- [ ] Configure Nginx reverse proxy for Grafana
- [ ] Set up alert channels (email/Slack)
- [ ] Add custom application metrics
- [ ] Test alerts

### Phase 6.2: Load Balancing (Week 2-3)
- [ ] Install HAProxy
- [ ] Configure SSL termination
- [ ] Set up health checks
- [ ] Install Redis (session storage)
- [ ] Install PgBouncer (connection pooling)
- [ ] Update application config
- [ ] Test failover scenarios
- [ ] Performance testing

### Phase 6.3: Multi-Region (Week 4+)
- [ ] Provision secondary VPS
- [ ] Set up PostgreSQL replication
- [ ] Deploy application to secondary
- [ ] Configure HAProxy on secondary
- [ ] Set up Redis replication
- [ ] Configure DNS routing (Cloudflare)
- [ ] Test failover
- [ ] Verify replication lag
- [ ] Run disaster recovery drill

---

## 📚 References

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [HAProxy Configuration Guide](http://www.haproxy.org/)
- [PostgreSQL Replication](https://www.postgresql.org/docs/current/warm-standby.html)
- [Node.js Production Best Practices](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/)

---

**Last Updated:** 2026-02-06
**Status:** Planning Phase
**Next Steps:** Install monitoring stack (Phase 6.1)
