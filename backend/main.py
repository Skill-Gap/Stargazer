"""
Stargazer Backend - FastAPI Server
A simple API that provides Raspberry Pi system status information.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
import psutil
import socket
import time

# Initialize FastAPI app
app = FastAPI(title="Stargazer", version="1.0", description="Personal control dashboard backend")

# Optional CORS middleware - can be tightened later for production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Consider restricting this to your frontend domain in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Helper function to convert bytes to human-readable format
def format_bytes(bytes_value):
    """Convert bytes to GB with 2 decimal places."""
    gb = bytes_value / (1024 ** 3)
    return round(gb, 2)

# Helper function to get boot time and uptime
def get_uptime_info():
    """Return boot time and uptime in seconds."""
    try:
        boot_time = psutil.boot_time()
        uptime_seconds = time.time() - boot_time
        return {
            "boot_time": datetime.fromtimestamp(boot_time).isoformat(),
            "uptime_seconds": int(uptime_seconds)
        }
    except Exception as e:
        return {"error": f"Failed to get uptime: {str(e)}"}

# Helper function to get system status
def get_system_status():
    """Gather all system information safely with error handling."""
    status = {}
    
    # Hostname
    try:
        status["hostname"] = socket.gethostname()
    except Exception as e:
        status["hostname"] = f"Error: {str(e)}"
    
    # CPU usage
    try:
        status["cpu_percent"] = psutil.cpu_percent(interval=1)
    except Exception as e:
        status["cpu_percent"] = None
    
    # Memory usage
    try:
        mem = psutil.virtual_memory()
        status["memory_percent"] = mem.percent
        status["memory_used"] = mem.used
        status["memory_used_gb"] = format_bytes(mem.used)
        status["memory_total"] = mem.total
        status["memory_total_gb"] = format_bytes(mem.total)
    except Exception as e:
        status["memory_error"] = str(e)
    
    # Disk usage
    try:
        disk = psutil.disk_usage('/')
        status["disk_percent"] = disk.percent
        status["disk_used"] = disk.used
        status["disk_used_gb"] = format_bytes(disk.used)
        status["disk_total"] = disk.total
        status["disk_total_gb"] = format_bytes(disk.total)
    except Exception as e:
        status["disk_error"] = str(e)
    
    # Boot time and uptime
    uptime_info = get_uptime_info()
    status.update(uptime_info)
    
    return status

# Route 1: Welcome endpoint
@app.get("/")
async def root():
    """
    Returns a welcome message with app information.
    """
    return {
        "app": "Stargazer",
        "version": "1.0",
        "message": "Personal control dashboard backend. Use /status for system info or /health for health check."
    }

# Route 2: Health check endpoint
@app.get("/health")
async def health():
    """
    Returns a simple health check with current timestamp.
    Used to verify the API is running and responsive.
    """
    return {
        "status": "ok",
        "timestamp": datetime.now().isoformat()
    }

# Route 3: System status endpoint
@app.get("/status")
async def status():
    """
    Returns comprehensive Raspberry Pi system information.
    Includes CPU, memory, disk, hostname, and uptime data.
    """
    try:
        system_info = get_system_status()
        return {
            "status": "success",
            "timestamp": datetime.now().isoformat(),
            "system": system_info
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve system status: {str(e)}"
        )

# Health check for startup
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
