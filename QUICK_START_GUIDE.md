# Docker Deployment - Quick Start Guide

## 📦 What's Included

This production-ready Docker setup includes:

### Files Created
- ✅ **client/Dockerfile** - Multi-stage React + Vite → Nginx
- ✅ **server/Dockerfile** - Multi-stage Node.js Express (non-root user)
- ✅ **docker-compose.yml** - Full orchestration with MySQL, Backend, Frontend
- ✅ **client/nginx.conf** - Optimized Nginx configuration
- ✅ **client/default.conf** - SPA routing, API proxy, security headers
- ✅ **.env.example** - Template for environment variables
- ✅ **init.sql** - Database schema initialization
- ✅ **DOCKER_DEPLOYMENT_GUIDE.md** - Comprehensive deployment guide
- ✅ **DOCKER_COMMANDS_REFERENCE.md** - Common Docker commands
- ✅ **PRODUCTION_READINESS_CHECKLIST.md** - Pre-deployment checklist
- ✅ **TROUBLESHOOTING.md** - Common issues and solutions
- ✅ **QUICK_START_GUIDE.md** - This file

---

## 🚀 5-Minute Quick Start (Local Testing)

### 1. Create Environment File
```bash
cp .env.example .env

# For local testing, defaults work fine, but change these:
MYSQL_ROOT_PASSWORD=localroot123
MYSQL_PASSWORD=localapp123
JWT_SECRET=$(openssl rand -base64 32)
```

### 2. Secure the File
```bash
chmod 600 .env
```

### 3. Build and Start
```bash
# Build images
docker-compose build

# Start all services
docker-compose up -d

# Wait 30 seconds for database to initialize
sleep 30

# Verify all services are running
docker-compose ps
```

### 4. Access Application
- Frontend: http://localhost
- Backend API: http://localhost:5000
- MySQL: localhost:3306 (user: appuser, password in .env)

### 5. Stop Services
```bash
docker-compose down
```

---

## 🔒 Production Deployment (VPS)

### Step 1: Prepare VPS

```bash
# SSH into VPS
ssh root@your-vps-ip

# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Create app directory
sudo mkdir -p /opt/invoice-app
cd /opt/invoice-app
```

### Step 2: Deploy Application

```bash
# Clone repository (or scp files)
git clone <your-repo-url> .

# Change ownership
sudo chown -R $USER:$USER .

# Create .env with production values
cp .env.example .env
nano .env
# Update all values, especially:
# - MYSQL_ROOT_PASSWORD (strong random)
# - MYSQL_PASSWORD (strong random)
# - JWT_SECRET (use: openssl rand -base64 32)
# - CORS_ORIGIN (your domain)
# - VITE_API_BASE_URL (your API domain)

# Secure environment file
chmod 600 .env
```

### Step 3: Configure Domain & SSL

```bash
# Point DNS to VPS IP
# Then install SSL certificate using Let's Encrypt

sudo apt install certbot -y

sudo certbot certonly --standalone -d yourdomain.com -d api.yourdomain.com

# Copy certificates
mkdir -p certs
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem certs/cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem certs/key.pem
sudo chown $USER:$USER certs/*
```

### Step 4: Build and Deploy

```bash
# Build production images
docker-compose build

# Start services
docker-compose up -d

# Verify services running
docker-compose ps

# Monitor logs
docker-compose logs -f
```

### Step 5: Verify Deployment

```bash
# Test frontend
curl https://yourdomain.com

# Test backend
curl https://yourdomain.com/api/

# Check database
docker-compose exec db mysql -u appuser -p invoice_db -e "SELECT VERSION();"
```

### Step 6: Setup Monitoring & Backups

```bash
# Create backup script
nano backup.sh
# (Copy content from DOCKER_DEPLOYMENT_GUIDE.md)

chmod +x backup.sh

# Schedule daily backups
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/invoice-app/backup.sh") | crontab -
```

---

## 🔐 Essential Security Steps

### Before Going Live (REQUIRED)

```bash
# 1. Change all default credentials
# Edit .env file with strong passwords

# 2. Verify .env is secure
ls -la .env
# Should show: -rw------- 1 user user ...

# 3. Check .env is in .gitignore
grep "\.env$" .gitignore

# 4. Verify environment variables loaded
docker-compose exec backend env | grep -E "MYSQL|JWT"

# 5. Configure firewall
sudo ufw default deny incoming
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# 6. Test SSL certificate
curl -I https://yourdomain.com
# Should show 200 OK and certificate info

# 7. Test database security
docker-compose exec db mysql -u root -p'$MYSQL_ROOT_PASSWORD' 2>&1 | head -5
# Should connect successfully

# 8. Verify no sensitive data in logs
docker-compose logs backend | grep -E "password|secret|token" | grep -v "PASSWORD="
# Should return nothing
```

---

## 📊 Key Architecture Details

