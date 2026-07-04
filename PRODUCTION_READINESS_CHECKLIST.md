# Production Readiness Checklist

## 🔐 Security

### Credentials & Secrets
- [ ] Generated strong JWT secret (32+ characters): `openssl rand -base64 32`
- [ ] Generated strong MySQL root password (24+ characters)
- [ ] Generated strong MySQL app password (20+ characters)
- [ ] All credentials stored in `.env` file (never in code)
- [ ] `.env` file has restrictive permissions: `chmod 600 .env`
- [ ] `.env` file is listed in `.gitignore`
- [ ] `.env` file is NOT committed to git
- [ ] Created `.env.example` with safe defaults (no secrets)
- [ ] Secrets rotated from defaults in docker-compose.yml

### User Access
- [ ] App runs as non-root user in both backend and frontend containers
- [ ] Database user has minimal required permissions (not root)
- [ ] SSH key-based authentication configured on VPS
- [ ] Sudo password-based access disabled
- [ ] Root SSH login disabled
- [ ] SSH port changed from 22 (optional but recommended)

### Network Security
- [ ] Firewall configured (UFW/iptables)
  - [ ] SSH (22 or custom) - allow from specific IPs if possible
  - [ ] HTTP (80) - allow from anywhere
  - [ ] HTTPS (443) - allow from anywhere
  - [ ] MySQL (3306) - blocked/only internal
  - [ ] Backend (5000) - blocked/only internal
- [ ] Docker bridge network isolates internal services
- [ ] Only frontend (Nginx) exposed to public internet
- [ ] Backend and DB not accessible from outside

