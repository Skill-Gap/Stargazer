# Stargazer Backend API

A lightweight FastAPI server running on Raspberry Pi that provides real-time system status data for the Stargazer personal control dashboard.

## Overview

This backend exposes three endpoints:
- `/` — Welcome message with app info
- `/health` — Health check endpoint
- `/status` — Real-time system information (CPU, memory, disk, uptime, hostname)

The API is designed to be simple, stable, and easily consumed by the Stargazer frontend via local or Tailscale network access.

## Installation

### Prerequisites
- Python 3.7+ installed on your Raspberry Pi
- `pip` package manager

### Setup Steps

1. **Navigate to the backend folder:**
   ```bash
   cd backend
   ```

2. **Create a virtual environment:**
   ```bash
   python3 -m venv venv
   ```

3. **Activate the virtual environment:**
   ```bash
   # On Linux/macOS (Raspberry Pi)
   source venv/bin/activate
   
   # On Windows (if testing locally)
   venv\Scripts\activate
   ```

4. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

## Running the Server

Once dependencies are installed and the virtual environment is activated:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

- `--host 0.0.0.0` makes the API accessible from any network interface
- `--port 8000` runs the server on port 8000 (default FastAPI port)

The API will be available at:
- Local: `http://localhost:8000`
- Network: `http://<pi-ip>:8000`

## Testing the API

Use your browser or `curl` to test the endpoints:

### 1. Welcome Endpoint
```
http://<pi-ip>:8000/
```
Returns app name, version, and usage information.

### 2. Health Check
```
http://<pi-ip>:8000/health
```
Returns current status and timestamp. Use this to verify the API is running.

### 3. System Status
```
http://<pi-ip>:8000/status
```
Returns detailed system information including:
- `hostname` — Device hostname
- `cpu_percent` — Current CPU usage (%)
- `memory_percent` — Memory usage (%)
- `memory_used` / `memory_total` — Memory in bytes
- `memory_used_gb` / `memory_total_gb` — Memory in GB
- `disk_percent` — Disk usage (%)
- `disk_used` / `disk_total` — Disk space in bytes
- `disk_used_gb` / `disk_total_gb` — Disk space in GB
- `boot_time` — System boot timestamp (ISO 8601)
- `uptime_seconds` — Seconds since last boot

### Example with curl (from Raspberry Pi)
```bash
curl http://localhost:8000/status
```

### Testing from Another Device
Replace `<pi-ip>` with your Raspberry Pi's IP address:
```bash
curl http://192.168.1.100:8000/status
```

## CORS Middleware

The backend includes optional CORS (Cross-Origin Resource Sharing) middleware to allow requests from any origin. This is currently set to `allow_origins=["*"]` for development.

**For production**, consider tightening CORS by specifying allowed origins:
```python
allow_origins=[
    "http://localhost:3000",
    "http://<your-frontend-domain>",
]
```

Edit `main.py` to customize CORS settings as needed.

## Integration with Stargazer Frontend

This API is designed to be consumed by the Stargazer frontend (`index.html`, `scripts.js`, etc.). Once the frontend is updated, it will fetch system data from these endpoints and display it in the control dashboard.

## Troubleshooting

### Port Already in Use
If port 8000 is busy, run with a different port:
```bash
uvicorn main:app --host 0.0.0.0 --port 8001
```

### Cannot Access from Network
- Ensure your Raspberry Pi firewall allows port 8000
- Verify the Pi's IP address: `hostname -I`
- Check that the uvicorn server is running: `ps aux | grep uvicorn`

### psutil Module Not Found
Ensure your virtual environment is activated and dependencies are installed:
```bash
source venv/bin/activate
pip install -r requirements.txt
```

## Future Enhancements

- Authentication/authorization
- Docker containerization
- Tailscale-specific routing
- Additional system metrics (temperature, network stats)
- Database for historical data
- WebSocket support for real-time updates

## Version

**v1.0** — Initial release with core system monitoring endpoints.

---

Built for Stargazer — A personal control dashboard by Lucas.
