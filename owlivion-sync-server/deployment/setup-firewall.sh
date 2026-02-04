#!/bin/bash

# Owlivion Sync Server - UFW Firewall Setup Script
# Task #3: Configure firewall rules for production VPS
# Server: 31.97.216.36

set -e

echo "=================================================="
echo "Owlivion Sync Server - Firewall Setup (Task #3)"
echo "=================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "Please run as root (use sudo)"
    exit 1
fi

print_info "Starting UFW firewall configuration..."
echo ""

# Step 1: Install UFW if not installed
print_info "Step 1: Checking UFW installation..."
if ! command -v ufw &> /dev/null; then
    print_info "Installing UFW..."
    apt-get update
    apt-get install -y ufw
    print_success "UFW installed"
else
    print_success "UFW already installed"
fi
echo ""

# Step 2: Reset UFW to default state (optional, for clean setup)
print_info "Step 2: Resetting UFW to default state..."
ufw --force reset
print_success "UFW reset complete"
echo ""

# Step 3: Set default policies
print_info "Step 3: Setting default policies..."
ufw default deny incoming
ufw default allow outgoing
print_success "Default policies set (deny incoming, allow outgoing)"
echo ""

# Step 4: Allow SSH (CRITICAL - do this first to avoid lockout!)
print_info "Step 4: Allowing SSH connections..."
ufw allow 22/tcp comment 'SSH access'
print_success "SSH (port 22) allowed"
echo ""

# Step 5: Allow HTTP and HTTPS
print_info "Step 5: Allowing web traffic..."
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
print_success "HTTP (port 80) and HTTPS (port 443) allowed"
echo ""

# Step 6: Rate limiting for SSH (prevent brute force)
print_info "Step 6: Setting up SSH rate limiting..."
ufw limit 22/tcp comment 'SSH rate limit'
print_success "SSH rate limiting enabled (max 6 connections per 30 seconds)"
echo ""

# Step 7: Ensure localhost traffic is allowed
print_info "Step 7: Allowing localhost traffic..."
ufw allow from 127.0.0.1 comment 'Localhost'
print_success "Localhost traffic allowed"
echo ""

# Step 8: Block direct access to PostgreSQL from outside
print_info "Step 8: PostgreSQL security check..."
print_info "PostgreSQL (5432) should only be accessible from localhost"
print_info "Verifying no external access rule exists..."
ufw deny 5432/tcp comment 'Block external PostgreSQL'
print_success "PostgreSQL blocked from external access"
echo ""

# Step 9: Block direct access to Node.js app (should only be accessed via Nginx)
print_info "Step 9: Node.js app security check..."
print_info "Node.js app (3000) should only be accessible via Nginx reverse proxy"
ufw deny 3000/tcp comment 'Block direct Node.js access'
print_success "Direct Node.js app access blocked"
echo ""

# Step 10: Enable UFW
print_info "Step 10: Enabling UFW firewall..."
ufw --force enable
print_success "UFW firewall enabled and active"
echo ""

# Step 11: Display firewall status
print_info "Step 11: Current firewall status:"
echo ""
ufw status verbose
echo ""

# Step 12: Display listening ports
print_info "Step 12: Currently listening ports:"
echo ""
ss -tulnp | grep LISTEN
echo ""

print_success "============================================"
print_success "Firewall setup complete! (Task #3)"
print_success "============================================"
echo ""
print_info "Summary of firewall rules:"
echo "  - SSH (22): ✓ Allowed with rate limiting"
echo "  - HTTP (80): ✓ Allowed"
echo "  - HTTPS (443): ✓ Allowed"
echo "  - PostgreSQL (5432): ✗ Blocked from external access"
echo "  - Node.js (3000): ✗ Blocked from external access"
echo ""
print_info "Next steps:"
echo "  1. Verify SSH access still works"
echo "  2. Test HTTP/HTTPS access after SSL setup (Task #2)"
echo "  3. Monitor UFW logs: sudo tail -f /var/log/ufw.log"
echo ""
