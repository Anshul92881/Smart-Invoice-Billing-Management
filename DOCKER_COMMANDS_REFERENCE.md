# Quick Reference - Docker Commands

## Service Management

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# Restart specific service
docker-compose restart backend

# View running services
docker-compose ps

# View detailed status
docker-compose ps -a
```

## Logs and Debugging

```bash
# View all logs (follow mode)
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f db
docker-compose logs -f frontend

# View last N lines
docker-compose logs --tail=50 backend

# View logs with timestamps
docker-compose logs -f --timestamps backend
```

## Access Containers

```bash
# Execute bash in container
docker-compose exec backend sh
docker-compose exec db bash
docker-compose exec frontend sh

# Connect to MySQL
docker-compose exec db mysql -u appuser -p invoice_db

# View container file system
docker-compose exec backend ls -la /app
```

## Database Operations

```bash
# MySQL shell
docker-compose exec db mysql -uroot -p

# Dump database
docker-compose exec db mysqldump -u appuser -p invoice_db > backup.sql

# Import database
docker-compose exec db mysql -u appuser -p invoice_db < backup.sql

# List databases
docker-compose exec db mysql -u appuser -p -e "SHOW DATABASES;"

# Run SQL query
docker-compose exec db mysql -u appuser -p invoice_db -e "SELECT * FROM tbl_users LIMIT 5;"
```

## Build Operations

```bash
# Build all images
docker-compose build

# Build specific service
docker-compose build backend

# Build without cache
docker-compose build --no-cache

# Force rebuild
docker-compose build --force-rm
```

## Volumes and Storage

```bash
# List all volumes
docker volume ls

# Inspect volume
docker volume inspect invoice_mysql_data

# Backup volume
docker run --rm -v invoice_uploads_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/uploads_backup.tar.gz -C /data .

# Restore volume
docker run --rm -v invoice_uploads_data:/data -v $(pwd):/backup \
  alpine tar xzf /backup/uploads_backup.tar.gz -C /data

# Remove unused volumes
docker volume prune

# Remove specific volume
docker volume rm invoice_uploads_data
```

## Cleanup

```bash
# Stop and remove containers
docker-compose down

# Remove images
docker-compose down --rmi all

# Remove volumes
docker-compose down -v

# Full cleanup (images, containers, volumes, networks)
docker-compose down --rmi all -v

# System-wide cleanup
docker system prune -a
docker volume prune
```

## Health Checks

```bash
# Check service health
docker-compose ps

# Test service endpoints
curl http://localhost/                    # Frontend
curl http://localhost:5000/               # Backend API
docker-compose exec db mysqladmin ping    # Database

# Check container stats
docker stats

# Inspect container
docker-compose exec backend cat /proc/1/status
```

## Environment and Configuration

```bash
# View environment variables in running container
docker-compose exec backend env | sort

# Check current configuration
docker-compose config

# Validate compose file
docker-compose config --quiet

# Get service IP addresses
docker-compose exec backend hostname -I
docker-compose exec db hostname -I
```

## Updates and Redeployment

```bash
# Pull latest and rebuild
git pull
docker-compose build --no-cache
docker-compose down
docker-compose up -d

# Zero-downtime restart
docker-compose up -d --no-recreate

# Full rebuild
docker system prune -a
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

## Troubleshooting

```bash
# Check Docker daemon logs
journalctl -u docker.service -n 50

# Network diagnostics
docker-compose exec backend ping db
docker network ls
docker network inspect invoice_network

# Port conflicts
sudo netstat -tulpn | grep LISTEN
sudo lsof -i -P -n | grep LISTEN

# Disk space
df -h
docker system df

# Memory usage
docker stats --no-stream
```

## Production Monitoring

```bash
# Get container IDs
docker-compose ps -q backend

# Monitor real-time metrics
docker stats

# Container events
docker events --filter status=start --filter status=stop

# Persistent logs (for external logging)
docker-compose logs --follow > /var/log/invoice-app.log &
```

