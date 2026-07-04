# Docker Deployment Troubleshooting Guide

## 🔴 Common Issues and Solutions

### 1. Services Won't Start

#### Symptom: `docker-compose up` fails or containers keep restarting

```bash
# First, check logs
docker-compose logs -f

# Common causes and solutions:
```

**Solution A: Port Already in Use**
```bash
# Check which process is using the port
sudo lsof -i :80
sudo lsof -i :5000
sudo lsof -i :3306

# Kill the process or change port in docker-compose.yml
sudo kill -9 <PID>
# OR update ports in .env or docker-compose.yml
```

**Solution B: Out of Memory**
```bash
# Check available memory
free -h

# Stop unnecessary services
docker system prune -a

# Restart Docker daemon
sudo systemctl restart docker
```

**Solution C: Corrupted Volumes**
```bash
# Remove and recreate volumes
docker-compose down -v
docker-compose up -d
```

---

### 2. Database Connection Refused

#### Symptom: Backend can't connect to MySQL

```
Error: connect ECONNREFUSED 127.0.0.1:3306
```

**Solution A: Database Not Healthy**
```bash
# Check database status
docker-compose ps db

# Should show: healthy status

# If not healthy, check logs
docker-compose logs db

# Common causes:
# - MySQL still initializing (wait 30s)
# - Wrong credentials in .env
# - Insufficient disk space
# - Corrupted data files
```

**Solution B: Backend Starting Too Early**
```bash
# Ensure proper depends_on with health check
# In docker-compose.yml:
depends_on:
  db:
    condition: service_healthy

# Rebuild and restart
docker-compose down
docker-compose up -d
```

**Solution C: Network Issues**
```bash
# Check if backend can reach db
docker-compose exec backend ping db

# If failed, check network
docker network ls
docker network inspect invoice_network

# Recreate network if needed
docker-compose down
docker network rm invoice_network
docker-compose up -d
```

---

### 3. Frontend Can't Reach Backend API

#### Symptom: API calls fail with CORS or connection error

**Solution A: Backend URL Incorrect**
```bash
# Check frontend configuration
docker-compose exec frontend cat /etc/nginx/conf.d/default.conf

# Verify backend upstream
upstream backend {
    server backend:5000;  # Should be 'backend', not 'localhost'
}
```

**Solution B: Backend Not Responding**
```bash
# Check backend status
docker-compose ps backend

# Test backend manually
curl http://localhost:5000/

# If fails, check backend logs
docker-compose logs -f backend
```

**Solution C: CORS Issues**
```bash
# Check backend CORS configuration
# In server/.env
CORS_ORIGIN=http://localhost:5173  # or your frontend URL

# For docker: should be frontend domain or http://frontend
# Verify backend is sending CORS headers
curl -i http://localhost:5000/
# Should see: Access-Control-Allow-Origin header
```

**Solution D: Nginx Routing**
```bash
# Verify Nginx proxy configuration
docker-compose exec frontend cat /etc/nginx/conf.d/default.conf

# Should have:
location /api {
    proxy_pass http://backend:5000;
    ...
}
```

---

### 4. File Uploads Not Working

#### Symptom: Files uploaded but not accessible, or upload fails

**Solution A: Directory Permissions**
```bash
# Check upload directory permissions
docker-compose exec backend ls -la /app/upload

# Should show: drwxr-xr-x 2 nodejs nodejs

# Fix permissions
docker-compose exec backend chmod 755 /app/upload
docker-compose exec backend chown -R nodejs:nodejs /app/upload
```

**Solution B: Volume Not Mounted**
```bash
# Verify volume mount
docker inspect $(docker-compose ps -q backend) | grep Mounts

# Should show:
# "Source": "/var/lib/docker/volumes/invoice_uploads_data/_data"
# "Destination": "/app/upload"

# If not mounted, restart service
docker-compose down
docker volume ls
docker volume rm invoice_uploads_data  # if needed
docker-compose up -d
```

