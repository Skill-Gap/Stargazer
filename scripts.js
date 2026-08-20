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
  navItems.forEach(item => {
    item.classList.remove('active');
    item.setAttribute('aria-pressed', 'false');
  });

  // Add active class to clicked item
  const activeNav = document.querySelector(`[data-section="${sectionId}"]`);
  if (activeNav) {
    activeNav.classList.add('active');
    activeNav.setAttribute('aria-pressed', 'true');
  }

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
const BASE_URL = '';

// Track current status to avoid redundant updates
let currentPiStatus = null;
let piStatusRequest = null;
let deviceStatusRequest = null;
let deviceStatusSequence = 0;
let lastAppliedDeviceSequence = 0;

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

function formatCheckedAt(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

function setStatusIndicator(dot, text, device) {
  if (!dot || !text) return;
  if (!device || device.configured !== true) {
    dot.className = 'status-indicator unconfigured';
    text.textContent = 'Not configured';
  } else if (device.online === true) {
    dot.className = 'status-indicator online';
    text.textContent = 'Online';
  } else {
    dot.className = 'status-indicator offline';
    text.textContent = 'Offline';
  }
}

function updateDeviceDashboard(data) {
  const devices = data?.devices || {};
  const checkedAt = formatCheckedAt(data?.checked_at);
  const pi = devices.pi;
  const desktop = devices.desktop;

  const piChecked = document.getElementById('pi-last-checked');
  const desktopChecked = document.getElementById('desktop-last-checked');
  if (piChecked) piChecked.textContent = checkedAt;
  if (desktopChecked) desktopChecked.textContent = checkedAt;

  const desktopConnection = document.getElementById('desktop-conn');
  if (desktopConnection) desktopConnection.textContent = desktop?.configured ? (desktop.connection || 'Unavailable') : 'Not configured';

  const system = pi?.online ? pi.system : null;
  const stats = {
    'pi-cpu': system ? `CPU: ${Number(system.cpu_percent).toFixed(1)}%` : 'CPU: —',
    'pi-memory': system ? `Memory: ${Number(system.memory_percent).toFixed(1)}%` : 'Memory: —',
    'pi-disk': system ? `Disk: ${Number(system.disk_percent).toFixed(1)}%` : 'Disk: —',
    'pi-uptime': system ? `Uptime: ${formatUptime(Number(system.uptime_seconds))}` : 'Uptime: —'
  };
  Object.entries(stats).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  });

  const links = [...new Set(Object.values(devices).filter(device => device?.online && device.connection).map(device => device.connection))];
  const activeLinks = document.getElementById('activeLinks');
  if (activeLinks) activeLinks.textContent = links.length ? links.join(', ') : 'None';
}

function showDeviceStatusFailure(message) {
  const links = document.getElementById('activeLinks');
  if (links) links.textContent = 'Unavailable';
  console.warn('Device status refresh failed', message);
}

async function performDeviceStatusCheck(isManual = false) {
  const button = document.getElementById('piStatusCheck');
  if (isManual) {
    if (button) button.disabled = true;
  }
  if (!deviceStatusRequest) {
    const sequence = ++deviceStatusSequence;
    deviceStatusRequest = fetchWithTimeout('/api/devices/status', {}, 5000)
      .then(async response => {
        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new Error(errorData?.error?.message || 'Device status request failed');
        }
        const data = await response.json();
        if (sequence >= lastAppliedDeviceSequence) {
          updateDeviceDashboard(data);
          lastAppliedDeviceSequence = sequence;
        }
        return data;
      })
      .catch(error => {
        if (sequence >= lastAppliedDeviceSequence) {
          showDeviceStatusFailure(error.message);
          lastAppliedDeviceSequence = sequence;
        }
        return null;
      })
      .finally(() => {
        deviceStatusRequest = null;
      });
  }
  try {
    return await deviceStatusRequest;
  } finally {
    if (button) button.disabled = false;
  }
}

