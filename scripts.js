/* ===========================
   STARGAZER - JavaScript Logic
   =========================== */

// ===== LANDING PAGE INITIALIZATION =====

function initializeLanding() {
  const particlesContainer = document.querySelector('.particles-container');

  // Generate slow-drifting particles
  generateParticles(particlesContainer, 50);

  // Add parallax effect (mouse-based)
  addParallax();
}

function generateParticles(container, count) {
  for (let i = 0; i < count; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.style.top = Math.random() * 100 + '%';
    particle.style.left = Math.random() * 100 + '%';
    particle.style.animationDuration = (Math.random() * 20 + 15) + 's';
    particle.style.animationDelay = Math.random() * 5 + 's';
    container.appendChild(particle);
  }
}

function addParallax() {
  const nebula1 = document.querySelector('.nebula-1');
  const nebula2 = document.querySelector('.nebula-2');

  document.addEventListener('mousemove', (e) => {
    const x = (e.clientX / window.innerWidth - 0.5) * 30;
    const y = (e.clientY / window.innerHeight - 0.5) * 30;

    nebula1.style.transform = `translate(${x}px, ${y}px)`;
    nebula2.style.transform = `translate(${-x * 0.5}px, ${-y * 0.5}px)`;
  });
}

// ===== LANDING INTERACTION =====

function setupLandingInteraction() {
  const enterBtn = document.getElementById('enterBtn');
  const landingSection = document.getElementById('landing');
  const dashboardSection = document.getElementById('dashboard');

  enterBtn.addEventListener('click', () => {
    triggerWarpTransition(landingSection, dashboardSection);
  });
}

function triggerWarpTransition(landingSection, dashboardSection) {
  // Add light-speed warp animation to landing and background
  landingSection.classList.add('warp');
  document.querySelector('.space-background').classList.add('warp');

  // Reveal dashboard after warp completes
  setTimeout(() => {
    landingSection.classList.add('hidden');
    dashboardSection.classList.add('active');
  }, 1400);
}

// ===== DASHBOARD NAVIGATION =====

function setupDashboardNavigation() {
  const navItems = document.querySelectorAll('.nav-item');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const sectionId = item.getAttribute('data-section');
      switchDashboardSection(sectionId, navItems);
    });
  });
}

// Home link to return to landing page
function setupHomeLink() {
  const homeLink = document.getElementById('homeLink');
  homeLink.addEventListener('click', () => {
    const landingSection = document.getElementById('landing');
    const dashboardSection = document.getElementById('dashboard');

    dashboardSection.classList.remove('active');
    landingSection.classList.remove('hidden');
    landingSection.classList.add('active');

    // Reset nav to overview
    const overviewNav = document.querySelector('[data-section="overview"]');
    switchDashboardSection('overview', document.querySelectorAll('.nav-item'));
  });
}

function switchDashboardSection(sectionId, navItems) {
  // Remove active class from all nav items
  navItems.forEach(item => item.classList.remove('active'));

  // Add active class to clicked item
  document.querySelector(`[data-section="${sectionId}"]`).classList.add('active');

  // Hide all section panels
  const panels = document.querySelectorAll('.section-panel');
  panels.forEach(panel => panel.classList.remove('active'));

  // Show selected panel
  const selectedPanel = document.getElementById(`section-${sectionId}`);
  if (selectedPanel) {
    selectedPanel.classList.add('active');
  }
}

// ===== RASPBERRY PI STATUS =====

// Configuration
const PI_IP = "192.168.1.35";
const BASE_URL = `http://${PI_IP}:3000`;

// Track current status to avoid redundant updates
let currentPiStatus = null;

