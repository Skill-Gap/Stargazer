try { require('dotenv').config(); } catch (error) { /* dotenv is optional */ }

const express = require('express');
const cors = require('cors');
const { execFile } = require('child_process');
const fs = require('fs/promises');
const path = require('path');

const FRONTEND_ROOT = path.resolve(__dirname, '..');
const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_JOURNAL_DATA_FILE = path.join(__dirname, 'data', 'journal-entries.json');
const MAX_JOURNAL_ENTRIES = 1000;

function jsonError(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

function validateJournalEntry(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const stringWithin = (field, max, allowEmpty = true) => (
    typeof value[field] === 'string' && value[field].length <= max && (allowEmpty || value[field].trim().length > 0)
  );
  if (!stringWithin('id', 128, false)
      || !stringWithin('title', 200)
      || !stringWithin('mood', 50)
      || !stringWithin('content', 12000)
      || !stringWithin('createdAt', 64, false)
      || Number.isNaN(Date.parse(value.createdAt))
      || !Array.isArray(value.tags)
      || value.tags.length > 20
      || value.tags.some((tag) => typeof tag !== 'string' || tag.length > 50)) return null;
  return {
    id: value.id,
    title: value.title,
    mood: value.mood,
    tags: [...value.tags],
    content: value.content,
    createdAt: value.createdAt
  };
}

async function requestWithTimeout(fetchImpl, url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetchImpl(url, { ...options, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

function defaultLauncher(callback) {
  const script = path.join(__dirname, 'scripts', 'connect-pi.bat');
  execFile('cmd.exe', ['/c', 'start', '', script], { windowsHide: true }, callback);
}

function defaultPing(ip) {
  return new Promise((resolve) => {
    execFile('ping', ['-n', '1', ip], { windowsHide: true, timeout: DEFAULT_TIMEOUT_MS }, (error) => resolve(!error));
  });
}

function createApp(options = {}) {
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || global.fetch;
  const launchConnection = options.launchConnection || defaultLauncher;
  const ping = options.ping || defaultPing;
  const probe = options.probe || ping;
  const now = options.now || (() => new Date());
  const journalDataFile = path.resolve(env.JOURNAL_DATA_FILE || DEFAULT_JOURNAL_DATA_FILE);
  let journalWriteQueue = Promise.resolve();
  const configuredTimeout = Number.parseInt(env.UPSTREAM_TIMEOUT_MS, 10);
  const timeoutMs = Number.isFinite(configuredTimeout) && configuredTimeout > 0 ? configuredTimeout : DEFAULT_TIMEOUT_MS;
  const piApiUrl = (env.PI_API_URL || '').replace(/\/$/, '');
  const haUrl = (env.HA_URL || '').replace(/\/$/, '');
  const haToken = env.HA_TOKEN;
  const haDevices = {
    lamp: { entityId: env.LAMP_ENTITY || 'switch.ihome_ww117_smart_plug_socket_1', serviceDomain: 'switch' },
    desktop: { entityId: env.DESKTOP_PLUG_ENTITY || 'switch.desktop_socket_1', serviceDomain: 'switch' },
    pi: { entityId: env.PI_PLUG_ENTITY || 'switch.pi_socket_1', serviceDomain: null },
    tv: { entityId: env.TV_ENTITY || 'media_player.tv_un75nu6900', serviceDomain: 'media_player' }
  };

  const app = express();
  const allowedOrigins = (env.ALLOWED_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean);
  if (allowedOrigins.length) {
    app.use(cors({ origin: (origin, callback) => callback(null, !origin || allowedOrigins.includes(origin)) }));
  }
  app.use(express.json({ limit: '16kb' }));

  // Explicit mounts prevent backend files and secrets from becoming public.
  const pages = new Map([['/', 'index.html'], ['/index.html', 'index.html'], ['/deep-dive.html', 'deep-dive.html'], ['/stargazer.html', 'stargazer.html']]);
  for (const [route, file] of pages) app.get(route, (req, res) => res.sendFile(file, { root: FRONTEND_ROOT, dotfiles: 'deny' }));
  for (const file of ['styles.css', 'scripts.js', 'transition.js']) app.get(`/${file}`, (req, res) => res.sendFile(file, { root: FRONTEND_ROOT, dotfiles: 'deny' }));
  app.use('/assets', express.static(path.join(FRONTEND_ROOT, 'assets'), { dotfiles: 'deny', fallthrough: true, index: false }));

  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  async function loadJournalEntries() {
    try {
      const parsed = JSON.parse(await fs.readFile(journalDataFile, 'utf8'));
      if (!parsed || !Array.isArray(parsed.entries)) throw new Error('Invalid journal data');
      return parsed.entries;
    } catch (error) {
      if (error && error.code === 'ENOENT') return [];
      throw error;
    }
  }

  async function saveJournalEntries(entries) {
    await fs.mkdir(path.dirname(journalDataFile), { recursive: true });
    const temporaryFile = `${journalDataFile}.${process.pid}.${Date.now()}.tmp`;
    try {
      await fs.writeFile(temporaryFile, `${JSON.stringify({ entries }, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
      await fs.rename(temporaryFile, journalDataFile);
    } catch (error) {
      await fs.rm(temporaryFile, { force: true }).catch(() => {});
      throw error;
    }
  }

  app.get('/api/journal/entries', async (req, res) => {
    try {
      return res.json({ entries: await loadJournalEntries() });
    } catch (error) {
      console.error('Journal entries could not be loaded');
      return jsonError(res, 500, 'JOURNAL_LOAD_FAILED', 'Journal entries could not be loaded.');
    }
  });

  app.post('/api/journal/entries', async (req, res) => {
    const entry = validateJournalEntry(req.body);
    if (!entry) return jsonError(res, 400, 'INVALID_JOURNAL_ENTRY', 'Journal entry is invalid.');
    try {
      const storedEntry = await (journalWriteQueue = journalWriteQueue.catch(() => {}).then(async () => {
        const entries = await loadJournalEntries();
        const existing = entries.find((candidate) => candidate && candidate.id === entry.id);
        if (existing) return existing;
        if (entries.length >= MAX_JOURNAL_ENTRIES) {
          const error = new Error('Journal capacity reached');
          error.code = 'JOURNAL_CAPACITY_REACHED';
          throw error;
        }
        entries.push(entry);
        await saveJournalEntries(entries);
        return entry;
      }));
      return res.status(201).json(storedEntry);
    } catch (error) {
      if (error && error.code === 'JOURNAL_CAPACITY_REACHED') {
        return jsonError(res, 409, 'JOURNAL_CAPACITY_REACHED', 'Journal entry limit has been reached.');
      }
      console.error('Journal entry could not be saved');
      return jsonError(res, 500, 'JOURNAL_SAVE_FAILED', 'Journal entry could not be saved.');
    }
  });

  async function getPiSystem() {
    const upstream = await requestWithTimeout(fetchImpl, `${piApiUrl}/status`, {}, timeoutMs);
    if (!upstream.ok) throw new Error('Unsuccessful Pi response');
    const data = await upstream.json();
    if (!data || !data.system || typeof data.system !== 'object') throw new Error('Invalid Pi response');
    return data.system;
  }

  app.get('/api/pi/status', async (req, res) => {
    if (!piApiUrl) return jsonError(res, 503, 'PI_NOT_CONFIGURED', 'Raspberry Pi service is not configured.');
    try {
      return res.json({ status: 'online', checked_at: now().toISOString(), system: await getPiSystem() });
    } catch (error) {
      console.error('Pi status request failed');
      return jsonError(res, 503, 'PI_UNAVAILABLE', 'Raspberry Pi status is unavailable.');
    }
  });

  async function telemetryDeviceStatus() {
    if (!piApiUrl) return { configured: false, online: false, connection: null, system: null };
    try {
      return { configured: true, online: true, connection: 'telemetry', system: await getPiSystem() };
    } catch (error) {
      console.error('Pi aggregate status request failed');
      return { configured: true, online: false, connection: null, system: null };
    }
  }

  async function probedDeviceStatus(tailscaleHost, localHost) {
    if (!tailscaleHost && !localHost) return { configured: false, online: false, connection: null, system: null };
    if (tailscaleHost) {
      try {
        if (await probe(tailscaleHost)) return { configured: true, online: true, connection: 'tailscale', system: null };
      } catch (error) { /* A failed probe falls through to the next configured path. */ }
    }
    if (localHost) {
      try {
        if (await probe(localHost)) return { configured: true, online: true, connection: 'local', system: null };
      } catch (error) { /* The aggregate reports this device offline. */ }
    }
    return { configured: true, online: false, connection: null, system: null };
  }

  app.get('/api/devices/status', async (req, res) => {
    const [pi, desktop, laptop] = await Promise.all([
      telemetryDeviceStatus(),
      probedDeviceStatus(env.DESKTOP_TAILSCALE_HOST, env.DESKTOP_LOCAL_HOST),
      probedDeviceStatus(env.LAPTOP_TAILSCALE_HOST, env.LAPTOP_LOCAL_HOST)
    ]);
    const devices = { pi, desktop, laptop };
    const values = Object.values(devices);
    return res.json({
      checked_at: now().toISOString(),
      devices,
      summary: {
        configured: values.filter((device) => device.configured).length,
        online: values.filter((device) => device.online).length
      }
    });
  });

  function connectPi(req, res) {
    launchConnection((error) => {
      if (error) {
        console.error('Failed to launch Raspberry Pi connection helper');
        return jsonError(res, 500, 'PI_CONNECT_FAILED', 'Failed to launch Raspberry Pi connection helper.');
      }
      return res.json({ status: 'launched', message: 'Raspberry Pi connection helper launched.' });
    });
  }
  app.post('/api/pi/connect', connectPi);
  app.post('/connect/pi', connectPi);

  app.get('/status/pi', async (req, res) => {
    try {
      if (await ping(env.PI_TAILSCALE_IP || '100.87.110.77')) return res.json({ status: 'tailscale' });
      if (await ping(env.PI_LOCAL_IP || '192.168.1.35')) return res.json({ status: 'local' });
      return res.json({ status: 'offline' });
    } catch (error) {
      return jsonError(res, 500, 'PI_STATUS_FAILED', 'Raspberry Pi reachability check failed.');
    }
  });

  function haConfigured(res) {
    if (haUrl && haToken) return true;
    jsonError(res, 503, 'HA_NOT_CONFIGURED', 'Home Assistant is not configured.');
    return false;
  }
  const haHeaders = () => ({ Authorization: `Bearer ${haToken}`, 'Content-Type': 'application/json' });
  async function haRequest(apiPath, options = {}) {
    const response = await requestWithTimeout(fetchImpl, `${haUrl}${apiPath}`, { ...options, headers: { ...haHeaders(), ...(options.headers || {}) } }, timeoutMs);
    if (!response.ok) throw new Error('Unsuccessful Home Assistant response');
    return response;
  }
  async function getEntityState(entityId) {
    return (await haRequest(`/api/states/${encodeURIComponent(entityId)}`)).json();
  }
  function publicEntity(entityId, state) {
    const currentState = state && typeof state.state === 'string' ? state.state : 'unavailable';
    return {
      entity_id: entityId,
      state: currentState,
      friendly_name: (state && state.attributes && state.attributes.friendly_name) || null,
      available: currentState !== 'unavailable' && currentState !== 'unknown',
      last_updated: (state && state.last_updated) || null
    };
  }
  function haFailure(res, error, message) {
    const timedOut = error && error.name === 'AbortError';
    console.error(timedOut ? 'Home Assistant request timed out' : 'Home Assistant request failed');
    return jsonError(res, timedOut ? 504 : 502, timedOut ? 'HA_TIMEOUT' : 'HA_UNAVAILABLE', timedOut ? 'Home Assistant request timed out.' : message);
  }

  app.get('/api/homeassistant/status', async (req, res) => {
    if (!haConfigured(res)) return;
    try {
      await haRequest('/api/');
      const devices = {};
      for (const [device, definition] of Object.entries(haDevices)) {
        try { devices[device] = publicEntity(definition.entityId, await getEntityState(definition.entityId)); }
        catch (error) { devices[device] = publicEntity(definition.entityId, null); }
      }
      return res.json({ reachable: true, last_updated: now().toISOString(), devices });
    } catch (error) {
      return haFailure(res, error, 'Home Assistant is unavailable.');
    }
  });

  for (const [device, definition] of Object.entries(haDevices)) {
    const { entityId, serviceDomain } = definition;
    app.get(`/api/homeassistant/${device}`, async (req, res) => {
      if (!haConfigured(res)) return;
      try { return res.json(publicEntity(entityId, await getEntityState(entityId))); }
      catch (error) { return haFailure(res, error, 'Failed to get Home Assistant device state.'); }
    });
    if (!serviceDomain) continue;
    for (const action of ['on', 'off']) {
      app.post(`/api/homeassistant/${device}/${action}`, async (req, res) => {
        if (!haConfigured(res)) return;
        try {
          await haRequest(`/api/services/${serviceDomain}/turn_${action}`, { method: 'POST', body: JSON.stringify({ entity_id: entityId }) });
          const state = await getEntityState(entityId);
          return res.json({ result: 'ok', entity_id: entityId, power: state.state });
        } catch (error) {
          return haFailure(res, error, 'Failed to change Home Assistant device state.');
        }
      });
    }
  }
  for (const action of ['on', 'off']) {
    app.post(`/api/homeassistant/pi/${action}`, (req, res) => jsonError(res, 405, 'POWER_CONTROL_DISABLED', 'Raspberry Pi power control is disabled.'));
  }
  app.use((error, req, res, next) => {
    if (error && (error.type === 'entity.too.large' || error instanceof SyntaxError)) {
      return jsonError(res, 400, 'INVALID_REQUEST_BODY', 'Request body must be valid JSON within the allowed size.');
    }
    return next(error);
  });
  return app;
}

if (require.main === module) {
  const port = Number.parseInt(process.env.PORT, 10) || 3000;
  createApp().listen(port, () => console.log(`Stargazer gateway listening on http://localhost:${port}`));
}

module.exports = { createApp };
