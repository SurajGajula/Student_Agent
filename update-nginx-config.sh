#!/bin/bash
# Script to update Nginx config after Certbot has set up SSL
# This modifies the existing config to serve frontend + proxy API

set -e

CONFIG_FILE="/etc/nginx/conf.d/student-agent.conf"
BACKUP_FILE="/etc/nginx/conf.d/student-agent.conf.backup"

echo "=== Updating Nginx Configuration ==="

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "Please run as root (use sudo)"
    exit 1
fi

# Backup existing config
echo "Backing up existing config..."
cp $CONFIG_FILE $BACKUP_FILE

# Check if dist folder exists
DIST_PATH="/home/ec2-user/Student_Agent/dist"
if [ ! -d "$DIST_PATH" ]; then
    echo "Error: dist folder not found at $DIST_PATH"
    echo "Please build the frontend first: npm run build:web"
    exit 1
fi

echo "Updating Nginx config to serve frontend and proxy API..."

# Create a new config file
cat > $CONFIG_FILE <<'NGINX_CONFIG'
# HTTP server - redirects to HTTPS
server {
    listen 80;
    server_name studentagent.site;
    
    # For Let's Encrypt certificate validation
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    # Redirect all HTTP to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl;
    http2 on;
    server_name studentagent.site;
    
    # SSL certificates (set up by Certbot)
    ssl_certificate /etc/letsencrypt/live/studentagent.site/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/studentagent.site/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Serve frontend static files
    root /home/ec2-user/Student_Agent/dist;
    index index.html;
    
    # API requests - proxy to backend
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Health check endpoint
    location /health {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Serve frontend files - SPA routing (try_files for React Router)
    location / {
        try_files $uri $uri/ /index.html;
    }
}
NGINX_CONFIG

# Set proper permissions
echo "Setting permissions..."
chmod -R 755 /home/ec2-user/Student_Agent/dist

# Test Nginx configuration
echo "Testing Nginx configuration..."
nginx -t

# Reload Nginx
echo "Reloading Nginx..."
systemctl reload nginx

echo "=== Configuration Updated Successfully ==="
echo "Frontend is served from: /home/ec2-user/Student_Agent/dist"
echo "API requests are proxied to: http://localhost:3001"
echo "Backup saved to: $BACKUP_FILE"