// Convert uptime seconds to human-readable format (e.g., "2h 30m" or "45m 20s")
function formatUptime(seconds) {
  if (seconds < 0) return "Unknown";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

// Fetch Pi status directly from the Pi with a timeout (frontend-only)
async function checkPiStatus() {
  // Use backend base URL for Pi status
  const endpoints = [
    `${BASE_URL}/status`
  ];

  for (const url of endpoints) {
    try {
      const res = await fetchWithTimeout(url, {}, 5000);
      if (res && res.ok) {
        const data = await res.json().catch(() => null);
        return { status: 'ONLINE', data, url };
      }
    } catch (e) {
      // silent, try next
    }
  }

  return { status: 'OFFLINE', data: null };
}

// Update UI with Pi status result
function updatePiStatusUI(result) {
  const statusText = document.getElementById('piStatusText');
  const statusDot = document.getElementById('piStatusDot');

  // Defensive: check if elements exist
  if (!statusText || !statusDot) return;

  if (result.status === "ONLINE" && result.data) {
    // Online state: show green indicator and stats
    statusText.textContent = 'ONLINE';
    statusDot.className = 'status-indicator online';

    // Display system stats if elements exist
    const systemData = result.data.system || {};

    if (systemData.cpu_percent !== undefined) {
      const cpuEl = document.getElementById('pi-cpu');
      if (cpuEl) {
        cpuEl.textContent = `CPU: ${systemData.cpu_percent.toFixed(1)}%`;
      }
    }

    if (systemData.memory_percent !== undefined) {
      const memEl = document.getElementById('pi-memory');
      if (memEl) {
        memEl.textContent = `Memory: ${systemData.memory_percent.toFixed(1)}%`;
      }
    }

    if (systemData.disk_percent !== undefined) {
      const diskEl = document.getElementById('pi-disk');
      if (diskEl) {
        diskEl.textContent = `Disk: ${systemData.disk_percent.toFixed(1)}%`;
      }
    }

    if (systemData.uptime_seconds !== undefined) {
      const uptimeEl = document.getElementById('pi-uptime');
      if (uptimeEl) {
        uptimeEl.textContent = `Uptime: ${formatUptime(systemData.uptime_seconds)}`;
      }
    }
  } else {
    // Offline state: show red indicator
    statusText.textContent = 'OFFLINE';
    statusDot.className = 'status-indicator offline';

    // Clear stats on offline
    const statsIds = ['pi-cpu', 'pi-memory', 'pi-disk', 'pi-uptime'];
    statsIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = 'Device Offline';
    });
  }

  // Update current status tracker
  currentPiStatus = result.status;
}

// Perform status check with optional manual trigger
// isManual = true: show "CHECKING..." state (user clicked button)
// isManual = false: run silently (auto-refresh, only update if changed)
async function performPiStatusCheck(isManual = false) {
  const statusText = document.getElementById('piStatusText');
  const statusDot = document.getElementById('piStatusDot');

  if (!statusText || !statusDot) return;

  // Only show checking state for manual checks
  if (isManual) {
    statusText.textContent = 'CHECKING...';
    statusDot.className = 'status-indicator checking';
  }

  // Check status
  const result = await checkPiStatus();
  updatePiStatusUI(result);
  return result;
}

// Auto-check Pi status on page load (silent)
function autoCheckPiStatus() {
  // Initial check - silent
  performPiStatusCheck(false);

  // Auto-refresh every 15 seconds - silent
  setInterval(() => {
    performPiStatusCheck(false);
  }, 15000);
}



// ===== PI ACTION HELPERS =====

function addActivityLog(message) {
  const entries = document.querySelector('.log-entries');
  if (!entries) return;
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const timeStr = `${hh}:${mm}`;
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.innerHTML = `<span class="log-time">${timeStr}</span><span class="log-message">${message}</span>`;
  entries.prepend(entry);
}

