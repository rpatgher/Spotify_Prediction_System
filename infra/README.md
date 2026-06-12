# Infra

Configuración de toda la infraestructura desplegada del sistema: load balancer, Keycloak, stack de monitoreo, base de datos y backups. Cada carpeta corresponde a un host/servicio.

## Estructura

```
infra/
├── loadbalancer/     Nginx LB (VM lb, 172.16.20.144)
├── keycloak/         Keycloak + nginx (OS-VM1, 172.16.20.146)
├── monitoring/       Grafana + Loki + Prometheus (CT 112, 172.16.20.151)
├── database/         PostgreSQL (CT 111)
├── tec-lm/           Jump host / destino de backups (Tec-LM)
├── pve/              Hipervisor Proxmox (PVE-Tec)
├── setup-scripts/    Scripts de instalación de los backups
└── Infra.pkt         Topología de red (Packet Tracer)
```

## loadbalancer/

Punto de entrada del sistema. Termina TLS en `:443` (cert self-signed `lb.crt`), redirige `:80 → https`, balancea la SPA entre frontend-1/2 (round-robin) y proxya Keycloak.

| Archivo | Qué es |
|---|---|
| `docker-compose.yml` | nginx 1.27-alpine, puertos 80/443, en `/opt/lb/` de la VM |
| `lb.conf` | Rutas: `/` → upstream `frontends` (172.16.20.142/.149:8080), `/realms/` y `/resources/` → Keycloak, `/auth/` → 302 al account console, `/api/` → backend |
| `lb.crt` | Certificado TLS (la key privada vive solo en la VM) |

## keycloak/

Identidad (OIDC, realm `canciones`). Keycloak 26 detrás de un nginx propio que whitelistea solo los paths públicos; la consola admin queda accesible únicamente por Tailscale.

| Archivo | Qué es |
|---|---|
| `docker-compose.yml` | Keycloak + Postgres propio, en `~/keycloak/` de OS-VM1 |
| `nginx.conf` | Whitelist `/realms/canciones/` y `/resources/`; propaga los headers `X-Forwarded-*` del LB con fallback a valores locales |
| `env.template` | Variables del `.env` (valores reales solo en el host) |
| `config.alloy` | Grafana Alloy: envía logs/métricas al stack de monitoreo |
| `keycloak-backup.sh` | Backup diario: tar de configs + export del realm, rsync a Tec-LM |
| `cron.d.txt` | Schedule del backup (03:50 diario) |

## monitoring/

Stack de observabilidad en CT 112 de Proxmox, en `/opt/monitoring/`.

| Archivo | Qué es |
|---|---|
| `docker-compose.yml` | Grafana + Loki + Prometheus (password de Grafana solo en el host) |
| `loki-config.yml` | Config de Loki (logs) |
| `prometheus.yml` | Scrape targets de Prometheus (métricas) |
| `provisioning/datasources-ds.yml` | Datasources de Grafana auto-provisionados |
| `monitoring-backup.sh` | Backup diario del stack |
| `cron.d.txt` | Schedule del backup (04:10 diario) |

## database/

PostgreSQL del sistema, en CT 111 de Proxmox.

| Archivo | Qué es |
|---|---|
| `config.alloy` | Grafana Alloy: logs/métricas de Postgres al monitoreo |
| `pg-backup.sh` | `pg_dump` con retención, corre como usuario `postgres` |
| `cron.d.txt` | Schedule del backup (cada hora) |

## tec-lm/

Jump host de la VLAN y destino central de los backups remotos (`~/backups/`).

| Archivo | Qué es |
|---|---|
| `backend-config-backup.sh` | Backup diario de configs locales |
| `cron.d.txt` | Schedule (03:40 diario) |
| `MULLVAD_YTDLP_PROXY.md` | Runbook del proxy SOCKS5 Mullvad (WireGuard scoped) que enruta las descargas de yt-dlp del backend |

## pve/

Hipervisor Proxmox que aloja CT 111 (db) y CT 112 (monitoring).

| Archivo | Qué es |
|---|---|
| `ct111-vzdump-backup.sh` | vzdump completo del CT de la base de datos |
| `cron.d-ct111-vzdump` | Schedule (domingos 04:00) |

## setup-scripts/

Scripts idempotentes que instalan cada backup en su host (crean script en `/usr/local/bin`, cron en `/etc/cron.d`, key SSH para el rsync a Tec-LM y corren una primera ejecución):

- `setup-db-backup.sh` — CT 111
- `setup-keycloak-backup.sh` — OS-VM1
- `setup-monitoring-backup.sh` — CT 112
- `setup-teclm-backup.sh` — Tec-LM
- `setup-vzdump-backup.sh` — PVE-Tec

Uso: `ssh <host> 'bash -s' < setup-scripts/setup-<x>-backup.sh`
