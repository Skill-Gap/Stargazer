# Stargazer backends

Stargazer deliberately uses two small services with different deployment roles.

- The **Express gateway** (`server.js`) runs on the Windows workstation, serves the allowlisted dashboard files, launches the local SSH helper, proxies Home Assistant, and is the browser's only API origin.
- The **FastAPI Pi agent** (`main.py`) runs on the Raspberry Pi and reports system telemetry. It is called by Express, not directly by browser code.

Do not expose this development setup to the public internet. Home Assistant controls and the local connection helper do not yet have user authentication.

## Express gateway

Requires Node.js 18 or newer.

```powershell
cd backend
npm install
Copy-Item .env.example .env
# Edit .env for this machine; never commit it.
npm start
```

Open `http://localhost:3000`. `PORT` changes the listening port.

Configuration:

- `PI_API_URL`: Pi agent origin, such as `http://pi-host:8000`. Required for `GET /api/pi/status`.
- `UPSTREAM_TIMEOUT_MS`: Pi and Home Assistant timeout; defaults to 5000.
- `DESKTOP_TAILSCALE_HOST` and `DESKTOP_LOCAL_HOST`: optional Desktop probe targets, tried in that order.
- `LAPTOP_TAILSCALE_HOST` and `LAPTOP_LOCAL_HOST`: optional Laptop probe targets, tried in that order.
- `HA_URL` and `HA_TOKEN`: both required for Home Assistant endpoints.
- `PI_PLUG_ENTITY`, `DESKTOP_PLUG_ENTITY`, `LAMP_ENTITY`: optional entity overrides.
- `ALLOWED_ORIGINS`: optional comma-separated CORS allowlist for a separately hosted frontend. Same-origin operation does not require CORS.
- `PI_TAILSCALE_IP` and `PI_LOCAL_IP`: optional overrides for legacy `GET /status/pi` only.

Browser-facing endpoints:

- `GET /health`
- `GET /api/pi/status`
- `GET /api/devices/status`
- `POST /api/pi/connect`
- `GET /api/homeassistant/status`
- `GET /api/homeassistant/{pi|desktop|lamp}`
- `POST /api/homeassistant/{pi|desktop|lamp}/{on|off}`

Compatibility endpoints `POST /connect/pi` and `GET /status/pi` remain available during migration.

`GET /api/devices/status` is the dashboard's read-only aggregate. Pi availability comes from FastAPI telemetry. Desktop and Laptop use environment-configured reachability probes with Tailscale-first/local-fallback behavior. Missing configuration is reported as `configured: false`; an unreachable configured device is reported offline. A failure for one device never fails the aggregate response. These status probes do not authorize or perform device actions.

The gateway exposes only `index.html`, `deep-dive.html`, `stargazer.html`, their root CSS/JavaScript files, and the root `assets/` directory. It does not statically expose `backend/`, `.env`, documentation, or repository metadata.

## FastAPI Pi agent

On the Raspberry Pi:

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

Endpoints:

- `GET /`: service information.
- `GET /health`: health and timestamp.
- `GET /status`: hostname, CPU, memory, disk, boot time, and uptime.

Verify locally with `curl http://localhost:8000/status`, then set the workstation gateway's `PI_API_URL` to the Pi agent origin.

## Tests

```powershell
cd backend
npm test
```

Tests inject network and launcher dependencies. They do not contact Home Assistant, ping private devices, launch SSH, or change device state.

The FastAPI agent currently has no automated test suite. Its `/status` behavior still requires validation on the target Raspberry Pi because disk and host metrics depend on that environment.
