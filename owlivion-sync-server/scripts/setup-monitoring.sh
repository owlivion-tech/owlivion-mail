#!/bin/bash

################################################################################
# Owlivion Sync Server - Monitoring Stack Setup
#
# This script installs and configures:
# - Prometheus (metrics collection)
# - Node Exporter (system metrics)
# - PostgreSQL Exporter (database metrics)
# - Grafana (visualization)
# - Alert Manager (alerting)
#
# Usage: sudo bash scripts/setup-monitoring.sh
################################################################################

set -e  # Exit on error

echo "================================================"
echo "Owlivion Monitoring Stack Setup"
echo "================================================"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "❌ Please run as root (use sudo)"
  exit 1
fi

# Variables
PROMETHEUS_VERSION="2.47.0"
NODE_EXPORTER_VERSION="1.6.1"
POSTGRES_EXPORTER_VERSION="0.14.0"
INSTALL_DIR="/opt"
DATA_DIR="/var/lib"

echo "📦 Step 1: Creating users and directories..."

# Create users
useradd --no-create-home --shell /bin/false prometheus 2>/dev/null || true
useradd --no-create-home --shell /bin/false node_exporter 2>/dev/null || true
useradd --no-create-home --shell /bin/false postgres_exporter 2>/dev/null || true

# Create directories
mkdir -p ${DATA_DIR}/prometheus
mkdir -p ${INSTALL_DIR}/prometheus/alerts
mkdir -p ${INSTALL_DIR}/prometheus/rules

echo "✅ Users and directories created"

################################################################################
# PROMETHEUS INSTALLATION
################################################################################

echo ""
echo "📊 Step 2: Installing Prometheus ${PROMETHEUS_VERSION}..."

cd ${INSTALL_DIR}

# Download Prometheus
if [ ! -f "prometheus-${PROMETHEUS_VERSION}.linux-amd64.tar.gz" ]; then
  wget -q --show-progress \
    "https://github.com/prometheus/prometheus/releases/download/v${PROMETHEUS_VERSION}/prometheus-${PROMETHEUS_VERSION}.linux-amd64.tar.gz"
fi

# Extract
tar xzf prometheus-${PROMETHEUS_VERSION}.linux-amd64.tar.gz
rm -rf prometheus  # Remove old installation
mv prometheus-${PROMETHEUS_VERSION}.linux-amd64 prometheus

# Set ownership
chown -R prometheus:prometheus ${INSTALL_DIR}/prometheus
chown -R prometheus:prometheus ${DATA_DIR}/prometheus

echo "✅ Prometheus installed at ${INSTALL_DIR}/prometheus"

################################################################################
# NODE EXPORTER INSTALLATION
################################################################################

echo ""
echo "💻 Step 3: Installing Node Exporter ${NODE_EXPORTER_VERSION}..."

cd ${INSTALL_DIR}

# Download Node Exporter
if [ ! -f "node_exporter-${NODE_EXPORTER_VERSION}.linux-amd64.tar.gz" ]; then
  wget -q --show-progress \
    "https://github.com/prometheus/node_exporter/releases/download/v${NODE_EXPORTER_VERSION}/node_exporter-${NODE_EXPORTER_VERSION}.linux-amd64.tar.gz"
fi

# Extract
tar xzf node_exporter-${NODE_EXPORTER_VERSION}.linux-amd64.tar.gz
rm -rf node_exporter
mv node_exporter-${NODE_EXPORTER_VERSION}.linux-amd64 node_exporter

# Set ownership
chown -R node_exporter:node_exporter ${INSTALL_DIR}/node_exporter

echo "✅ Node Exporter installed at ${INSTALL_DIR}/node_exporter"

################################################################################
# POSTGRESQL EXPORTER INSTALLATION
################################################################################

echo ""
echo "🐘 Step 4: Installing PostgreSQL Exporter ${POSTGRES_EXPORTER_VERSION}..."

cd ${INSTALL_DIR}

# Download PostgreSQL Exporter
if [ ! -f "postgres_exporter-${POSTGRES_EXPORTER_VERSION}.linux-amd64.tar.gz" ]; then
  wget -q --show-progress \
    "https://github.com/prometheus-community/postgres_exporter/releases/download/v${POSTGRES_EXPORTER_VERSION}/postgres_exporter-${POSTGRES_EXPORTER_VERSION}.linux-amd64.tar.gz"
fi

# Extract
tar xzf postgres_exporter-${POSTGRES_EXPORTER_VERSION}.linux-amd64.tar.gz
rm -rf postgres_exporter
mv postgres_exporter-${POSTGRES_EXPORTER_VERSION}.linux-amd64 postgres_exporter

# Set ownership
chown -R postgres_exporter:postgres_exporter ${INSTALL_DIR}/postgres_exporter

echo "✅ PostgreSQL Exporter installed at ${INSTALL_DIR}/postgres_exporter"

################################################################################
# PROMETHEUS CONFIGURATION
################################################################################

echo ""
echo "⚙️  Step 5: Configuring Prometheus..."

