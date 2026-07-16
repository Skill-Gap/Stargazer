// Load environment variables from .env if present
try { require('dotenv').config(); } catch (e) { /* dotenv not installed; ignore */ }
const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Utility: Ping an IP address
function pingIP(ip) {
  return new Promise((resolve) => {
    exec(`ping -n 1 ${ip}`, (error) => {
      resolve(error === null || error.code === 0);
    });
  });
}

// POST /connect/pi - Launch the batch script
app.post('/connect/pi', (req, res) => {
  const batchFilePath = path.join(__dirname, 'scripts', 'connect-pi.bat');
  
  // Launch batch file using start command
  exec(`start "" "${batchFilePath}"`, (error) => {
    if (error) {
      console.error('Failed to launch batch file:', error);
      return res.status(500).json({ error: 'Failed to launch Pi connection' });
    }
    res.json({ message: 'Launching Pi connection...' });
  });
});

// GET /status/pi - Check Raspberry Pi status (Tailscale first, then local)
app.get('/status/pi', async (req, res) => {
  try {
    const TAILSCALE_IP = '100.87.110.77';
    const LOCAL_IP = '192.168.1.35';
    
    // Try Tailscale first
    const tailscaleReachable = await pingIP(TAILSCALE_IP);
    if (tailscaleReachable) {
      return res.json({ status: 'tailscale' });
    }
    
    // Try local network
    const localReachable = await pingIP(LOCAL_IP);
    if (localReachable) {
      return res.json({ status: 'local' });
    }
    
    // Both failed
    res.json({ status: 'offline' });
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: 'Status check failed' });
  }
});

// Home Assistant integration (uses environment variables)
const HA_URL = process.env.HA_URL || 'http://192.168.1.35:8123';
const HA_TOKEN = process.env.HA_TOKEN; // must be set in environment
const PI_ENTITY = process.env.PI_PLUG_ENTITY || 'switch.pi_socket_1';
const DESKTOP_ENTITY = process.env.DESKTOP_PLUG_ENTITY || 'switch.desktop_socket_1';
const LAMP_ENTITY = process.env.LAMP_ENTITY || 'switch.ihome_ww117_smart_plug_socket_1';

function haHeaders() {
  return {
    'Authorization': `Bearer ${HA_TOKEN}`,
    'Content-Type': 'application/json'
  };
}

async function getEntityState(entityId) {
  const url = `${HA_URL}/api/states/${encodeURIComponent(entityId)}`;
  const res = await fetch(url, { headers: haHeaders() });
  if (!res.ok) throw new Error(`Failed to fetch state for ${entityId}: ${res.status}`);
  return await res.json();
}

// Status - verify HA reachable and return basic device states
app.get('/api/homeassistant/status', async (req, res) => {
  if (!HA_TOKEN) return res.status(500).json({ error: 'HA_TOKEN not set in environment' });
  try {
    const now = new Date().toISOString();
    // Check HA API root for reachability
    const test = await fetch(`${HA_URL}/api/`, { headers: haHeaders() });
    const reachable = test.ok;

    const devices = {};
    try { const pi = await getEntityState(PI_ENTITY); devices.pi = { entity_id: PI_ENTITY, state: pi.state, friendly_name: (pi.attributes && pi.attributes.friendly_name) || null, last_updated: pi.last_updated }; } catch (e) { devices.pi = { entity_id: PI_ENTITY, state: 'unavailable' }; }
    try { const desk = await getEntityState(DESKTOP_ENTITY); devices.desktop = { entity_id: DESKTOP_ENTITY, state: desk.state, friendly_name: (desk.attributes && desk.attributes.friendly_name) || null, last_updated: desk.last_updated }; } catch (e) { devices.desktop = { entity_id: DESKTOP_ENTITY, state: 'unavailable' }; }
    try { const lamp = await getEntityState(LAMP_ENTITY); devices.lamp = { entity_id: LAMP_ENTITY, state: lamp.state, friendly_name: (lamp.attributes && lamp.attributes.friendly_name) || null, last_updated: lamp.last_updated }; } catch (e) { devices.lamp = { entity_id: LAMP_ENTITY, state: 'unavailable' }; }

    res.json({ last_updated: now, reachable, devices });
  } catch (error) {
    console.error('Home Assistant status error:', error);
    res.status(502).json({ error: 'Home Assistant unreachable', details: String(error) });
  }
});

// Device GET endpoints
app.get('/api/homeassistant/pi', async (req, res) => {
  if (!HA_TOKEN) return res.status(500).json({ error: 'HA_TOKEN not set in environment' });
  try {
    const state = await getEntityState(PI_ENTITY);
    res.json({ entity_id: PI_ENTITY, state: state.state, friendly_name: (state.attributes && state.attributes.friendly_name) || null, last_updated: state.last_updated });
  } catch (e) {
    res.status(502).json({ error: `Failed to get ${PI_ENTITY}`, details: String(e) });
  }
});