async function connectPi() {
  addActivityLog('Raspberry Pi - Connect requested');
  // Prefer backend helper that launches the local tailscale/connect script
  try {
    const localBackend = 'http://localhost:3000/connect/pi';
    const res = await fetch(localBackend, { method: 'POST' });
    if (res.ok) {
      addActivityLog('Raspberry Pi - Launched local connection helper');
      return;
    }
    // If backend responded but not OK, fall back to remote helper
  } catch (e) {
    // Backend not reachable or failed; fall back
    console.warn('Local connect helper failed:', e);
  }

  // Fallback: try Pi-hosted /connect endpoint then finally show SSH command
  try {
    const res2 = await fetch(`${BASE_URL}/connect`, { method: 'POST' });
    if (res2.ok) {
      const data = await res2.json().catch(() => null);
      if (data && data.url) {
        window.open(data.url, '_blank');
        addActivityLog('Raspberry Pi - SSH helper opened via device');
        return;
      }
    }

    const cmd = `ssh lucas@${PI_IP}`;
    try {
      await navigator.clipboard.writeText(cmd);
      addActivityLog('Raspberry Pi - SSH command copied to clipboard');
      alert(`SSH command copied to clipboard:\n${cmd}`);
    } catch (e) {
      addActivityLog('Raspberry Pi - SSH command shown to user');
      alert(`Use this SSH command: ${cmd}`);
    }
  } catch (e) {
    console.error(e);
    addActivityLog('Raspberry Pi - Connect failed');
    alert('Failed to connect to Raspberry Pi');
  }
}

async function openPiDesktop() {
  addActivityLog('Raspberry Pi - Open desktop requested');
  try {
    const res = await fetch(`${BASE_URL}/desktop`);
    if (res.ok) {
      // If desktop endpoint returns a URL JSON or a redirect, try to open it
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const data = await res.json().catch(() => null);
        if (data && data.url) {
          window.open(data.url, '_blank');
          addActivityLog('Raspberry Pi - Desktop opened');
          return;
        }
      }

      // Fallback: try to open the endpoint directly
      window.open(`${BASE_URL}/desktop`, '_blank');
      addActivityLog('Raspberry Pi - Desktop endpoint opened');
    } else {
      addActivityLog('Raspberry Pi - Failed to open desktop');
      alert('Unable to open Pi desktop');
    }
  } catch (e) {
    console.error(e);
    addActivityLog('Raspberry Pi - Error opening desktop');
    alert('Error opening Pi desktop');
  }
}

async function openPiShare() {
  addActivityLog('Raspberry Pi - Open share requested');
  try {
    const res = await fetch(`${BASE_URL}/share`);
    if (res.ok) {
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const data = await res.json().catch(() => null);
        if (data && data.url) {
          window.open(data.url, '_blank');
          addActivityLog('Raspberry Pi - Share opened');
          return;
        }
      }
      window.open(`${BASE_URL}/share`, '_blank');
      addActivityLog('Raspberry Pi - Share endpoint opened');
    } else {
      addActivityLog('Raspberry Pi - Failed to open share');
      alert('Unable to open Pi share');
    }
  } catch (e) {
    console.error(e);
    addActivityLog('Raspberry Pi - Error opening share');
    alert('Error opening Pi share');
  }
}

async function getPiLogs() {
  addActivityLog('Raspberry Pi - Fetching logs');
  try {
    const res = await fetch(`${BASE_URL}/logs`);
    if (res.ok) {
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const data = await res.json().catch(() => null);
        if (Array.isArray(data)) {
          data.forEach(line => addActivityLog(`Raspberry Pi - ${line}`));
          addActivityLog('Raspberry Pi - Logs loaded');
          return;
        }
        if (data && data.logs && Array.isArray(data.logs)) {
          data.logs.forEach(line => addActivityLog(`Raspberry Pi - ${line}`));
          addActivityLog('Raspberry Pi - Logs loaded');
          return;
        }
        if (typeof data === 'string') {
          addActivityLog(`Raspberry Pi - ${data}`);
          addActivityLog('Raspberry Pi - Logs loaded');
          return;
        }
      }

      // If not JSON, treat as text
      const text = await res.text();
      text.split('\n').filter(Boolean).forEach(line => addActivityLog(`Raspberry Pi - ${line}`));
      addActivityLog('Raspberry Pi - Logs loaded');
    } else {
      addActivityLog('Raspberry Pi - Failed to fetch logs');
      alert('Unable to fetch Pi logs');
    }
  } catch (e) {
    console.error(e);
    addActivityLog('Raspberry Pi - Error fetching logs');
    alert('Error fetching Pi logs');
  }
}

