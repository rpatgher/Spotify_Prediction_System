# Mullvad SOCKS5 proxy for yt-dlp (Tec-LM)

## Purpose

The backend (`backend-backend-1` container on Tec-LM) extracts audio features by downloading ~60 s of audio from YouTube via yt-dlp. After repeated downloads YouTube/yt-dlp IP-blocks the host. This routes those downloads through Mullvad VPN so the exit IP is Mullvad's, dodging the block. Volume is low (~1 download/min).

## Why a scoped WireGuard tunnel (not the Mullvad daemon)

Running the Mullvad daemon (`mullvad connect`) force-tunnels ALL traffic and enables a kill-switch, which hijacks the host default route. On Tec-LM that kills Tailscale — its CGNAT range `100.64.0.0/10` is NOT covered by `mullvad lan set allow`, which only whitelists RFC1918 — leading to SSH lockout requiring Proxmox console recovery. This happened during setup.

Instead we run a standalone `wg-quick` tunnel whose `AllowedIPs` is scoped to Mullvad's internal range only (`10.64.0.0/10`), so the default route is never touched and Tailscale/SSH cannot break.

Note: the school network (ITESM) DNS-blocks AND TLS-blocks `*.mullvad.net` (including `api.mullvad.net`), so the WireGuard config was generated off-host (mullvad.net on a personal Mac) and copied in. No Mullvad API access is needed at runtime. The relay data path (UDP 51820 to the relay) is not blocked.

## Architecture / data flow

```
backend container ──socks5──> 172.17.0.1:1080  (socat, docker bridge)
                                    │ TCP forward
                                    ▼
                             10.64.0.1:1080  (Mullvad in-tunnel SOCKS5)
                                    │ via wg iface "mullvad" (AllowedIPs 10.64.0.0/10)
                                    ▼
                        relay se-sto-wg-009 185.195.233.69:51820 ──> internet (exit IP = Sweden)
```

The container cannot reach the host-only wg address `10.64.0.1` directly, so a `socat` unit bridges the docker bridge IP `172.17.0.1:1080` → `10.64.0.1:1080`.

## Components on Tec-LM

| Component | Location | What |
|---|---|---|
| WireGuard config | `/etc/wireguard/mullvad.conf` (root 0600) | Scoped tunnel; `AllowedIPs=10.64.0.0/10`, no DNS line, no default route; relay se-sto-wg-009 (`185.195.233.69:51820`), `Address 10.65.86.161/32` |
| wg tunnel service | systemd `wg-quick@mullvad` (enabled) | Brings the tunnel up on boot |
| SOCKS forwarder | systemd `mullvad-socks-fwd` (enabled) | `socat TCP-LISTEN:1080,bind=172.17.0.1,fork,reuseaddr TCP:10.64.0.1:1080` |
| Backend wiring | `backend/.env` (gitignored) | `YTDLP_PROXIES=socks5://172.17.0.1:1080`, `MULLVAD_ACCOUNT=<secret>` |
| host `/etc/hosts` | appended | DoH-resolved IPs for mullvad.net/github/golang to beat the school DNS block (legacy from setup; not needed at runtime) |

## Backend code path

- `backend/app/core/config.py`: `YTDLP_PROXIES` setting (comma-separated SOCKS5 URLs) and `ytdlp_proxies_list` property; `MULLVAD_ACCOUNT`.
- `backend/app/services/audio_features.py::_download_youtube`: shuffles the proxy list, picks one per attempt (rotates exit IP), re-rolls onto the next proxy on failure; empty list = direct connection. Sets yt-dlp's `proxy` option (yt-dlp speaks SOCKS5 natively).
- Branch: `feat/ytdlp-mullvad-socks5`.

## Verification

Use `--socks5-hostname` so DNS resolves at the exit node, not locally.

```bash
# tunnel up + handshake
sudo wg show

# default route unchanged (must NOT go via wg)
ip route | grep -E 'default|10.64'

# exit at each hop (expect {"exit":true,"country":"Sweden"})
curl -s --socks5-hostname 10.64.0.1:1080 https://am.i.mullvad.net/json | jq '{exit:.mullvad_exit_ip,country:.country}'
curl -s --socks5-hostname 172.17.0.1:1080 https://am.i.mullvad.net/json | jq '{exit:.mullvad_exit_ip,country:.country}'
docker exec backend-backend-1 sh -c "curl -s --socks5-hostname 172.17.0.1:1080 https://am.i.mullvad.net/json" | jq '{exit:.mullvad_exit_ip,country:.country}'

# full code-path e2e (downloads via proxy, prints MP3 path + size)
docker exec backend-backend-1 python -c "
import logging; logging.basicConfig(level=logging.INFO)
from app.services.audio_features import _download_youtube
import os
p = _download_youtube('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
print('MP3', p, os.path.getsize(p))
"
```

Confirmed result (2026-06-12): all hops `exit: true`, `country: Sweden`; e2e downloaded 3.27 MiB via `socks5://172.17.0.1:1080`, no fallback.

## Operations

**Restart proxy chain**

```bash
sudo systemctl restart wg-quick@mullvad mullvad-socks-fwd
```

**Disable (back to direct connection)**

Set `YTDLP_PROXIES=` (empty) in `backend/.env` and restart the backend. Optionally bring the tunnel down:

```bash
sudo wg-quick down mullvad
```

**Change exit relay**

Edit `[Peer] PublicKey` and `Endpoint` (and `[Interface] Address` if you regenerate the key pair) in `/etc/wireguard/mullvad.conf` using a config downloaded from mullvad.net on an off-host machine (school network blocks the API), then:

```bash
sudo systemctl restart wg-quick@mullvad
```

**Proxy rotation (future, not yet implemented)**

Add more `socat` units listening on `172.17.0.1:1081`, `:1082`, etc., each forwarding to a different relay's in-tunnel SOCKS address. List all endpoints in `YTDLP_PROXIES` — the backend already rotates per-download. Alternatively, use the `mullvad-apisocks5` utility.

## Recovery from lockout (if someone runs the daemon by mistake)

Symptom: SSH/Tailscale to Tec-LM is dead after Mullvad daemon activity.

Fix via Proxmox console: open the pve node → tikitaka-ml VM → noVNC, log in as tikitaka-ml, then run:

```bash
mullvad disconnect
mullvad lockdown-mode set off
sudo systemctl restart tailscaled
```

## Security notes

- `/etc/wireguard/mullvad.conf` contains a WireGuard private key — permissions must stay root-only (0600).
- The Mullvad account number is a secret; it lives only in the gitignored `backend/.env`, never in a tracked file. The `.env.example` carries a placeholder only.
