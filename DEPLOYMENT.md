# DeepGuard Cloud Deployment Runbook

This guide covers deployment procedures, environment variable configuration, secure SSL provisioning, and zero-downtime rolling updates.

---

## 1. Environment Variable Management

All backend and frontend configurations are driven via secure environment variables. For production, define these using secret managers (Kubernetes Secrets, AWS Parameter Store, or HashiCorp Vault).

### Key Variables
* `APP_ENV`: Must be set to `production`.
* `SECRET_KEY` / `JWT_SECRET`: Secure 256-bit hexadecimal keys for signing sessions.
* `DATABASE_URL` / `SYNC_DATABASE_URL`: Connection strings pointing to postgreSQL clusters.
* `REDIS_URL`: Redis endpoint for the Celery task queue.
* `USE_MOCK_MODELS`: Set to `false` to enable real PyTorch and ONNX neural classification models.

---

## 2. SSL Provisioning (Nginx & Certbot)

To secure user scans with HTTPS, configure Nginx and retrieve SSL certificates via Certbot.

### Configuration Template (`/etc/nginx/sites-available/deepguard`)
```nginx
server {
    listen 80;
    server_name deepguard.yourdomain.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name deepguard.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/deepguard.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/deepguard.yourdomain.com/privkey.pem;

    # SSL Security best practices
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;

    location / {
        proxy_pass http://localhost:80; # Points to DeepGuard frontend container
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api/v1 {
        proxy_pass http://localhost:8000; # Points to FastAPI backend container
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Retrieving Certificates via Certbot
```bash
sudo certbot --nginx -d deepguard.yourdomain.com
```

---

## 3. Zero-Downtime Rolling Updates

To update active clusters without experiencing downtime, employ rolling upgrade strategies.

### Kubernetes Rolling Update
Kubernetes supports zero-downtime rolling updates natively by setting rolling update strategies in deployments:
```yaml
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
```
Trigger the update by setting a new container image tag:
```bash
kubectl set image deployment/deepguard-backend backend=deepguard-backend:v1.0.1 --record
```
Monitor the rollout status:
```bash
kubectl rollout status deployment/deepguard-backend
```

### Docker Compose Rolling Update
Using Docker Compose, updates can be executed with zero-downtime by running scale operations:
1. Re-build the new backend image:
   ```bash
   docker compose build backend
   ```
2. Scale up backend containers to spin up new pods:
   ```bash
   docker compose up -d --no-recreate --scale backend=2
   ```
3. Stop and remove old containers, scaling back down:
   ```bash
   docker compose stop backend_old_container_id
   docker compose rm backend_old_container_id
   docker compose up -d --scale backend=1
   ```