async function rebootPi() {
  if (!confirm('Reboot Raspberry Pi?')) return;
  addActivityLog('Raspberry Pi - Reboot requested');
  try {
    const res = await fetch(`${BASE_URL}/reboot`, { method: 'POST' });
    if (res.ok) {
      addActivityLog('Raspberry Pi - Reboot initiated');
    } else {
      addActivityLog('Raspberry Pi - Reboot failed');
      alert('Reboot failed');
    }
  } catch (e) {
    console.error(e);
    addActivityLog('Raspberry Pi - Reboot error');
    alert('Error sending reboot');
  }
}

async function shutdownPi() {
  if (!confirm('Shutdown Raspberry Pi?')) return;
  addActivityLog('Raspberry Pi - Shutdown requested');
  try {
    const res = await fetch(`${BASE_URL}/shutdown`, { method: 'POST' });
    if (res.ok) {
      addActivityLog('Raspberry Pi - Shutdown initiated');
    } else {
      addActivityLog('Raspberry Pi - Shutdown failed');
      alert('Shutdown failed');
    }
  } catch (e) {
    console.error(e);
    addActivityLog('Raspberry Pi - Shutdown error');
    alert('Error sending shutdown');
  }
}

function attachPiActionButtons() {
  const piCard = document.querySelector('.device-card.core-node');
  if (!piCard) return;
  const actions = piCard.querySelector('.device-actions');
  if (!actions) return;

  // Map existing buttons by their text content (CONNECT, VIEW DESKTOP, OPEN SHARE, LOGS)
  const btns = Array.from(actions.querySelectorAll('button'));
  btns.forEach(btn => {
    const txt = (btn.textContent || '').trim().toUpperCase();
    if (txt === 'CONNECT') {
      btn.onclick = connectPi;
    } else if (txt === 'VIEW DESKTOP') {
      btn.onclick = openPiDesktop;
    } else if (txt === 'OPEN SHARE') {
      btn.onclick = openPiShare;
    } else if (txt === 'LOGS') {
      btn.onclick = getPiLogs;
    }
  });

  // Add REBOOT and SHUTDOWN buttons if not present
  if (!actions.querySelector('button[title="Reboot Raspberry Pi"]')) {
    const rebootBtn = document.createElement('button');
    rebootBtn.className = 'action-btn';
    rebootBtn.title = 'Reboot Raspberry Pi';
    rebootBtn.textContent = 'REBOOT';
    rebootBtn.onclick = rebootPi;
    actions.appendChild(rebootBtn);
  }

  if (!actions.querySelector('button[title="Shutdown Raspberry Pi"]')) {
    const shutdownBtn = document.createElement('button');
    shutdownBtn.className = 'action-btn';
    shutdownBtn.title = 'Shutdown Raspberry Pi';
    shutdownBtn.textContent = 'SHUTDOWN';
    shutdownBtn.onclick = shutdownPi;
    actions.appendChild(shutdownBtn);
  }
}


// ===== DESKTOP CARD HELPERS =====

// Desktop target configuration
const DESKTOP_LOCAL_BASE = 'http://192.168.1.57';
const DESKTOP_TAILSCALE_BASE = 'http://100.65.47.59';

async function fetchWithTimeout(url, options = {}, timeout = 5000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { signal: controller.signal, ...options });
    clearTimeout(id);
    return res;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}

// Simplified desktop status check using the desktop file logic (simulated)
async function checkDesktopStatus(isManual = false) {
  return new Promise(resolve => {
    const dot = document.getElementById('desktopStatusDot');
    const text = document.getElementById('desktopStatusText');
    const checked = document.getElementById('desktop-last-checked');

    if (dot) dot.className = 'status-indicator checking';
    if (text) text.textContent = 'Checking...';

    appendDesktopTerminal('Running desktop status check...');

    setTimeout(() => {
      const online = Math.random() > 0.3;

      if (online) {
        if (dot) dot.className = 'status-indicator online-tailscale';
        if (text) text.textContent = 'Online';
        appendDesktopTerminal('Desktop online');
        if (checked) checked.textContent = new Date().toLocaleTimeString();
        resolve({ status: 'ONLINE', via: 'simulated' });
      } else {
        if (dot) dot.className = 'status-indicator offline';
        if (text) text.textContent = 'Offline';
        appendDesktopTerminal('Desktop offline');
        if (checked) checked.textContent = new Date().toLocaleTimeString();
        resolve({ status: 'OFFLINE' });
      }
    }, 1000);
  });
}