**Solution C: Frontend Can't Access Uploads**
```bash
# Check if uploads endpoint is proxied
docker-compose exec frontend cat /etc/nginx/conf.d/default.conf

# Should have:
location ~^/(upload|uploads)/ {
    proxy_pass http://backend;
}

# Test endpoint
curl http://localhost/upload/test.txt
```

---

### 5. Database Disk Space Full

#### Symptom: MySQL crashes, slow queries, can't insert data

```bash
# Check disk usage
df -h

# Check Docker volumes usage
docker system df

# Clean up old data
# Backup first!
docker-compose exec db mysql -u appuser -p invoice_db
> PURGE BINARY LOGS BEFORE DATE_SUB(NOW(), INTERVAL 30 DAY);
```

---

### 6. Out of Disk Space

#### Symptom: `no space left on device`

```bash
# Check disk usage
df -h /

# Find large files
du -sh * | sort -hr | head -10

# Docker volumes taking space
docker system df

# Clean up strategy
# 1. Clean up unused containers/images
docker system prune -a

# 2. Remove unused volumes
docker volume prune

# 3. If VPS disk full, may need to expand:
# AWS: EBS volume resize
# DigitalOcean: Block storage
# Linode: Resize disk
```

---

### 7. High Memory Usage

#### Symptom: `docker stats` shows memory > 80%

```bash
# Check which service is using memory
docker stats --no-stream

# For Node.js backend memory leak:
# Check application logs
docker-compose logs backend | tail -100

# Restart service to free memory
docker-compose restart backend

# If persistent, check for memory leaks in code
# Enable memory profiling or heap dumps

# Limit container memory in docker-compose.yml:
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 512M
        reservations:
          memory: 256M
```

---

### 8. Certificate/SSL Issues

#### Symptom: HTTPS not working, certificate errors

```bash
# Check certificate
docker-compose exec frontend ls -la /etc/nginx/certs/

# Verify certificate validity
openssl x509 -in /etc/letsencrypt/live/yourdomain.com/cert.pem -text -noout

# Check certificate expiration
echo | openssl s_client -servername yourdomain.com -connect yourdomain.com:443 2>/dev/null | openssl x509 -noout -dates

# Renew certificate (before expiry)
sudo certbot renew --dry-run  # Test
sudo certbot renew             # Actual renewal

# Copy renewed cert to Docker
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ./certs/cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ./certs/key.pem
sudo chown $USER:$USER ./certs/*.pem

# Restart frontend
docker-compose restart frontend
```

---

### 9. Application Crashes Immediately After Start

#### Symptom: Container starts then immediately stops

```bash
# Check exit code
docker-compose ps backend

# Example: Exit Code: 1

# Check logs for error
docker-compose logs backend | tail -50

# Common causes:
# 1. Missing environment variable
# 2. Database not initialized
# 3. Port already in use
# 4. Invalid configuration

# Solutions:
# - Verify .env file: docker-compose exec backend env | sort
# - Check required packages: docker-compose exec backend npm list
# - Rebuild if code changed: docker-compose build --no-cache backend
```

---

### 10. Slow Performance

#### Symptom: Application is slow, timeouts occur

**Solution A: Database Optimization**
```bash
# Check slow queries
docker-compose exec db mysql -u appuser -p invoice_db
> SELECT * FROM mysql.slow_log;

# Enable slow query log (if not enabled)
# In docker-compose.yml command section:
command:
  - --slow_query_log=1
  - --slow_query_log_file=/var/log/mysql/slow-query.log
  - --long_query_time=2
```

**Solution B: Check Resource Limits**
```bash
# Monitor in real-time
watch -n 1 'docker stats --no-stream'

# If CPU/Memory maxed, need to:
# 1. Optimize code
# 2. Increase container resources
# 3. Scale horizontally (multiple instances)
```

**Solution C: Network Latency**
```bash
# Check inter-service latency
docker-compose exec backend ping db
docker-compose exec backend ping frontend

# Acceptable: < 1ms for local network
```

---

