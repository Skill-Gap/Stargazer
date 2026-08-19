# Stargazer Architecture

## Decision

Stargazer keeps both checked-in backend runtimes because they currently serve different hosts and capabilities:

- **Express gateway (`backend/server.js`, default port 3000):** runs on the Windows workstation, serves the dashboard, launches the existing Windows SSH helper, proxies Home Assistant, and is the only backend called by the browser.
- **FastAPI Pi agent (`backend/main.py`, default port 8000):** runs on the Raspberry Pi and reports host CPU, memory, disk, hostname, boot time, and uptime. It is called by the Express gateway, not directly by the browser.

This split resolves the existing mismatch where the frontend requested FastAPI's `/status` response shape from Express's port. The runtimes should not be merged during sprint one. Consolidation can be reconsidered after deployment requirements are known.

```text
Browser
  |
  | same-origin HTTP
  v
Express gateway :3000
  |-- static dashboard
  |-- Windows connection helper
  |-- Home Assistant REST API
  `-- FastAPI Pi agent :8000
```

## Configuration boundary

Machine-specific addresses and secrets belong in the Express environment, not browser JavaScript:

- `PORT` - Express port; defaults to `3000`.
- `PI_API_URL` - FastAPI Pi agent origin, for example `http://pi-host:8000`.
- `HA_URL` - Home Assistant origin.
- `HA_TOKEN` - Home Assistant long-lived access token.
- Existing Home Assistant entity variables remain supported.

The FastAPI agent requires no dashboard credentials in sprint one. Network exposure and authentication must be revisited before access outside a trusted private network.

## Sprint-one API contracts

All browser requests are relative to the Express-served dashboard origin.

### Health

`GET /health`

Success `200`:

```json
{ "status": "ok" }
```

### Raspberry Pi telemetry

`GET /api/pi/status`

Success `200`:

```json
{
  "status": "online",
  "checked_at": "2026-08-19T12:00:00.000Z",
  "system": {
    "hostname": "pi",
    "cpu_percent": 12.5,
    "memory_percent": 40.1,
    "disk_percent": 55.2,
    "uptime_seconds": 12345
  }
}
```

Missing configuration or unavailable Pi agent returns `503`:

```json
{
  "error": {
    "code": "PI_NOT_CONFIGURED",
    "message": "Raspberry Pi service is not configured."
  }
}
```

The unavailable form uses code `PI_UNAVAILABLE` and the same non-sensitive error structure.

### Local Pi connection helper

`POST /api/pi/connect`

Success `200`:

```json
{ "status": "launched", "message": "Raspberry Pi connection helper launched." }
```

Launcher failure returns `500` with the standard `error` object. The existing `POST /connect/pi` route remains as a compatibility alias.

### Home Assistant

`GET /api/homeassistant/status` retains the existing aggregate shape:

```json
{
  "reachable": true,
  "last_updated": "2026-08-19T12:00:00.000Z",
  "devices": {
    "pi": { "entity_id": "string", "state": "on", "friendly_name": "string", "last_updated": "string" },
    "desktop": { "entity_id": "string", "state": "off", "friendly_name": "string", "last_updated": "string" },
    "lamp": { "entity_id": "string", "state": "on", "friendly_name": "string", "last_updated": "string" }
  }
}
```

`POST /api/homeassistant/{pi|desktop|lamp}/{on|off}` returns:

```json
{ "result": "ok", "entity_id": "string", "power": "on" }
```

Missing configuration uses `503`. Upstream failure uses `502`. Errors use `{ "error": { "code": "...", "message": "..." } }` and do not include tokens, internal exception text, or authorization headers.

### Deferred actions

Pi desktop, share, logs, reboot, and shutdown; Desktop connection/status; and Laptop controls do not have a trustworthy checked-in service contract. They remain out of sprint-one backend scope and must appear disabled/unavailable in the UI. Reboot and shutdown require an authentication and authorization design before implementation.

## Live device foundation contract

The dashboard's shared device layer uses `GET /api/devices/status`. Express performs all reachability and telemetry work; the browser never pings private addresses directly.

Success `200`:

```json
{
  "checked_at": "2026-08-19T12:00:00.000Z",
  "devices": {
    "pi": {
      "configured": true,
      "online": true,
      "connection": "telemetry",
      "system": {
        "hostname": "pi",
        "cpu_percent": 12.5,
        "memory_percent": 40.1,
        "disk_percent": 55.2,
        "uptime_seconds": 12345
      }
    },
    "desktop": {
      "configured": true,
      "online": true,
      "connection": "tailscale",
      "system": null
    },
    "laptop": {
      "configured": false,
      "online": false,
      "connection": null,
      "system": null
    }
  },
  "summary": { "configured": 2, "online": 2 }
}
```

Rules:

- Pi is online when its configured FastAPI telemetry request succeeds. Its `system` value uses the normalized telemetry already defined for `/api/pi/status`.
- Desktop and Laptop use configured Tailscale host first and local host second. A successful first or second probe sets `connection` to `tailscale` or `local`.
- Missing host configuration is not an error: the device returns `configured: false`, `online: false`, and `connection: null`.
- An unreachable configured device returns `configured: true`, `online: false`, and `connection: null`.
- Individual device failures do not fail the aggregate response.
- Browser controls remain disabled unless a separate action contract exists.
- Device hosts are configured only in the gateway environment with `DESKTOP_TAILSCALE_HOST`, `DESKTOP_LOCAL_HOST`, `LAPTOP_TAILSCALE_HOST`, and `LAPTOP_LOCAL_HOST`.
