#!/bin/bash
# Setup script for HTTPS on EC2 with Nginx and Let's Encrypt
# Run this script on your EC2 instance

set -e

echo "=== Setting up HTTPS for Student Agent Backend ==="

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "Please run as root (use sudo)"
    exit 1
fi

# Domain name
DOMAIN_NAME="studentagent.site"

echo "Using domain: $DOMAIN_NAME"
echo "Make sure this domain points to your EC2 IP: 34.221.98.251"
read -p "Press Enter to continue or Ctrl+C to cancel..."

# Install Nginx
echo "Installing Nginx..."
yum update -y
yum install -y nginx

# Install Certbot
echo "Installing Certbot..."
yum install -y certbot python3-certbot-nginx

# Start and enable Nginx
systemctl start nginx
systemctl enable nginx

# Create initial Nginx config (HTTP only - Certbot will add HTTPS)
echo "Creating Nginx configuration..."
cat > /etc/nginx/conf.d/student-agent.conf <<EOF
# HTTP server - will proxy to backend until SSL is set up
# After Certbot runs, it will add HTTPS and redirect HTTP to HTTPS
server {
    listen 80;
    server_name $DOMAIN_NAME;
    
    # For Let's Encrypt certificate validation
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    # Proxy to backend (temporary - will redirect to HTTPS after SSL setup)
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Test Nginx configuration
echo "Testing Nginx configuration..."
nginx -t

# Reload Nginx
systemctl reload nginx

# Get SSL certificate
echo "Getting SSL certificate from Let's Encrypt..."
echo "Make sure your domain $DOMAIN_NAME points to this server's IP: 34.221.98.251"
read -p "Press Enter when DNS is configured and you're ready to get SSL certificate..."

# Get email for Let's Encrypt
read -p "Enter your email for Let's Encrypt notifications: " EMAIL
if [ -z "$EMAIL" ]; then
    EMAIL="admin@studentagent.site"
    echo "Using default email: $EMAIL"
fi

certbot --nginx -d $DOMAIN_NAME --non-interactive --agree-tos --email $EMAIL

# Certbot automatically creates the HTTPS server block, now we'll add security settings
echo "Adding additional SSL and security settings..."
CONFIG_FILE="/etc/nginx/conf.d/student-agent.conf"

# Fix http2 directive syntax (Certbot may use old syntax)
sed -i 's/listen 443 ssl http2;/listen 443 ssl;\n    http2 on;/' $CONFIG_FILE || true

# Add SSL and security settings after ssl_certificate_key in the HTTPS server block
sed -i '/ssl_certificate_key/a\
\
    # Additional SSL configuration\
    ssl_protocols TLSv1.2 TLSv1.3;\
    ssl_ciphers HIGH:!aNULL:!MD5;\
    ssl_prefer_server_ciphers on;\
\
    # Security headers\
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;\
    add_header X-Frame-Options "SAMEORIGIN" always;\
    add_header X-Content-Type-Options "nosniff" always;\
    add_header X-XSS-Protection "1; mode=block" always;
' $CONFIG_FILE

# Test and reload Nginx
nginx -t
systemctl reload nginx

# Set up auto-renewal
echo "Setting up SSL certificate auto-renewal..."
systemctl enable certbot-renew.timer
systemctl start certbot-renew.timer

echo "=== HTTPS Setup Complete ==="
echo "Your backend is now available at: https://$DOMAIN_NAME"
echo "Update your frontend code to use: https://$DOMAIN_NAME"