### Network Isolation
```
                    ┌─ MySQL (Internal Only)
                    │
Nginx (Port 80/443) ─┼─ Node.js Backend (Internal)
                    │
                    └─ All connected via 'app-network' bridge
```

### Volume Persistence
- **mysql_data** → `/var/lib/mysql` (database files)
- **uploads_data** → `/app/upload`, `/app/uploads` (user files)

### Health Checks
- MySQL: `mysqladmin ping` every 10s
- Backend: `curl http://localhost:5000/` every 30s
- Frontend: `wget http://localhost/` every 30s

### Non-Root Security
- Backend runs as `nodejs` (UID 1001)
- Frontend runs as `nginx` (UID 101)
- Database runs as `mysql` (UID 999)

---

## 📝 Configuration Files Reference

| File | Purpose | Modification |
|------|---------|--------------|
| `.env` | Secrets & config | **REQUIRED** - Create from `.env.example` |
| `docker-compose.yml` | Service orchestration | Optional - adjust ports/resources if needed |
| `client/Dockerfile` | Frontend build | Rarely modify unless changing Node/Nginx versions |
| `server/Dockerfile` | Backend build | Rarely modify unless changing Node version |
| `client/nginx.conf` | Nginx base config | Modify for SSL, caching, performance tuning |
| `client/default.conf` | Nginx site config | Modify for domain-specific routing |
| `init.sql` | Database schema | Modify to add custom tables/data |

---

## ⚡ Common Operations

### View Logs
```bash
docker-compose logs -f backend
docker-compose logs backend --tail=100
```

### Connect to Database
```bash
docker-compose exec db mysql -u appuser -p invoice_db
```

### Backup Data
```bash
docker-compose exec db mysqldump -u appuser -p invoice_db > backup.sql
```

### Restart Service
```bash
docker-compose restart backend
docker-compose down && docker-compose up -d
```

### Update Application
```bash
git pull
docker-compose build --no-cache
docker-compose up -d
```

---

## 🐛 Quick Troubleshooting

| Issue | Command | Solution |
|-------|---------|----------|
| Services won't start | `docker-compose logs` | Check logs for errors |
| Can't reach database | `docker-compose exec backend ping db` | Wait 30s, check health |
| API not accessible | `curl http://localhost:5000/` | Check backend container |
| Uploads not persisting | `docker volume ls \| grep uploads` | Verify volume mount |
| Out of memory | `docker stats` | `docker system prune -a` |
| Port already in use | `sudo lsof -i :80` | Kill process or change port |

See **TROUBLESHOOTING.md** for detailed solutions.

---

## 📚 Full Documentation

For more details, see:

1. **[DOCKER_DEPLOYMENT_GUIDE.md](DOCKER_DEPLOYMENT_GUIDE.md)**
   - Complete setup instructions
   - Security best practices
   - SSL/HTTPS configuration
   - Monitoring and maintenance
   - Backup and recovery

2. **[PRODUCTION_READINESS_CHECKLIST.md](PRODUCTION_READINESS_CHECKLIST.md)**
   - Pre-deployment verification
   - Security review
   - Testing procedures
   - Post-launch tasks

3. **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)**
   - Common issues and solutions
   - Debug commands
   - Performance optimization
   - Getting help

4. **[DOCKER_COMMANDS_REFERENCE.md](DOCKER_COMMANDS_REFERENCE.md)**
   - Quick command reference
   - Service management
   - Debugging tools
   - Backup operations

---

## ✅ Pre-Launch Checklist (5 Minutes)

- [ ] `.env` file created and secured (`chmod 600 .env`)
- [ ] All passwords changed from defaults
- [ ] JWT secret generated (`openssl rand -base64 32`)
- [ ] `docker-compose.yml` validated (`docker-compose config --quiet`)
- [ ] Images built (`docker-compose build`)
- [ ] Services starting successfully (`docker-compose up -d`)
- [ ] All services healthy (`docker-compose ps` shows all "Up")
- [ ] Frontend accessible (http://localhost/)
- [ ] Backend responding (curl http://localhost:5000/)
- [ ] Database connected (`docker-compose exec db mysqladmin ping`)
- [ ] SSL certificate installed (if production)
- [ ] Firewall configured (if VPS)
- [ ] Backups scheduled (if production)

---

## 🆘 Need Help?

### For Issues:
1. Check **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)**
2. Review logs: `docker-compose logs`
3. Verify configuration: `docker-compose config`
4. Check resources: `docker stats`

### For Questions:
- Docker Docs: https://docs.docker.com/
- Compose Docs: https://docs.docker.com/compose/
- MySQL Docs: https://dev.mysql.com/doc/
- Nginx Docs: https://nginx.org/en/docs/

---

**Created:** July 4, 2024  
**Status:** Production Ready  
**Last Updated:** July 4, 2024