function autoCheckDeviceStatus() {
  performDeviceStatusCheck(false);
  setInterval(() => performDeviceStatusCheck(false), 15000);
}

// Fetch Pi status directly from the Pi with a timeout (frontend-only)
async function checkPiStatus() {
  // Use backend base URL for Pi status
  const endpoints = [
    `${BASE_URL}/api/pi/status`
  ];

  for (const url of endpoints) {
    try {
      // Allow the gateway time to return its own normalized upstream timeout.
      const res = await fetchWithTimeout(url, {}, 7000);
      if (res && res.ok) {
        const data = await res.json().catch(() => null);
        if (data && data.status === 'online' && data.system) {
          return { status: 'ONLINE', data, url };
        }
        return { status: 'ERROR', data: null, message: 'Invalid status response' };
      }
      if (res) {
        const data = await res.json().catch(() => null);
        return {
          status: res.status === 503 ? 'UNCONFIGURED' : 'ERROR',
          data: null,
          message: data?.error?.message || 'Status check failed'
        };
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
        cpuEl.textContent = `CPU: ${Number(systemData.cpu_percent).toFixed(1)}%`;
      }
    }

    if (systemData.memory_percent !== undefined) {
      const memEl = document.getElementById('pi-memory');
      if (memEl) {
        memEl.textContent = `Memory: ${Number(systemData.memory_percent).toFixed(1)}%`;
      }
    }

    if (systemData.disk_percent !== undefined) {
      const diskEl = document.getElementById('pi-disk');
      if (diskEl) {
        diskEl.textContent = `Disk: ${Number(systemData.disk_percent).toFixed(1)}%`;
      }
    }

    if (systemData.uptime_seconds !== undefined) {
      const uptimeEl = document.getElementById('pi-uptime');
      if (uptimeEl) {
        uptimeEl.textContent = `Uptime: ${formatUptime(systemData.uptime_seconds)}`;
      }
    }
  } else {
    const label = result.status === 'UNCONFIGURED' ? 'NOT CONFIGURED' :
      result.status === 'ERROR' ? 'ERROR' : 'OFFLINE';
    statusText.textContent = result.message ? `${label}: ${result.message}` : label;
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

  if (!piStatusRequest) piStatusRequest = checkPiStatus();
  const button = document.getElementById('piStatusCheck');
  if (button && isManual) button.disabled = true;
  try {
    const result = await piStatusRequest;
    updatePiStatusUI(result);
    return result;
  } finally {
    piStatusRequest = null;
    if (button) button.disabled = false;
  }
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
  const time = document.createElement('span');
  time.className = 'log-time';
  time.textContent = timeStr;
  const text = document.createElement('span');
  text.className = 'log-message';
  text.textContent = message;
  entry.append(time, text);
  entries.prepend(entry);
}

async function connectPi() {
  addActivityLog('Raspberry Pi - Connect requested');
  try {
    const button = document.getElementById('piConnect');
    if (button) button.disabled = true;
    const res = await fetch('/api/pi/connect', { method: 'POST' });
    if (res.ok) {
      addActivityLog('Raspberry Pi - Launched local connection helper');
      return;
    }
    const data = await res.json().catch(() => null);
    throw new Error(data?.error?.message || 'Connection helper failed');
  } catch (e) {
    console.error(e);
    addActivityLog(`Raspberry Pi - ${e.message || 'Connect failed'}`);
  } finally {
    const button = document.getElementById('piConnect');
    if (button) button.disabled = false;
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

  const connectButton = document.getElementById('piConnect');
  const statusButton = document.getElementById('piStatusCheck');
  if (connectButton) connectButton.addEventListener('click', connectPi);
  if (statusButton) statusButton.addEventListener('click', () => performDeviceStatusCheck(true));
}


// ===== DESKTOP CARD HELPERS =====

// Desktop target configuration
const DESKTOP_LOCAL_BASE = '';
const DESKTOP_TAILSCALE_BASE = '';

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

// Desktop status is deferred until a backend contract is available.
async function checkDesktopStatus(isManual = false) {
  return { status: 'UNCONFIGURED' };
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
    const resPi = await fetchWithTimeout(`${BASE_URL}/connect`, { method: 'POST' }, 10000);
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
  appendDesktopTerminal('Trying local connection...');
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
  const cmd = 'Desktop connection is not configured.';
  try { await navigator.clipboard.writeText(cmd); addActivityLog('Desktop - SSH command copied'); appendDesktopTerminal('SSH command copied to clipboard.'); alert(`SSH command copied to clipboard:\n${cmd}`); return; } catch (e) { addActivityLog('Desktop - SSH command shown'); appendDesktopTerminal('SSH command: ' + cmd); alert(`Use this SSH command: ${cmd}`); return; }
}



// Add activity to desktop terminal (from desktop file)
function addDesktopLog(message) {

    const terminal = document.getElementById("desktopTerminal");
    if (!terminal) return;

    const time = new Date().toLocaleTimeString();

    const line = document.createElement('div');
    line.className = 'terminal-line';
    const timeElement = document.createElement('span');
    timeElement.className = 'term-time';
    timeElement.textContent = time;
    const textElement = document.createElement('span');
    textElement.className = 'term-text';
    textElement.textContent = message;
    line.append(timeElement, textElement);
    terminal.appendChild(line);

    terminal.scrollTop = terminal.scrollHeight;
}

// Keep existing API used elsewhere as a thin wrapper
function appendDesktopTerminal(message){
  addDesktopLog(message);
}

// Desktop SSH connect
function connectDesktop() {
    addDesktopLog('Desktop connection is not configured.');
}

function wireDesktopCard(){
  const card = document.getElementById('desktopCard');
  if(!card) return;

  const connectBtn = card.querySelector('button[title="Open SSH session to Desktop"]');
  const checkBtn = card.querySelector('button[title="Check Desktop system status"]');

  if (connectBtn) connectBtn.disabled = true;
  if (checkBtn) checkBtn.disabled = true;
}


// ===== HOME ASSISTANT HELPERS =====

// Browser API calls stay on the Express-served dashboard origin.
const HA_API_BASE = '';

async function fetchHomeAssistantStatus() {
  const connEl = document.getElementById('haConnection');
  const updatedEl = document.getElementById('haLastUpdated');
  const haDot = document.getElementById('haStatusDot');
  if (connEl) connEl.textContent = 'Checking…';
  if (haDot) haDot.className = 'status-indicator checking';
  try {
    const res = await fetch(`${HA_API_BASE}/api/homeassistant/status`);
    if (!res.ok) {
      const errorData = await res.json().catch(() => null);
      throw new Error(errorData?.error?.message || 'Home Assistant status check failed');
    }
    const data = await res.json();

    const devices = (data && data.devices) ? data.devices : {};

    if (connEl && updatedEl) {
      const reachable = (typeof data.reachable !== 'undefined') ? data.reachable : true;
      connEl.textContent = reachable ? 'Connected' : 'Unreachable';
      updatedEl.textContent = data.last_updated || new Date().toLocaleString();
      if (haDot) haDot.className = reachable ? 'status-indicator online-tailscale' : 'status-indicator offline';
    }

    function normalizeDevice(info, entityId) {
      if (!info || typeof info !== 'object') {
        return { entity_id: entityId, state: 'unavailable', available: false, friendly_name: null, last_updated: null };
      }
      const state = String(info.state || 'unknown').toLowerCase();
      return {
        entity_id: info.entity_id || entityId,
        state,
        available: typeof info.available === 'boolean' ? info.available : !['unavailable', 'unknown'].includes(state),
        friendly_name: info.friendly_name || null,
        last_updated: info.last_updated || null
      };
    }

    const piInfo = normalizeDevice(devices.pi, 'pi');
    const deskInfo = normalizeDevice(devices.desktop, 'desktop');
    const lampInfo = normalizeDevice(devices.lamp, 'lamp');
    const tvInfo = normalizeDevice(devices.tv, 'tv');

    function applyInfo(info, targetIds) {
      const nameEl = document.getElementById(targetIds.name);
      const powerEl = document.getElementById(targetIds.power);
      const lastEl = document.getElementById(targetIds.last);
      const dotEl = document.getElementById(targetIds.dot);

      if (nameEl) nameEl.textContent = info.friendly_name || info.entity_id || '—';
      const state = info.state || 'unknown';
      if (powerEl) powerEl.textContent = state.toUpperCase();
      if (lastEl) lastEl.textContent = info.last_updated || '—';

      if (dotEl) {
        if (!info.available || state === 'unavailable') dotEl.className = 'status-indicator offline';
        else if (state === 'unknown') dotEl.className = 'status-indicator unconfigured';
        else if (state === 'off') dotEl.className = 'status-indicator checking';
        else dotEl.className = 'status-indicator online-tailscale';
      }

      [targetIds.on, targetIds.off].forEach(id => {
        const control = id ? document.getElementById(id) : null;
        if (control) control.disabled = !info.available;
      });
    }

    function applySummary(info, prefix) {
      const dot = document.getElementById(`${prefix}StatusDot`);
      const text = document.getElementById(`${prefix}StatusText`);
      const entity = document.getElementById(`${prefix}EntityId`);
      const last = document.getElementById(`${prefix}SummaryLastUpdated`);
      const state = info.state || 'unknown';
      if (dot) {
        if (!info.available || state === 'unavailable') dot.className = 'status-indicator offline';
        else if (state === 'unknown') dot.className = 'status-indicator unconfigured';
        else if (state === 'off') dot.className = 'status-indicator checking';
        else dot.className = 'status-indicator online-tailscale';
      }
      if (text) text.textContent = !info.available ? 'Unavailable' : state.toUpperCase();
      if (entity) entity.textContent = info.entity_id || '—';
      if (last) last.textContent = info.last_updated || '—';
    }

    applyInfo(piInfo, { name: 'haPiName', power: 'haPiPower', last: 'haPiLastUpdated', dot: 'haPiDot' });
    applyInfo(deskInfo, { name: 'haDesktopName', power: 'haDesktopPower', last: 'haDesktopLastUpdated', dot: 'haDesktopDot', on: 'haDesktopOn', off: 'haDesktopOff' });
    applyInfo(lampInfo, { name: 'haLampName', power: 'haLampPower', last: 'haLampLastUpdated', dot: 'haLampDot', on: 'haLampOn', off: 'haLampOff' });
    applyInfo(tvInfo, { name: 'haTvName', power: 'haTvPower', last: 'haTvLastUpdated', dot: 'haTvDot', on: 'haTvOn', off: 'haTvOff' });
    applySummary(lampInfo, 'lamp');
    applySummary(deskInfo, 'desktop');
    applySummary(piInfo, 'piHa');
    applySummary(tvInfo, 'tv');

    const fourDevices = [lampInfo, deskInfo, piInfo, tvInfo];
    const availableCount = fourDevices.filter(device => device.available).length;
    const count = document.getElementById('systemsOnlineCount');
    const dashboardStatus = document.getElementById('dashboardStatus');
    if (count) count.textContent = `${availableCount}/4`;
    if (dashboardStatus) dashboardStatus.textContent = `Devices: ${availableCount}/4 available`;
    const health = document.getElementById('systemsHealth');
    if (health) {
      health.textContent = availableCount === 4 ? '● Optimal' : '● Degraded';
      health.className = `status-value ${availableCount === 4 ? 'status-healthy' : ''}`.trim();
    }

  } catch (e) {
    console.warn('Failed to fetch Home Assistant status', e);
    if (connEl) connEl.textContent = e.message || 'Unavailable';
    if (updatedEl) updatedEl.textContent = new Date().toLocaleString();
    if (haDot) haDot.className = 'status-indicator offline';
    ['Lamp', 'Desktop', 'Pi', 'Tv'].forEach(label => {
      const state = document.getElementById(`ha${label}Power`);
      const dot = document.getElementById(`ha${label}Dot`);
      if (state) state.textContent = 'UNAVAILABLE';
      if (dot) dot.className = 'status-indicator offline';
    });
    ['lamp', 'desktop', 'piHa', 'tv'].forEach(prefix => {
      const dot = document.getElementById(`${prefix}StatusDot`);
      const text = document.getElementById(`${prefix}StatusText`);
      if (dot) dot.className = 'status-indicator offline';
      if (text) text.textContent = 'Unavailable';
    });
    const count = document.getElementById('systemsOnlineCount');
    const dashboardStatus = document.getElementById('dashboardStatus');
    const health = document.getElementById('systemsHealth');
    if (count) count.textContent = '0/4';
    if (dashboardStatus) dashboardStatus.textContent = 'Devices: 0/4 available';
    if (health) {
      health.textContent = '● Unavailable';
      health.className = 'status-value';
    }
    ['haLampOn', 'haLampOff', 'haDesktopOn', 'haDesktopOff', 'haTvOn', 'haTvOff'].forEach(id => {
      const control = document.getElementById(id);
      if (control) control.disabled = true;
    });
  }
}

async function toggleHomeAssistantPlug(device, action) {
  if (!['lamp', 'desktop', 'tv'].includes(device)) return;
  const labels = { lamp: 'Lamp', desktop: 'Desktop', tv: 'Tv' };
  const button = document.getElementById(`ha${labels[device]}${action === 'on' ? 'On' : 'Off'}`);
  if (button) button.disabled = true;
  try {
    const res = await fetch(`${HA_API_BASE}/api/homeassistant/${device}/${action}`, { method: 'POST' });
    if (!res.ok) throw new Error('Request failed');
    const data = await res.json();
    const powerEl = document.getElementById(`ha${labels[device]}Power`);
    if (powerEl) powerEl.textContent = data.power ? data.power.toUpperCase() : action.toUpperCase();
    addActivityLog(`Home Assistant - ${device} -> ${action}`);
    await fetchHomeAssistantStatus();
  } catch (e) {
    console.error(e);
    addActivityLog(`Home Assistant - ${device} update failed`);
    const connEl = document.getElementById('haConnection');
    if (connEl) connEl.textContent = 'Device update failed';
    if (button) button.disabled = false;
  }
}

function setupHomeAssistantSection() {
  const onDesk = document.getElementById('haDesktopOn');
  const offDesk = document.getElementById('haDesktopOff');
  const onLamp = document.getElementById('haLampOn');
  const offLamp = document.getElementById('haLampOff');
  const onTv = document.getElementById('haTvOn');
  const offTv = document.getElementById('haTvOff');

  if (onDesk) onDesk.addEventListener('click', () => toggleHomeAssistantPlug('desktop', 'on'));
  if (offDesk) offDesk.addEventListener('click', () => toggleHomeAssistantPlug('desktop', 'off'));
  if (onLamp) onLamp.addEventListener('click', () => toggleHomeAssistantPlug('lamp', 'on'));
  if (offLamp) offLamp.addEventListener('click', () => toggleHomeAssistantPlug('lamp', 'off'));
  if (onTv) onTv.addEventListener('click', () => toggleHomeAssistantPlug('tv', 'on'));
  if (offTv) offTv.addEventListener('click', () => toggleHomeAssistantPlug('tv', 'off'));

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
  autoCheckDeviceStatus();
  setupHomeAssistantSection();
});