app.get('/api/homeassistant/desktop', async (req, res) => {
  if (!HA_TOKEN) return res.status(500).json({ error: 'HA_TOKEN not set in environment' });
  try {
    const state = await getEntityState(DESKTOP_ENTITY);
    res.json({ entity_id: DESKTOP_ENTITY, state: state.state, friendly_name: (state.attributes && state.attributes.friendly_name) || null, last_updated: state.last_updated });
  } catch (e) {
    res.status(502).json({ error: `Failed to get ${DESKTOP_ENTITY}`, details: String(e) });
  }
});

app.get('/api/homeassistant/lamp', async (req, res) => {
  if (!HA_TOKEN) return res.status(500).json({ error: 'HA_TOKEN not set in environment' });
  try {
    const state = await getEntityState(LAMP_ENTITY);
    res.json({ entity_id: LAMP_ENTITY, state: state.state, friendly_name: (state.attributes && state.attributes.friendly_name) || null, last_updated: state.last_updated });
  } catch (e) {
    res.status(502).json({ error: `Failed to get ${LAMP_ENTITY}`, details: String(e) });
  }
});

// Device control endpoints (POST)
async function callService(domainAction, entityId) {
  const url = `${HA_URL}/api/services/${domainAction}`;
  const body = JSON.stringify({ entity_id: entityId });
  const res = await fetch(url, { method: 'POST', headers: haHeaders(), body });
  if (!res.ok) throw new Error(`Service call failed: ${res.status}`);
  return res;
}

app.post('/api/homeassistant/pi/on', async (req, res) => {
  if (!HA_TOKEN) return res.status(500).json({ error: 'HA_TOKEN not set in environment' });
  try {
    await callService('switch/turn_on', PI_ENTITY);
    const state = await getEntityState(PI_ENTITY);
    res.json({ result: 'ok', entity_id: PI_ENTITY, power: state.state });
  } catch (e) {
    res.status(502).json({ error: `Failed to turn on ${PI_ENTITY}`, details: String(e) });
  }
});

app.post('/api/homeassistant/pi/off', async (req, res) => {
  if (!HA_TOKEN) return res.status(500).json({ error: 'HA_TOKEN not set in environment' });
  try {
    await callService('switch/turn_off', PI_ENTITY);
    const state = await getEntityState(PI_ENTITY);
    res.json({ result: 'ok', entity_id: PI_ENTITY, power: state.state });
  } catch (e) {
    res.status(502).json({ error: `Failed to turn off ${PI_ENTITY}`, details: String(e) });
  }
});

app.post('/api/homeassistant/desktop/on', async (req, res) => {
  if (!HA_TOKEN) return res.status(500).json({ error: 'HA_TOKEN not set in environment' });
  try {
    await callService('switch/turn_on', DESKTOP_ENTITY);
    const state = await getEntityState(DESKTOP_ENTITY);
    res.json({ result: 'ok', entity_id: DESKTOP_ENTITY, power: state.state });
  } catch (e) {
    res.status(502).json({ error: `Failed to turn on ${DESKTOP_ENTITY}`, details: String(e) });
  }
});

app.post('/api/homeassistant/desktop/off', async (req, res) => {
  if (!HA_TOKEN) return res.status(500).json({ error: 'HA_TOKEN not set in environment' });
  try {
    await callService('switch/turn_off', DESKTOP_ENTITY);
    const state = await getEntityState(DESKTOP_ENTITY);
    res.json({ result: 'ok', entity_id: DESKTOP_ENTITY, power: state.state });
  } catch (e) {
    res.status(502).json({ error: `Failed to turn off ${DESKTOP_ENTITY}`, details: String(e) });
  }
});

app.post('/api/homeassistant/lamp/on', async (req, res) => {
  if (!HA_TOKEN) return res.status(500).json({ error: 'HA_TOKEN not set in environment' });
  try {
    await callService('switch/turn_on', LAMP_ENTITY);
    const state = await getEntityState(LAMP_ENTITY);
    res.json({ result: 'ok', entity_id: LAMP_ENTITY, power: state.state });
  } catch (e) {
    res.status(502).json({ error: `Failed to turn on ${LAMP_ENTITY}`, details: String(e) });
  }
});

app.post('/api/homeassistant/lamp/off', async (req, res) => {
  if (!HA_TOKEN) return res.status(500).json({ error: 'HA_TOKEN not set in environment' });
  try {
    await callService('switch/turn_off', LAMP_ENTITY);
    const state = await getEntityState(LAMP_ENTITY);
    res.json({ result: 'ok', entity_id: LAMP_ENTITY, power: state.state });
  } catch (e) {
    res.status(502).json({ error: `Failed to turn off ${LAMP_ENTITY}`, details: String(e) });
  }
});

// Basic health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Stargazer backend listening on http://localhost:${PORT}`);
});
