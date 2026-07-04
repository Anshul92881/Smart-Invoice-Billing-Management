# Docker Deployment Guide - Production Setup

## 📋 Overview

This guide covers deploying your full-stack invoice management application using Docker and Docker Compose on a VPS with MySQL, Node.js Express backend, and React frontend.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│          Internet / DNS                      │
└─────────────────────┬───────────────────────┘
                      │
┌─────────────────────▼───────────────────────┐
│      Nginx (Frontend) - Port 80/443         │
│      - Serves React SPA                     │
│      - Routes /api/* to backend             │
└─────────────────────┬───────────────────────┘
                      │
         ┌────────────┼────────────┐
         │                         │
    ┌────▼─────────┐      ┌────────▼──────┐
    │  Node.js     │      │    MySQL      │
    │  Backend     │      │    Database   │
    │  Port 5000   │      │    Port 3306  │
    └──────────────┘      └───────────────┘
         │                         │
    [uploads_data volume]  [mysql_data volume]
```

## 🚀 Getting Started

### Prerequisites

- VPS with Docker and Docker Compose installed
- Linux/Unix-based OS (Ubuntu 20.04+ recommended)
- At least 2GB RAM and 10GB disk space
- Domain name (optional, for SSL setup)

### 1. Install Docker and Docker Compose

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add current user to docker group (requires logout/login)
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version
```

### 2. Prepare Your VPS

```bash
# Clone your repository
git clone <your-repo-url> /opt/invoice-app
cd /opt/invoice-app

# Set proper permissions
sudo chown -R $USER:$USER .
chmod 700 .
```

### 3. Configure Environment Variables

```bash
# Create .env from template
cp .env.example .env

# Edit .env with your production values
nano .env
```

**Critical Environment Variables to Update:**

```env
# Database
MYSQL_ROOT_PASSWORD=<strong-random-password>
MYSQL_PASSWORD=<strong-random-password>

# JWT Secret (use strong random value)
JWT_SECRET=<generate-with: openssl rand -base64 32>

# Email Service (Gmail example)
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-specific-password

# Domain
CORS_ORIGIN=https://yourdomain.com
VITE_API_BASE_URL=https://api.yourdomain.com
```

### 4. Generate Strong Secrets

```bash
# Generate JWT Secret
openssl rand -base64 32

# Generate database password
openssl rand -base64 20

# Generate root password
openssl rand -base64 24
```

### 5. Secure the .env File

```bash
# Restrict permissions (only owner can read)
chmod 600 .env

# Verify permissions
ls -la .env
# Should show: -rw------- 1 user user ...
```

### 6. Create Database Initialization Script (Optional)

Create `init.sql` for initial schema:

```bash
cat > init.sql << 'EOF'
-- Your initial database schema and seed data
-- This runs automatically when MySQL container starts
USE invoice_db;

-- Add your tables and initial data here
EOF
```

### 7. Build and Start Services

```bash
# Build images
docker-compose build

# Start services in background
docker-compose up -d

# View logs
docker-compose logs -f

# Check service status
docker-compose ps
```

## 🔐 Security Best Practices

### 1. Environment Variables

✅ **DO:**
- Use strong, randomly generated passwords
- Store `.env` outside version control
- Use `.env.example` as template in git
- Rotate secrets regularly

❌ **DON'T:**
- Commit `.env` to git
- Use default passwords
- Share secrets via email/chat
- Hardcode credentials in code

### 2. File Permissions

```bash
# .env file (owner read-only)
chmod 600 .env

# Uploads directory (accessible to app)
sudo chown -R 1001:1001 ./server/upload ./server/uploads
sudo chmod -R 755 ./server/upload ./server/uploads
```

### 3. Database Security

```bash
# Connect to MySQL and add users
docker-compose exec db mysql -u root -p

# Inside MySQL:
-- Create additional users for backups
CREATE USER 'backup_user'@'%' IDENTIFIED BY 'backup_password';
GRANT SELECT, LOCK TABLES ON invoice_db.* TO 'backup_user'@'%';

-- Disable root login over network
DELETE FROM mysql.user WHERE User='root' AND Host NOT IN ('localhost', '127.0.0.1', '::1');
FLUSH PRIVILEGES;
```

### 4. SSL/HTTPS Setup with Nginx

Update `client/default.conf` to include SSL:

```nginx
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    
    ssl_certificate /etc/nginx/certs/cert.pem;
    ssl_certificate_key /etc/nginx/certs/key.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # ... rest of config
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name _;
    return 301 https://$host$request_uri;
}
```

Obtain SSL certificates using Let's Encrypt:

```bash
# Using Certbot
sudo apt install certbot python3-certbot-nginx -y

sudo certbot certonly --standalone -d yourdomain.com -d api.yourdomain.com

# Copy to volumes
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ./certs/cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ./certs/key.pem
sudo chown $USER:$USER ./certs/*.pem
```

### 5. Firewall Configuration

```bash
# Install UFW (if not installed)
sudo apt install ufw -y

# Allow SSH, HTTP, HTTPS only
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Block internal ports (DB, backend)
# (Already blocked by docker bridge network isolation)
```

## 📊 Monitoring and Maintenance

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f db
docker-compose logs -f frontend

# Last 100 lines
docker-compose logs --tail=100 backend
```

### Check Resource Usage

```bash
docker stats
```

### Health Status

```bash
docker-compose ps
# Shows UP (healthy) or status
```

### Access Services

```bash
# MySQL CLI
docker-compose exec db mysql -u appuser -p invoice_db

# Backend bash
docker-compose exec backend sh

# Frontend bash
docker-compose exec frontend sh
```

## 💾 Backup and Recovery

### Backup Database

```bash
# Manual backup
docker-compose exec db mysqldump -u appuser -p invoice_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore from backup
docker-compose exec db mysql -u appuser -p invoice_db < backup_20240704_120000.sql
```

### Backup Uploads

```bash
# Backup upload volume
docker run --rm -v invoice_uploads_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/uploads_backup_$(date +%Y%m%d_%H%M%S).tar.gz -C /data .

# Restore uploads
docker run --rm -v invoice_uploads_data:/data -v $(pwd):/backup \
  alpine tar xzf /backup/uploads_backup.tar.gz -C /data
```

### Create Backup Script

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Database backup
docker-compose exec db mysqldump -u appuser -p"${MYSQL_PASSWORD}" invoice_db | \
  gzip > $BACKUP_DIR/db_${TIMESTAMP}.sql.gz

# Uploads backup
docker run --rm -v invoice_uploads_data:/data -v $BACKUP_DIR:/backup \
  alpine tar czf /backup/uploads_${TIMESTAMP}.tar.gz -C /data .

# Keep only last 30 days
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete

echo "Backup completed: $TIMESTAMP"
```

Schedule with crontab:
```bash
0 2 * * * /opt/invoice-app/backup.sh >> /var/log/invoice-backup.log 2>&1
```

## 🐛 Troubleshooting

### Services Won't Start

```bash
# Check logs
docker-compose logs

# Check for port conflicts
sudo lsof -i :80
sudo lsof -i :5000
sudo lsof -i :3306

# Rebuild images
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Database Connection Refused

```bash
# Ensure db is healthy
docker-compose ps db

# Wait and retry
docker-compose restart backend

# Check database logs
docker-compose logs db
```

### Uploads Not Persisting

```bash
# Check volume mounting
docker-compose exec backend ls -la /app/upload

# Verify volume exists
docker volume ls | grep uploads

# Check permissions
docker-compose exec backend stat /app/upload
```

### Out of Disk Space

```bash
# Check disk usage
df -h

# Clean up unused Docker objects
docker system prune -a

# Remove orphaned volumes
docker volume prune
```

## 🔄 Updates and Redeployment

```bash
# Pull latest code
git pull

# Rebuild images
docker-compose build

# Stop old services
docker-compose down

# Start new services
docker-compose up -d

# Verify health
docker-compose ps
```

## ✅ Production Checklist

- [ ] `.env` file created and secured (chmod 600)
- [ ] Strong passwords generated for all services
- [ ] JWT secret changed from default
- [ ] SMTP credentials configured
- [ ] SSL/HTTPS certificates installed
- [ ] Firewall configured (SSH, HTTP, HTTPS only)
- [ ] Backup scripts created and tested
- [ ] Database backups scheduled
- [ ] Monitoring/alerts configured
- [ ] Health checks verified (`docker-compose ps`)
- [ ] Logs monitored for errors
- [ ] DNS records pointed to VPS

## 📞 Support

For issues or questions, refer to:
- Docker Documentation: https://docs.docker.com/
- Docker Compose: https://docs.docker.com/compose/
- MySQL Docker: https://hub.docker.com/_/mysql
- Nginx: https://hub.docker.com/_/nginx