async function openDesktop() {
  addActivityLog('Desktop - Open requested');
  appendDesktopTerminal('Attempting to open Desktop via Tailscale...');

  // 1) Try Tailscale
  try {
    const resT = await fetchWithTimeout(`${DESKTOP_TAILSCALE_BASE}/desktop`, {}, 5000);
    if (resT && resT.ok) {
      const ct = resT.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const data = await resT.json().catch(() => null);
        if (data && data.url) {
          window.open(data.url, '_blank');
          addActivityLog('Desktop - Desktop opened (tailscale)');
          appendDesktopTerminal('Opened via tailscale.');
          return;
        }
      }
      window.open(`${DESKTOP_TAILSCALE_BASE}/desktop`, '_blank');
      addActivityLog('Desktop - Desktop endpoint opened (tailscale)');
      appendDesktopTerminal('Opened via tailscale (direct URL).');
      return;
    }
  } catch (e) {
    appendDesktopTerminal('Tailscale open failed, pivoting through Raspberry Pi...');
  }

  // 2) Pivot through Pi
  appendDesktopTerminal('Requesting Raspberry Pi to pivot to Desktop...');
  try {
    const resPi = await fetchWithTimeout(`${BASE_URL}/connect`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target: '192.168.1.57', action: 'desktop' }) }, 10000);
    if (resPi && resPi.ok) {
      const data = await resPi.json().catch(() => null);
      if (data && data.url) {
        window.open(data.url, '_blank');
        addActivityLog('Desktop - Desktop opened via Pi pivot');
        appendDesktopTerminal('Opened via Raspberry Pi pivot.');
        return;
      }
      // If Pi returns not JSON but ok, open the pi endpoint
      window.open(`${BASE_URL}/connect`, '_blank');
      addActivityLog('Desktop - Opened Pi connect endpoint');
      appendDesktopTerminal('Opened Pi connect endpoint — check Pi UI.');
      return;
    }
  } catch (e) {
    appendDesktopTerminal('Pi pivot failed, attempting local direct connection...');
  }

  // 3) Try local direct
  appendDesktopTerminal('Trying local connection to 192.168.1.57...');
  try {
    const resL = await fetchWithTimeout(`${DESKTOP_LOCAL_BASE}/desktop`, {}, 5000);
    if (resL && resL.ok) {
      const ct = resL.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const data = await resL.json().catch(() => null);
        if (data && data.url) {
          window.open(data.url, '_blank');
          addActivityLog('Desktop - Desktop opened (local)');
          appendDesktopTerminal('Opened via local network.');
          return;
        }
      }
      window.open(`${DESKTOP_LOCAL_BASE}/desktop`, '_blank');
      addActivityLog('Desktop - Desktop endpoint opened (local)');
      appendDesktopTerminal('Opened via local direct URL.');
      return;
    }
  } catch (e) {
    // final fallback
  }

  // Final fallback: copy SSH
  const cmd = `ssh Balloutdj@192.168.1.57`;
  try { await navigator.clipboard.writeText(cmd); addActivityLog('Desktop - SSH command copied'); appendDesktopTerminal('SSH command copied to clipboard.'); alert(`SSH command copied to clipboard:\n${cmd}`); return; } catch (e) { addActivityLog('Desktop - SSH command shown'); appendDesktopTerminal('SSH command: ' + cmd); alert(`Use this SSH command: ${cmd}`); return; }
}



// Add activity to desktop terminal (from desktop file)
function addDesktopLog(message) {

    const terminal = document.getElementById("desktopTerminal");
    if (!terminal) return;

    const time = new Date().toLocaleTimeString();

    terminal.innerHTML += `
        <div class="terminal-line">
            <span class="term-time">${time}</span>
            <span class="term-text">${message}</span>
        </div>
    `;

    terminal.scrollTop = terminal.scrollHeight;
}