### SSL/TLS Certificates
- [ ] SSL certificates obtained (Let's Encrypt recommended)
- [ ] Certificates stored securely outside git repo
- [ ] Certificate renewal automated (systemd timer or cron)
- [ ] Nginx configured for HTTPS
- [ ] HTTP traffic redirected to HTTPS
- [ ] SSL/TLS version 1.2+ enforced
- [ ] Weak ciphers disabled

### Data Protection
- [ ] Database backups scheduled
- [ ] Backups encrypted and stored off-site
- [ ] Upload directory permissions set correctly (755)
- [ ] Sensitive logs don't contain credentials
- [ ] Rate limiting implemented on API endpoints
- [ ] CORS properly configured (specific domains, not *)
- [ ] CSRF tokens implemented

## 🏗️ Infrastructure Setup

### VPS Configuration
- [ ] VPS provisioned with adequate resources (2GB+ RAM, 10GB+ disk)
- [ ] OS fully updated: `sudo apt update && sudo apt upgrade -y`
- [ ] Timezone configured correctly
- [ ] System time synchronized (NTP)
- [ ] Swap configured (if < 4GB RAM)

### Docker Installation
- [ ] Docker installed and updated
- [ ] Docker daemon auto-start enabled: `sudo systemctl enable docker`
- [ ] Docker Compose installed (v1.29+)
- [ ] Current user added to docker group: `sudo usermod -aG docker $USER`

### File System
- [ ] Application code cloned to `/opt/invoice-app` (or preferred location)
- [ ] Proper ownership: `sudo chown -R $USER:$USER /opt/invoice-app`
- [ ] Proper permissions: `chmod 700 /opt/invoice-app`
- [ ] Sufficient disk space available (check with `df -h`)
- [ ] Upload directories exist with correct permissions

## 📋 Application Configuration

### Environment Variables
- [ ] `.env` file created (from `.env.example`)
- [ ] All required variables populated
- [ ] Node environment set to `production`
- [ ] Debug mode disabled
- [ ] Log levels set appropriately
- [ ] CORS origin configured for production domain
- [ ] SMTP credentials valid and tested
- [ ] Database credentials secure and strong
- [ ] API rate limits configured

### Docker Compose
- [ ] `docker-compose.yml` validated: `docker-compose config --quiet`
- [ ] Service names correct (backend, frontend, db)
- [ ] Port bindings correct
- [ ] Volume mounts correct
- [ ] Health checks configured for all services
- [ ] Restart policies set to `unless-stopped`
- [ ] Resource limits configured (optional)
- [ ] Networks properly isolated

### Database
- [ ] MySQL image version specified (8.0+)
- [ ] Database initialized with `init.sql`
- [ ] Tables and indexes created
- [ ] Initial data seeded (if needed)
- [ ] Database user created with limited permissions
- [ ] Root password changed from default
- [ ] Character set set to utf8mb4
- [ ] `log_bin_trust_function_creators` enabled

### Backend Configuration
- [ ] Backend Dockerfile uses multi-stage build
- [ ] Dependencies installed with `npm ci` (not `npm install`)
- [ ] Non-root user (UID 1001) created and used
- [ ] Upload directories created with correct permissions
- [ ] Health check configured
- [ ] Port exposed (5000)
- [ ] Environment variables passed correctly
- [ ] `depends_on` configured with `service_healthy` condition
- [ ] Development dependencies excluded from production build

### Frontend Configuration
- [ ] Frontend Dockerfile uses multi-stage build
- [ ] Build stage uses Node.js
- [ ] Production stage uses Nginx
- [ ] Static assets built and optimized
- [ ] Nginx gzip compression enabled
- [ ] Nginx cache headers configured
- [ ] SPA routing configured (try_files directive)
- [ ] API proxy configured
- [ ] Security headers configured
- [ ] Health check configured

### Nginx Configuration
- [ ] SSL/TLS configured and enabled
- [ ] HTTP redirects to HTTPS
- [ ] Security headers set (X-Frame-Options, CSP, etc.)
- [ ] Gzip compression enabled
- [ ] Client body size limit set appropriately
- [ ] Cache-Control headers for static assets
- [ ] CORS headers if needed
- [ ] Upstream backend configured correctly
- [ ] Logging configured

## ✅ Testing & Validation

### Build & Startup
- [ ] Docker images build successfully: `docker-compose build`
- [ ] All services start successfully: `docker-compose up -d`
- [ ] All services show as "Up" after 30 seconds: `docker-compose ps`
- [ ] No error messages in logs: `docker-compose logs`

### Health Checks
- [ ] Frontend responds: `curl http://localhost/`
- [ ] Backend responds: `curl http://localhost:5000/`
- [ ] Database connects: `docker-compose exec db mysqladmin ping`
- [ ] All health checks pass: `docker-compose ps` shows "healthy"

### API Connectivity
- [ ] Frontend can reach backend API
- [ ] API returns proper JSON responses
- [ ] CORS headers present
- [ ] Rate limiting working (if configured)
- [ ] Authentication endpoints functional
- [ ] File upload endpoints working
- [ ] Socket.io connections working

### Database Operations
- [ ] Can connect to MySQL: `docker-compose exec db mysql -u appuser -p invoice_db`
- [ ] Can query tables: `SELECT * FROM tbl_users;`
- [ ] Can insert test data
- [ ] Can update and delete records
- [ ] Transactions work correctly
- [ ] Foreign keys enforced

### File Upload/Storage
- [ ] Files can be uploaded to `/app/upload`
- [ ] Files persist after container restart
- [ ] Files accessible from frontend
- [ ] Permissions correct (non-root user can write)
- [ ] Volume mount working correctly
- [ ] Backups include upload files

### Performance
- [ ] Frontend loads in < 3 seconds
- [ ] API responses < 500ms
- [ ] Database queries optimized with indexes
- [ ] No memory leaks (check `docker stats`)
- [ ] CPU usage reasonable (check `docker stats`)
- [ ] Disk I/O acceptable

## 📊 Monitoring & Logging

### Logging
- [ ] Container logs accessible: `docker-compose logs`
- [ ] Log rotation configured
- [ ] No sensitive data in logs
- [ ] Errors logged with full context
- [ ] Audit logs captured for important actions

### Monitoring
- [ ] Resource usage monitoring set up (`docker stats`)
- [ ] Disk space monitoring configured
- [ ] Memory usage alerts configured
- [ ] Service uptime monitoring configured
- [ ] Error rate monitoring configured

### Alerting
- [ ] Alert system configured (email/Slack/PagerDuty)
- [ ] High disk usage alerts
- [ ] Service down alerts
- [ ] High error rate alerts
- [ ] Database connection failure alerts

## 💾 Backup & Disaster Recovery

### Backup Strategy
- [ ] Database backup script created
- [ ] Upload files backup script created
- [ ] Backups automated with cron: `0 2 * * * /opt/invoice-app/backup.sh`
- [ ] Backup retention policy defined (e.g., 30 days)
- [ ] Backups stored securely (encrypted, off-site)

### Recovery Testing
- [ ] Database restore tested from backup
- [ ] File restore tested from backup
- [ ] RTO (Recovery Time Objective) acceptable
- [ ] RPO (Recovery Point Objective) acceptable
- [ ] Disaster recovery runbook created

## 📝 Documentation

### Deployment Documentation
- [ ] Architecture diagram created
- [ ] Deployment procedure documented
- [ ] Configuration documented
- [ ] Secrets management documented
- [ ] Monitoring procedure documented

### Operational Runbooks
- [ ] Service startup/shutdown procedures
- [ ] Deployment update procedure
- [ ] Rollback procedure
- [ ] Troubleshooting guide created
- [ ] Incident response procedure

### Code Documentation
- [ ] README updated with production info
- [ ] Environment variables documented
- [ ] API endpoints documented
- [ ] Database schema documented

## 🚀 Pre-Production Verification

### Final Checklist
- [ ] All above checklist items completed
- [ ] Team reviewed configuration
- [ ] Stakeholders approved deployment
- [ ] Backup test successful (restore works)
- [ ] Load testing completed (optional)
- [ ] Security audit completed (optional)
- [ ] DNS records updated and propagated
- [ ] SSL certificate installed and working
- [ ] Monitoring alerts tested
- [ ] 24/7 on-call support arranged

### Launch Day
- [ ] Team available for 24 hours post-launch
- [ ] Monitoring actively watched
- [ ] Backup procedures verified
- [ ] Communication channels open
- [ ] Rollback plan reviewed
- [ ] Post-launch sign-off obtained

## 🔄 Post-Deployment

### Weekly Tasks
- [ ] Review error logs
- [ ] Check backup completion
- [ ] Verify disk space
- [ ] Monitor service uptime

### Monthly Tasks
- [ ] Review and optimize database indexes
- [ ] Test disaster recovery procedures
- [ ] Update dependencies (if needed)
- [ ] Review security logs
- [ ] Update SSL certificate (if expiring soon)

### Quarterly Tasks
- [ ] Security assessment
- [ ] Performance optimization review
- [ ] Capacity planning
- [ ] Incident retrospectives

---

**Last Updated:** 2024-07-04  
**Prepared By:** [Your Team]  
**Approval Date:** [TBD]

