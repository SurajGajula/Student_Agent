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

# Create initial Nginx config
echo "Creating Nginx configuration..."
cat > /etc/nginx/conf.d/student-agent.conf <<EOF
# HTTP server - redirects to HTTPS
server {
    listen 80;
    server_name $DOMAIN_NAME;
    
    # For Let's Encrypt certificate validation
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    # Redirect all HTTP to HTTPS
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}

# HTTPS server (will be configured by Certbot)
server {
    listen 443 ssl http2;
    server_name $DOMAIN_NAME;
    
    # SSL certificates (will be set up by Certbot)
    # ssl_certificate /etc/letsencrypt/live/$DOMAIN_NAME/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/$DOMAIN_NAME/privkey.pem;
    
    # Proxy settings for backend
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
read -p "Press Enter when DNS is configured..."

certbot --nginx -d $DOMAIN_NAME --non-interactive --agree-tos --email your-email@example.com

# Update Nginx config with proper SSL settings
echo "Updating Nginx configuration with SSL settings..."
cat >> /etc/nginx/conf.d/student-agent.conf <<'EOF'

# SSL configuration
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers HIGH:!aNULL:!MD5;
ssl_prefer_server_ciphers on;

# Security headers
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
EOF

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

