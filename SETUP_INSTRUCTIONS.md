# Stargazer V1 - Raspberry Pi Connection Setup

## ✅ Implementation Complete

All components are now in place. Here's what was created:

---

## 📁 Project Structure

```
Resume-website/
├── index.html                    (unchanged)
├── scripts.js                    (UPDATED - new setupPiConnection function)
├── styles.css                    (unchanged)
├── backend/
│   ├── package.json              (NEW - Express + CORS dependencies)
│   ├── server.js                 (NEW - Node.js backend server)
│   ├── node_modules/             (NEW - dependencies installed)
│   └── scripts/
│       └── connect-pi.bat        (NEW - Windows batch connection script)
```

---

## 🚀 Quick Start

### 1. **Start the Backend Server**

Open PowerShell and run:

```powershell
cd C:\Users\lucas\Resume-website\backend
npm start
```

You should see:
```
Stargazer backend listening on http://localhost:3000
```

**Keep this terminal open while using the frontend.**

### 2. **Open the Frontend**

Open `C:\Users\lucas\Resume-website\index.html` in your browser.

### 3. **Connect to Raspberry Pi**

- Click "Enter" to access the dashboard
- Find the "Raspberry Pi" device card (marked as "CORE NODE")
- Click the "CONNECT" button

**What happens:**
1. Frontend sends POST request to `http://localhost:3000/connect/pi`
2. Backend launches `connect-pi.bat` in a new window
3. Batch script pings Tailscale IP first
4. If reachable → opens SSH to Tailscale
5. If unreachable → tries local IP
6. If local also unreachable → shows error message

---

## 📋 Connection Flow Details

### Connection Targets

| Method    | IP Address       | Username |
|-----------|------------------|----------|
| Tailscale | 100.87.110.77   | lucas    |
| Local LAN | 192.168.1.35    | lucas    |

### Batch Script Logic

The batch file (`backend/scripts/connect-pi.bat`) executes this sequence:

1. **Test Tailscale Reachability**
   - `ping -n 1 100.87.110.77`
   - If reachable → Launch `ssh lucas@100.87.110.77`
   - If not reachable → Continue to step 2

2. **Test Local LAN Reachability**
   - `ping -n 1 192.168.1.35`
   - If reachable → Launch `ssh lucas@192.168.1.35`
   - If not reachable → Continue to step 3

3. **Failure Handling**
   - Display error message with troubleshooting steps
   - Pause for user to review

---

## 🔧 Code Breakdown

### Backend: `server.js`

```javascript
// POST /connect/pi - launches the batch file
app.post('/connect/pi', (req, res) => {
  const batchFilePath = path.join(__dirname, 'scripts', 'connect-pi.bat');
  exec(`start "" "${batchFilePath}"`, (error) => {
    if (error) return res.status(500).json({ error: 'Failed to launch Pi connection' });
    res.json({ message: 'Launching Pi connection...' });
  });
});
```

### Frontend: `scripts.js`

```javascript
// Detects click on Raspberry Pi "CONNECT" button
// Sends POST request to backend
// Updates button status during connection attempt

fetch('http://localhost:3000/connect/pi', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
});
```

### Batch Script: `connect-pi.bat`

- Uses `ping` to test reachability (avoids SSH hanging issues)
- Launches SSH only after confirming target is reachable
- Provides clear terminal messages for each step
- Pauses at end so you can review results

---

## 📝 Dependencies Installed

```json
{
  "express": "^4.18.2",     // Web framework
  "cors": "^2.8.5"          // Cross-Origin Resource Sharing
}
```

Run `npm install` in `backend/` directory if you need to reinstall (already done).

---

## 🧪 Testing the Backend

### Health Check Endpoint

```powershell
Invoke-WebRequest -Uri "http://localhost:3000/health" -Method GET
```

Should return: `{"status":"ok"}`

### Connection Endpoint

```powershell
Invoke-WebRequest -Uri "http://localhost:3000/connect/pi" -Method POST
```

Should:
- Return: `{"message":"Launching Pi connection..."}`
- Open batch script window showing connection attempt

---

## ⚠️ Troubleshooting

### "Backend not reachable" error on frontend

- **Issue:** Backend server not running
- **Fix:** Run `npm start` in `backend/` directory and keep terminal open

### Batch window doesn't appear

- **Issue:** `start` command not working or path incorrect
- **Fix:** Verify `backend\scripts\connect-pi.bat` exists and Windows PATH includes cmd.exe

### SSH connection hangs

- **Issue:** SSH is waiting for something or network is unresponsive
- **Fix:** Press Ctrl+C to cancel. Check Tailscale/network connectivity with `ping` command

### Both connections fail

- **Issue:** Raspberry Pi offline or unreachable
- **Fix:** Check if Pi is powered on, Tailscale is running, and local network connectivity

---

## 📌 Important Notes

- **Windows Only:** This uses Windows batch scripts and `start` command
- **SSH Key Setup:** Make sure SSH keys are configured on your system
- **Tailscale:** Verify Tailscale is installed and connected on both your PC and Raspberry Pi
- **Local Network:** Ensure Raspberry Pi is on your LAN for local IP connection
- **Port 3000:** Backend uses port 3000. Change in `server.js` if needed

---

## 🎯 Next Steps

1. Start the backend: `npm start` in `backend/` folder
2. Open `index.html` in your browser
3. Click "Enter" → "Systems" or find Pi card
4. Click "CONNECT" button
5. Follow prompts in the batch window

---

## 📞 Support

If something doesn't work:

1. Check console errors in browser (F12 → Console tab)
2. Check backend terminal for error messages
3. Verify batch file runs manually: `C:\Users\lucas\Resume-website\backend\scripts\connect-pi.bat`
4. Test reachability manually: `ping 100.87.110.77` or `ping 192.168.1.35`