# Copy configuration from repo
cp monitoring/prometheus.yml ${INSTALL_DIR}/prometheus/prometheus.yml
cp monitoring/alerts/*.yml ${INSTALL_DIR}/prometheus/alerts/ 2>/dev/null || true

# Set ownership
chown prometheus:prometheus ${INSTALL_DIR}/prometheus/prometheus.yml
chown -R prometheus:prometheus ${INSTALL_DIR}/prometheus/alerts

echo "✅ Prometheus configured"

################################################################################
# POSTGRESQL EXPORTER CONFIGURATION
################################################################################

echo ""
echo "🔑 Step 6: Configuring PostgreSQL Exporter..."

# Prompt for PostgreSQL password
read -sp "Enter PostgreSQL password for postgres_exporter user: " PG_PASSWORD
echo ""

# Create environment file
cat > ${INSTALL_DIR}/postgres_exporter/.env <<EOF
DATA_SOURCE_NAME="postgresql://postgres_exporter:${PG_PASSWORD}@localhost:5432/owlivion_sync?sslmode=disable"
EOF

chmod 600 ${INSTALL_DIR}/postgres_exporter/.env
chown postgres_exporter:postgres_exporter ${INSTALL_DIR}/postgres_exporter/.env

echo "✅ PostgreSQL Exporter configured"

# Create PostgreSQL monitoring user
echo ""
echo "📝 Creating PostgreSQL monitoring user..."
sudo -u postgres psql -c "CREATE USER postgres_exporter WITH PASSWORD '${PG_PASSWORD}';" 2>/dev/null || echo "   (User already exists)"
sudo -u postgres psql -c "GRANT pg_monitor TO postgres_exporter;"

echo "✅ PostgreSQL user created"

################################################################################
# SYSTEMD SERVICES
################################################################################

echo ""
echo "🔧 Step 7: Creating systemd services..."

# Prometheus service
cat > /etc/systemd/system/prometheus.service <<'EOF'
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
  --storage.tsdb.retention.time=30d \
  --web.listen-address=0.0.0.0:9090

Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Node Exporter service
cat > /etc/systemd/system/node_exporter.service <<'EOF'
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
EOF

# PostgreSQL Exporter service
cat > /etc/systemd/system/postgres_exporter.service <<'EOF'
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
EOF

echo "✅ Systemd services created"

################################################################################
# GRAFANA INSTALLATION
################################################################################

echo ""
echo "📈 Step 8: Installing Grafana..."

# Add Grafana repository
apt-get install -y software-properties-common apt-transport-https
wget -q -O - https://packages.grafana.com/gpg.key | apt-key add -
add-apt-repository "deb https://packages.grafana.com/oss/deb stable main" -y
apt-get update

# Install Grafana
apt-get install -y grafana

echo "✅ Grafana installed"

################################################################################
# ENABLE AND START SERVICES
################################################################################

echo ""
echo "🚀 Step 9: Enabling and starting services..."

systemctl daemon-reload

# Start services
systemctl enable prometheus
systemctl start prometheus

systemctl enable node_exporter
systemctl start node_exporter

systemctl enable postgres_exporter
systemctl start postgres_exporter

systemctl enable grafana-server
systemctl start grafana-server

echo "✅ All services started"

################################################################################
# FIREWALL CONFIGURATION
################################################################################

echo ""
echo "🔥 Step 10: Configuring firewall..."

# Allow Prometheus (local only)
# ufw allow from 127.0.0.1 to any port 9090 proto tcp

# Allow Grafana (configure reverse proxy instead)
# ufw allow 3001/tcp

echo "⚠️  Note: Prometheus (9090) and Grafana (3001) ports are not exposed publicly."
echo "   Configure Nginx reverse proxy for external access."

################################################################################
# VERIFY INSTALLATION
################################################################################

echo ""
echo "🔍 Step 11: Verifying installation..."

sleep 3

echo ""
echo "Service Status:"
echo "---------------"

systemctl is-active --quiet prometheus && echo "✅ Prometheus: Running" || echo "❌ Prometheus: Failed"
systemctl is-active --quiet node_exporter && echo "✅ Node Exporter: Running" || echo "❌ Node Exporter: Failed"
systemctl is-active --quiet postgres_exporter && echo "✅ PostgreSQL Exporter: Running" || echo "❌ PostgreSQL Exporter: Failed"
systemctl is-active --quiet grafana-server && echo "✅ Grafana: Running" || echo "❌ Grafana: Failed"

echo ""
echo "Endpoints:"
echo "----------"
echo "Prometheus:         http://localhost:9090"
echo "Node Exporter:      http://localhost:9100/metrics"
echo "PostgreSQL Exporter: http://localhost:9187/metrics"
echo "Grafana:            http://localhost:3001"

################################################################################
# POST-INSTALLATION STEPS
################################################################################

echo ""
echo "================================================"
echo "✅ Monitoring Stack Installation Complete!"
echo "================================================"
echo ""
echo "📋 Next Steps:"
echo ""
echo "1. Configure Nginx reverse proxy for Grafana:"
echo "   - Create subdomain: grafana.owlivion.com"
echo "   - Add SSL certificate"
echo "   - Configure proxy_pass to localhost:3001"
echo ""
echo "2. Access Grafana:"
echo "   - URL: http://localhost:3001"
echo "   - Default credentials: admin / admin"
echo "   - IMPORTANT: Change password immediately!"
echo ""
echo "3. Import Grafana dashboards:"
echo "   - Import monitoring/grafana-dashboards/*.json"
echo ""
echo "4. Configure alert channels:"
echo "   - Email, Slack, or Discord"
echo ""
echo "5. Add application metrics to Node.js app:"
echo "   - Install prom-client: npm install prom-client"
echo "   - Add metrics endpoint: /metrics"
echo ""
echo "6. Test alerts:"
echo "   - Verify alert rules are working"
echo ""
echo "================================================"