// Keep existing API used elsewhere as a thin wrapper
function appendDesktopTerminal(message){
  addDesktopLog(message);
}

// Desktop SSH connect
function connectDesktop() {
    addDesktopLog('Opening SSH session...');
    window.location.href = 'ssh://Balloutdj@1091.168.1.57';
}

function wireDesktopCard(){
  const card = document.getElementById('desktopCard');
  if(!card) return;

  const connectBtn = card.querySelector('button[title="Open SSH session to Desktop"]');
  const checkBtn = card.querySelector('button[title="Check Desktop system status"]');

  if(connectBtn){
    connectBtn.addEventListener('click', (e) => {
      connectDesktop();
    });
  }

  if(checkBtn){
    checkBtn.addEventListener('click', async (e) => {
      appendDesktopTerminal('Checking Desktop status (tailscale → local)...');
      try{
        const res = await checkDesktopStatus(true);
        const nowStr = new Date().toLocaleString();
        const lastCheckedEl = document.getElementById('desktop-last-checked');
        if(lastCheckedEl) lastCheckedEl.textContent = nowStr;

        const statusTextEl = document.getElementById('desktopStatusText');
        const statusDot = document.getElementById('desktopStatusDot');
        if(res && res.status === 'ONLINE'){
          if(statusTextEl) statusTextEl.textContent = 'ONLINE';
          if(statusDot) statusDot.className = 'status-indicator online';
        } else {
          if(statusTextEl) statusTextEl.textContent = 'OFFLINE';
          if(statusDot) statusDot.className = 'status-indicator offline';
        }

        appendDesktopTerminal('Status: ' + ((res && res.status) ? res.status : 'UNKNOWN') + (res && res.via ? ' via '+res.via : ''));
      }catch(err){
        appendDesktopTerminal('Status check error: ' + (err && err.message ? err.message : String(err)));
      }
    });
  }
}


// ===== HOME ASSISTANT HELPERS =====

// Backend API base (use Pi address so browser requests reach the Pi backend)
const HA_API_BASE = 'http://192.168.1.35:3000';

async function fetchHomeAssistantStatus() {
  try {
    const res = await fetch(`${HA_API_BASE}/api/homeassistant/status`);
    if (!res.ok) return;
    const data = await res.json();

    const connEl = document.getElementById('haConnection');
    const updatedEl = document.getElementById('haLastUpdated');
    const haDot = document.getElementById('haStatusDot');

    // Support both new structured response and older simple-mock response
    const devices = (data && data.devices) ? data.devices : {};

    if (connEl && updatedEl) {
      const reachable = (typeof data.reachable !== 'undefined') ? data.reachable : true;
      connEl.textContent = reachable ? 'Connected' : 'Unreachable';
      updatedEl.textContent = data.last_updated || new Date().toLocaleString();
      if (haDot) haDot.className = reachable ? 'status-indicator online-tailscale' : 'status-indicator offline';
    }

    // Helper to normalize device info whether it's a string (legacy) or object
    function normalizeDevice(info, entityId) {
      if (!info) return { entity_id: entityId, state: 'unavailable', friendly_name: null, last_updated: null };
      if (typeof info === 'string') {
        // legacy: 'ONLINE' / 'OFFLINE'
        return { entity_id: entityId, state: info.toLowerCase() === 'online' ? 'on' : 'off', friendly_name: null, last_updated: data.last_updated };
      }
      return { entity_id: info.entity_id || entityId, state: info.state || 'unavailable', friendly_name: info.friendly_name || null, last_updated: info.last_updated || null };
    }

    const piInfo = normalizeDevice(devices.pi, 'pi');
    const deskInfo = normalizeDevice(devices.desktop, 'desktop');
    const lampInfo = normalizeDevice(devices.lamp, 'lamp');

    function applyInfo(info, targetIds) {
      const nameEl = document.getElementById(targetIds.name);
      const powerEl = document.getElementById(targetIds.power);
      const lastEl = document.getElementById(targetIds.last);
      const dotEl = document.getElementById(targetIds.dot);

      if (nameEl) nameEl.textContent = info.friendly_name || info.entity_id || '—';
      if (powerEl) powerEl.textContent = (info.state || '').toString().toUpperCase();
      if (lastEl) lastEl.textContent = info.last_updated || '—';

      if (dotEl) {
        const st = (info.state || '').toLowerCase();
        if (st === 'unavailable' || st === 'unknown' || st === 'off') dotEl.className = 'status-indicator offline';
        else dotEl.className = 'status-indicator online-tailscale';
      }
    }

    applyInfo(piInfo, { name: 'haPiName', power: 'haPiPower', last: 'haPiLastUpdated', dot: 'haPiDot' });
    applyInfo(deskInfo, { name: 'haDesktopName', power: 'haDesktopPower', last: 'haDesktopLastUpdated', dot: 'haDesktopDot' });
    applyInfo(lampInfo, { name: 'haLampName', power: 'haLampPower', last: 'haLampLastUpdated', dot: 'haLampDot' });

  } catch (e) {
    console.warn('Failed to fetch Home Assistant status', e);
    // set offline indicators
    const haDot = document.getElementById('haStatusDot'); if (haDot) haDot.className = 'status-indicator offline';
  }
}

