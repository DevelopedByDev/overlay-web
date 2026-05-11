---
title: "Bare Metal"
description: "Deploy Overlay on a plain Linux server."
---

# Bare Metal Deployment

For air-gapped environments or when you want full control over the OS.

## Prerequisites

- Ubuntu 22.04 LTS or RHEL 9
- Node.js 20+ (via `n` or `fnm`)
- Postgres 16
- Redis 7
- Nginx or Caddy
- Systemd

## 1. Install Dependencies

```bash
# Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Postgres
sudo apt-get install -y postgresql postgresql-contrib
sudo systemctl enable postgresql

# Redis
sudo apt-get install -y redis-server
sudo systemctl enable redis-server
```

## 2. Create Database

```bash
sudo -u postgres psql -c "CREATE USER overlay WITH PASSWORD 'strong-password';"
sudo -u postgres psql -c "CREATE DATABASE overlay OWNER overlay;"
```

## 3. Build the App

```bash
git clone https://github.com/getoverlay/overlay.git /opt/overlay
cd /opt/overlay
npm ci
npm run build
```

## 4. Environment File

Create `/opt/overlay/.env.local` (see [Configuration](/configuration) for full reference):

```bash
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://overlay.yourcompany.com
DATABASE_URL=postgresql://overlay:strong-password@localhost:5432/overlay
REDIS_URL=redis://localhost:6379
SESSION_SECRET=$(openssl rand -hex 32)
# ... see Configuration reference for remaining vars
```

## 5. Systemd Service

Create `/etc/systemd/system/overlay.service`:

```ini
[Unit]
Description=Overlay Web App
After=network.target postgresql.service redis-server.service

[Service]
Type=simple
User=overlay
WorkingDirectory=/opt/overlay
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5
Environment=NODE_ENV=production
EnvironmentFile=/opt/overlay/.env.local

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable overlay
sudo systemctl start overlay
```

## 6. Reverse Proxy (Caddy)

Install Caddy:

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

Create `/etc/caddy/Caddyfile`:

```caddy
overlay.yourcompany.com {
  reverse_proxy localhost:3000
  tls your-email@company.com
}
```

Reload Caddy:

```bash
sudo systemctl reload caddy
```

## 7. Log Rotation

Create `/etc/logrotate.d/overlay`:

```bash
/var/log/overlay/*.log {
  daily
  rotate 14
  compress
  delaycompress
  missingok
  notifempty
  create 0640 overlay overlay
}
```

## 8. Firewall

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `npm start` fails with port in use | Check `lsof -i :3000` and kill conflicting process |
| Postgres connection refused | Verify `pg_hba.conf` allows local connections |
| Redis connection refused | Check `redis-cli ping` and restart `redis-server` |
| Caddy fails to get certificate | Ensure port 80 is open for ACME challenge |