### 11. Database Backup/Restore Issues

#### Symptom: Backups fail or won't restore

**Solution A: Backup Fails**
```bash
# Check available disk space
df -h

# Verify database accessibility
docker-compose exec db mysql -u appuser -p invoice_db -e "SELECT 1;"

# Run backup with proper credentials
docker-compose exec db mysqldump -u appuser -p'<password>' invoice_db > backup.sql

# Verify backup file
ls -lh backup.sql
file backup.sql  # Should be MySQL dump format
```

**Solution B: Restore Fails**
```bash
# Verify backup file integrity
head -5 backup.sql  # Should show SQL comments

# Restore with error output
docker-compose exec db mysql -u appuser -p'<password>' invoice_db < backup.sql 2>&1 | tail -20

# If foreign key error:
docker-compose exec db mysql -u appuser -p'<password>' invoice_db
> SET FOREIGN_KEY_CHECKS = 0;
> SOURCE backup.sql;
> SET FOREIGN_KEY_CHECKS = 1;
```

---

### 12. Network Connectivity Issues

#### Symptom: Container can't reach another container

```bash
# Test connectivity
docker-compose exec backend ping db
docker-compose exec backend ping frontend

# Check network
docker network inspect invoice_network

# Verify DNS resolution
docker-compose exec backend nslookup db
docker-compose exec backend nslookup frontend

# If DNS fails, restart Docker daemon
sudo systemctl restart docker
docker-compose restart
```

---

## 🔧 Debug Commands Cheat Sheet

```bash
# Basic troubleshooting
docker-compose ps                          # Check service status
docker-compose logs -f                     # View all logs
docker-compose logs -f backend             # View backend logs
docker-compose config                      # Validate compose file
docker ps -a                               # List all containers
docker volume ls                           # List all volumes

# Enter container shell
docker-compose exec backend sh
docker-compose exec db bash
docker-compose exec frontend sh

# Check resources
docker stats
docker system df
df -h

# Network troubleshooting
docker network ls
docker network inspect invoice_network
docker-compose exec backend ping db
docker-compose exec backend curl http://backend:5000/

# Database operations
docker-compose exec db mysql -u appuser -p invoice_db
docker-compose exec db mysqladmin ping
docker-compose exec db mysqldump -u appuser -p invoice_db

# Environment variables
docker-compose exec backend env | sort
docker inspect $(docker-compose ps -q backend) | grep Env

# Restart services
docker-compose restart backend
docker-compose restart db
docker-compose restart frontend

# Rebuild and restart
docker-compose build --no-cache backend
docker-compose down
docker-compose up -d

# Clean up
docker system prune -a              # Remove unused images/containers
docker volume prune                 # Remove unused volumes
docker image rm <image-id>          # Remove specific image
docker volume rm <volume-name>      # Remove specific volume

# Logs analysis
docker-compose logs backend | grep ERROR
docker-compose logs backend --tail 100 | head -20
docker-compose logs --timestamps backend
```

---

## 📞 Getting Help

### Before Escalating

1. **Check logs comprehensively**
   ```bash
   docker-compose logs backend > debug.log 2>&1
   # Review the entire log file
   ```

2. **Verify configuration**
   ```bash
   docker-compose config > config.dump
   # Review entire configuration
   ```

3. **Test each service individually**
   ```bash
   docker-compose ps
   # Ensure each shows healthy
   ```

4. **Check system resources**
   ```bash
   df -h
   free -h
   docker system df
   ```

### Collect Information for Support

```bash
# Create debug bundle
mkdir debug_bundle
docker-compose logs backend > debug_bundle/backend.log
docker-compose logs db > debug_bundle/db.log
docker-compose logs frontend > debug_bundle/frontend.log
docker-compose config > debug_bundle/compose.yml
docker stats --no-stream > debug_bundle/stats.txt
df -h > debug_bundle/disk.txt
tar czf debug_bundle.tar.gz debug_bundle/
```

---

**Last Updated:** 2024-07-04