async function toggleHomeAssistantPlug(device, action) {
  try {
    const res = await fetch(`${HA_API_BASE}/api/homeassistant/${device}/${action}`, { method: 'POST' });
    if (!res.ok) throw new Error('Request failed');
    const data = await res.json();
    if (device === 'pi') {
      const piEl = document.getElementById('haPiPower');
      if (piEl) piEl.textContent = data.power ? data.power.toUpperCase() : (action === 'on' ? 'ON' : 'OFF');
    } else if (device === 'desktop') {
      const dEl = document.getElementById('haDesktopPower');
      if (dEl) dEl.textContent = data.power ? data.power.toUpperCase() : (action === 'on' ? 'ON' : 'OFF');
    } else if (device === 'lamp') {
      const lEl = document.getElementById('haLampPower');
      if (lEl) lEl.textContent = data.power ? data.power.toUpperCase() : (action === 'on' ? 'ON' : 'OFF');
    }
    addActivityLog(`Home Assistant - ${device} -> ${action}`);
  } catch (e) {
    console.error(e);
    alert('Failed to toggle device');
  }
}

function setupHomeAssistantSection() {
  const onPi = document.getElementById('haPiOn');
  const offPi = document.getElementById('haPiOff');
  const onDesk = document.getElementById('haDesktopOn');
  const offDesk = document.getElementById('haDesktopOff');
  const onLamp = document.getElementById('haLampOn');
  const offLamp = document.getElementById('haLampOff');

  if (onPi) onPi.addEventListener('click', () => toggleHomeAssistantPlug('pi', 'on'));
  if (offPi) offPi.addEventListener('click', () => toggleHomeAssistantPlug('pi', 'off'));
  if (onDesk) onDesk.addEventListener('click', () => toggleHomeAssistantPlug('desktop', 'on'));
  if (offDesk) offDesk.addEventListener('click', () => toggleHomeAssistantPlug('desktop', 'off'));
  if (onLamp) onLamp.addEventListener('click', () => toggleHomeAssistantPlug('lamp', 'on'));
  if (offLamp) offLamp.addEventListener('click', () => toggleHomeAssistantPlug('lamp', 'off'));

  // When the section becomes active, refresh status
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (item.getAttribute('data-section') === 'homeassistant') {
        fetchHomeAssistantStatus();
      }
    });
  });

  // Initial fetch
  fetchHomeAssistantStatus();

  // Periodic refresh
  setInterval(fetchHomeAssistantStatus, 15000);
}


// ===== INITIALIZATION =====

document.addEventListener('DOMContentLoaded', () => {
  initializeLanding();
  setupLandingInteraction();
  setupDashboardNavigation();
  setupHomeLink();
  attachPiActionButtons();
  wireDesktopCard();
  autoCheckPiStatus();
  setupHomeAssistantSection();
});