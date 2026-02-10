# HTTPS LAN Development Setup

How the local HTTPS development environment works for testing Frens on mobile devices and testing PWA features (service workers, install prompts, etc.) over the LAN.

## Architecture

When you run `dotnet run` from the server directory, three things start:

```
┌─────────────────────────────────────────────────────────────┐
│  Your Mac (192.168.x.x)                                    │
│                                                             │
│  ┌──────────────────────┐   ┌────────────────────────────┐  │
│  │  ASP.NET Server      │   │  Expo Metro Bundler        │  │
│  │  :5188 (HTTP)        │   │  :8081 (HTTP)              │  │
│  │  :7188 (HTTPS) ◄─────┼───┤  Serves frontend JS/HTML  │  │
│  │                      │   │  Hot reload via WebSocket  │  │
│  │  API endpoints       │   └────────────────────────────┘  │
│  │  SPA proxy (→ :8443) │                ▲                  │
│  └──────────────────────┘                │                  │
│                              ┌───────────┴────────────────┐ │
│                              │  local-ssl-proxy           │ │
│                              │  :8443 (HTTPS) → :8081     │ │
│                              │  Uses self-signed LAN cert │ │
│                              └────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**Two HTTPS endpoints are exposed to the network:**

| Port | What | Serves |
|------|------|--------|
| **7188** | ASP.NET Kestrel | API (`/api/*`), Swagger (`/swagger`), static files |
| **8443** | local-ssl-proxy | Frontend (Expo web app + hot reload) |

Both use the **same self-signed certificate** from `src/Cliq.Server/certs/`.

## How Requests Flow

1. **Browser opens** `https://<ip>:7188` → ASP.NET SPA proxy sees no static `index.html` match → **302 redirects** to `https://<ip>:8443`
2. **Frontend loads** from `https://<ip>:8443` (SSL proxy → Expo Metro on :8081)
3. **API calls** from the frontend go to `https://<ip>:7188/api/*` (configured via `dev-ip.generated.js` → `env.js`)
4. **Hot reload** works over WebSocket through the SSL proxy on :8443

## Quick Start

### First-time setup

```bash
# 1. Generate a self-signed cert for your LAN IP (one-time, or when IP changes)
./scripts/gen-dev-cert.sh --trust

# 2. Install frontend dependencies (includes local-ssl-proxy)
cd src/cliq.client && npm install
```

### Running

```bash
# From src/Cliq.Server:
dotnet run
```

This automatically:
- Starts ASP.NET on :5188 (HTTP) and :7188 (HTTPS)
- Launches `npm run start-ssl` which starts both the SSL proxy (:8443) and Expo (:8081)
- Detects your LAN IP and configures everything to use it

### Accessing from your Mac

Open `https://192.168.x.x:7188` — it redirects to the frontend on :8443. Everything works because the cert is trusted in your macOS keychain.

### Accessing from iPhone / other devices

⚠️ **Important extra step for mobile devices:**

Because the frontend (:8443) and API (:7188) are on **different ports**, iOS Safari treats them as different origins. It will trust the cert you accepted for :8443 but silently **block** `fetch()` calls to :7188.

**Fix:** Before using the app, visit **both** HTTPS URLs in Safari and accept the certificate warning on each:

1. Open `https://192.168.x.x:7188` → tap "Show Details" → "visit this website" → accept
2. Open `https://192.168.x.x:8443` → tap "Show Details" → "visit this website" → accept
3. Now go to `https://192.168.x.x:7188` to use the app — API calls will work

You only need to do this once per cert generation (certs last 365 days).

> **Alternative (more permanent):** Install the cert on the device:
> AirDrop `src/Cliq.Server/certs/dev-lan-cert.crt` to your phone →
> Settings → General → VPN & Device Management → install the profile →
> Settings → General → About → Certificate Trust Settings → enable full trust.
> After this, no manual cert acceptance is needed.

## Key Files

| File | Purpose |
|------|---------|
| `scripts/gen-dev-cert.sh` | Generates self-signed cert with LAN IP in the SAN. Run with `--trust` to add to macOS keychain. |
| `src/Cliq.Server/certs/` | Generated cert files (`.crt`, `.key`, `.pfx`). Gitignored. |
| `src/Cliq.Server/appsettings.Development.json` | `DevHttps.PemPath` / `KeyPath` point to `certs/dev-lan-cert.*` |
| `src/Cliq.Server/Cliq.Server.csproj` | `DetectLanIp` MSBuild target auto-detects IP at build time. `SpaProxyLaunchCommand` runs `npm run start-ssl`. |
| `src/cliq.client/scripts/start-dev-ssl.js` | Starts local-ssl-proxy (:8443→:8081) + Expo together |
| `src/cliq.client/scripts/gen-dev-ip.js` | Writes `dev-ip.generated.js` with the API URL for the frontend |
| `src/cliq.client/dev-ip.generated.js` | Auto-generated. Exports `{ url, ip, port, protocol }` consumed by `env.js` |
| `src/cliq.client/env.js` | Reads `dev-ip.generated.js` to set `API_URL` for development |

## When Your IP Changes

If your machine gets a new LAN IP (different Wi-Fi, DHCP renewal, etc.):

```bash
# Re-generate certs with the new IP
./scripts/gen-dev-cert.sh --trust

# Rebuild the server (picks up new IP in SPA proxy config)
cd src/Cliq.Server && dotnet build
```

The `DetectLanIp` MSBuild target automatically picks up the new IP on every build, so `spa.proxy.json` stays current. But the cert's SAN must match the IP, which requires re-running the cert script.

## Ports Reference

| Port | Protocol | Service | Accessible from LAN? |
|------|----------|---------|---------------------|
| 5188 | HTTP | ASP.NET (API + SPA proxy) | Yes |
| 7188 | HTTPS | ASP.NET (API + SPA proxy) | Yes |
| 8081 | HTTP | Expo Metro (frontend dev server) | Yes (but no SSL) |
| 8443 | HTTPS | local-ssl-proxy → Expo | Yes |

## Troubleshooting

### "NaN null" response on iPhone API calls
You need to accept the cert on **both** ports. See "Accessing from iPhone" above.

### Cert errors after IP change
Re-run `./scripts/gen-dev-cert.sh --trust` and restart the server.

### "Address already in use" on startup
Kill leftover processes:
```bash
lsof -ti:5188 -ti:7188 -ti:8081 -ti:8443 | xargs kill -9
```

### Expo hot reload not working over HTTPS
Make sure you're accessing the app via `:8443` (the SSL proxy), not `:8081` directly. The SSL proxy forwards WebSocket connections for hot reload.

## Future Improvement

The current two-port setup (API on :7188, frontend on :8443) requires mobile devices to accept certs on both ports. A cleaner approach would be a single reverse proxy that routes `/api/*` to ASP.NET and everything else to Expo — eliminating the cross-origin issue entirely. The `http-proxy` npm package supports this with WebSocket forwarding for hot reload. This is tracked as a potential improvement if the two-port setup becomes too cumbersome.
