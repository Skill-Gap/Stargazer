const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../server');

async function withServer(options, run) {
  const server = createApp(options).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const address = server.address();
  try { await run(`http://127.0.0.1:${address.port}`); }
  finally { await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

async function withTempJournal(run) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'stargazer-journal-'));
  const journalDataFile = path.join(directory, 'nested', 'journal.json');
  try { await run(journalDataFile); }
  finally { await fs.rm(directory, { recursive: true, force: true }); }
}

const journalEntry = {
  id: 'entry-1',
  title: 'First night',
  mood: 'calm',
  tags: ['stars', 'home'],
  content: 'The dashboard is working.',
  createdAt: '2026-08-19T23:00:00.000Z'
};

test('health works and backend files are not served', async () => {
  await withServer({ env: {} }, async (base) => {
    const health = await fetch(`${base}/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: 'ok' });
    assert.equal((await fetch(`${base}/backend/server.js`)).status, 404);
    assert.equal((await fetch(`${base}/.env`)).status, 404);
  });
});

const chatToken = 'test-only-conversation-token-0000';
const chatEnv = { CHAT_MODEL: 'local-test-model', CHAT_TOKEN: chatToken };
const chatMessages = [
  { role: 'user', content: 'My name is Sam.' },
  { role: 'assistant', content: 'Hi, Sam.' },
  { role: 'user', content: 'What is my name?' }
];

function postConversation(base, messages = chatMessages, token = chatToken) {
  return fetch(`${base}/api/conversation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ messages })
  });
}

test('conversation forwards ordered text history to the local model and returns a normalized reply', async () => {
  const message = { role: 'assistant', content: 'Sam.' };
  const fetchImpl = async (url, options) => {
    assert.equal(url, 'http://127.0.0.1:11434/api/chat');
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, undefined);
    assert.deepEqual(JSON.parse(options.body), {
      model: chatEnv.CHAT_MODEL, messages: chatMessages, stream: false, options: { num_predict: 512 }
    });
    return jsonResponse({ done: true, message: { ...message, thinking: 'provider metadata' } });
  };
  await withServer({ env: chatEnv, fetchImpl }, async (base) => {
    const response = await postConversation(base);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { message });
  });
});

test('conversation refuses unconfigured, unauthorized, and invalid requests without contacting the model', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; };
  await withServer({ env: {}, fetchImpl }, async (base) => {
    assert.equal((await postConversation(base)).status, 503);
  });
  await withServer({ env: chatEnv, fetchImpl }, async (base) => {
    assert.equal((await postConversation(base, chatMessages, 'wrong-token')).status, 401);
    for (const messages of [[], [null], [{ role: 'system', content: 'hello' }], chatMessages.slice(0, 2)]) {
      assert.equal((await postConversation(base, messages)).status, 400);
    }
  });
  assert.equal(calls, 0);
});

test('conversation sanitizes provider failures and recovers on the next request', async () => {
  let attempts = 0;
  const fetchImpl = async () => {
    attempts += 1;
    if (attempts === 1) return jsonResponse({ error: 'private provider detail' }, 503);
    if (attempts === 2) return jsonResponse({ done: true });
    return jsonResponse({ done: true, message: { role: 'assistant', content: 'Sam.' } });
  };
  await withServer({ env: chatEnv, fetchImpl }, async (base) => {
    for (let index = 0; index < 2; index += 1) {
      const response = await postConversation(base);
      assert.equal(response.status, 502);
      assert.deepEqual(await response.json(), {
        error: { code: 'CHAT_PROVIDER_FAILED', message: 'The local model could not produce a reply.' }
      });
    }
    assert.equal((await postConversation(base)).status, 200);
  });
});

test('conversation timeout covers reading the provider response body', async () => {
  const fetchImpl = async (url, { signal }) => new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('{'));
      signal.addEventListener('abort', () => controller.error(signal.reason), { once: true });
    }
  }));
  await withServer({ env: { ...chatEnv, CHAT_TIMEOUT_MS: '25' }, fetchImpl }, async (base) => {
    const response = await postConversation(base);
    assert.equal(response.status, 504);
    assert.equal((await response.json()).error.code, 'CHAT_TIMEOUT');
  });
});

test('journal starts empty and persists entries across server restarts', async () => {
  await withTempJournal(async (journalDataFile) => {
    const env = { JOURNAL_DATA_FILE: journalDataFile };
    await withServer({ env }, async (base) => {
      assert.deepEqual(await (await fetch(`${base}/api/journal/entries`)).json(), { entries: [] });
      const saved = await fetch(`${base}/api/journal/entries`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(journalEntry)
      });
      assert.equal(saved.status, 201);
      assert.deepEqual(await saved.json(), journalEntry);
    });
    await withServer({ env }, async (base) => {
      assert.deepEqual(await (await fetch(`${base}/api/journal/entries`)).json(), { entries: [journalEntry] });
    });
    assert.deepEqual(JSON.parse(await fs.readFile(journalDataFile, 'utf8')), { entries: [journalEntry] });
  });
});

test('journal retries are idempotent and preserve the originally stored entry', async () => {
  await withTempJournal(async (journalDataFile) => {
    await withServer({ env: { JOURNAL_DATA_FILE: journalDataFile } }, async (base) => {
      for (const entry of [journalEntry, { ...journalEntry, title: 'Changed retry' }]) {
        const response = await fetch(`${base}/api/journal/entries`, {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(entry)
        });
        assert.equal(response.status, 201);
        assert.deepEqual(await response.json(), journalEntry);
      }
      assert.deepEqual(await (await fetch(`${base}/api/journal/entries`)).json(), { entries: [journalEntry] });
    });
  });
});

test('journal rejects malformed and oversized entries without creating data', async () => {
  await withTempJournal(async (journalDataFile) => {
    await withServer({ env: { JOURNAL_DATA_FILE: journalDataFile } }, async (base) => {
      for (const entry of [{ ...journalEntry, id: '' }, { ...journalEntry, content: 'x'.repeat(12001) }, { ...journalEntry, tags: ['x'.repeat(51)] }]) {
        const response = await fetch(`${base}/api/journal/entries`, {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(entry)
        });
        assert.equal(response.status, 400);
        assert.deepEqual(await response.json(), { error: { code: 'INVALID_JOURNAL_ENTRY', message: 'Journal entry is invalid.' } });
      }
      assert.deepEqual(await (await fetch(`${base}/api/journal/entries`)).json(), { entries: [] });
    });
  });
});

test('journal load and save errors are sanitized', async () => {
  await withTempJournal(async (journalDataFile) => {
    await fs.mkdir(path.dirname(journalDataFile), { recursive: true });
    await fs.writeFile(journalDataFile, '{private broken json');
    await withServer({ env: { JOURNAL_DATA_FILE: journalDataFile } }, async (base) => {
      const load = await fetch(`${base}/api/journal/entries`);
      assert.equal(load.status, 500);
      assert.deepEqual(await load.json(), { error: { code: 'JOURNAL_LOAD_FAILED', message: 'Journal entries could not be loaded.' } });
      const save = await fetch(`${base}/api/journal/entries`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(journalEntry)
      });
      assert.equal(save.status, 500);
      const body = await save.json();
      assert.deepEqual(body, { error: { code: 'JOURNAL_SAVE_FAILED', message: 'Journal entry could not be saved.' } });
      assert.doesNotMatch(JSON.stringify(body), /private|broken|journalDataFile/);
    });
  });
});

test('Pi status reports missing configuration', async () => {
  await withServer({ env: {} }, async (base) => {
    const response = await fetch(`${base}/api/pi/status`);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: { code: 'PI_NOT_CONFIGURED', message: 'Raspberry Pi service is not configured.' } });
  });
});

test('Pi status proxies and normalizes telemetry', async () => {
  let requestedUrl;
  const system = { hostname: 'pi', cpu_percent: 10, memory_percent: 20, disk_percent: 30, uptime_seconds: 40 };
  await withServer({
    env: { PI_API_URL: 'http://pi-agent:8000/' },
    now: () => new Date('2026-08-19T12:00:00.000Z'),
    fetchImpl: async (url) => { requestedUrl = url; return jsonResponse({ status: 'success', system }); }
  }, async (base) => {
    const response = await fetch(`${base}/api/pi/status`);
    assert.equal(response.status, 200);
    assert.equal(requestedUrl, 'http://pi-agent:8000/status');
    assert.deepEqual(await response.json(), { status: 'online', checked_at: '2026-08-19T12:00:00.000Z', system });
  });
});

test('Pi status normalizes upstream failure and timeout', async () => {
  for (const fetchImpl of [
    async () => jsonResponse({}, 500),
    async (url, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(Object.assign(new Error('secret host'), { name: 'AbortError' }))))
  ]) {
    await withServer({ env: { PI_API_URL: 'http://private-pi:8000', UPSTREAM_TIMEOUT_MS: '5' }, fetchImpl }, async (base) => {
      const response = await fetch(`${base}/api/pi/status`);
      assert.equal(response.status, 503);
      const body = await response.json();
      assert.equal(body.error.code, 'PI_UNAVAILABLE');
      assert.doesNotMatch(JSON.stringify(body), /private-pi|secret host/);
    });
  }
});

test('new and compatibility Pi connect routes use the injected launcher', async () => {
  let launches = 0;
  await withServer({ env: {}, launchConnection: (callback) => { launches += 1; callback(null); } }, async (base) => {
    for (const route of ['/api/pi/connect', '/connect/pi']) {
      const response = await fetch(`${base}${route}`, { method: 'POST' });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { status: 'launched', message: 'Raspberry Pi connection helper launched.' });
    }
    assert.equal(launches, 2);
  });
});

test('Pi connect returns a standard sanitized launcher error', async () => {
  await withServer({ env: {}, launchConnection: (callback) => callback(new Error('C:\\private\\secret')) }, async (base) => {
    const response = await fetch(`${base}/api/pi/connect`, { method: 'POST' });
    assert.equal(response.status, 500);
    const body = await response.json();
    assert.equal(body.error.code, 'PI_CONNECT_FAILED');
    assert.doesNotMatch(JSON.stringify(body), /private|secret/);
  });
});

test('Home Assistant requires both URL and token', async () => {
  await withServer({ env: { HA_URL: 'http://ha' } }, async (base) => {
    const response = await fetch(`${base}/api/homeassistant/status`);
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, 'HA_NOT_CONFIGURED');
  });
});

test('Home Assistant status returns exactly the four configured dashboard devices', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, method: options.method || 'GET', authorization: options.headers.Authorization, body: options.body });
    if (url.endsWith('/api/')) return jsonResponse({ message: 'API running.' });
    if (url.includes('pi_socket_1')) return jsonResponse({}, 404);
    return jsonResponse({ state: 'on', attributes: { friendly_name: 'Dashboard device' }, last_updated: 'today' });
  };
  const env = { HA_URL: 'http://ha.local', HA_TOKEN: 'top-secret' };
  await withServer({ env, fetchImpl }, async (base) => {
    const response = await fetch(`${base}/api/homeassistant/status`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(Object.keys(body.devices), ['lamp', 'desktop', 'pi', 'tv']);
    assert.deepEqual(Object.fromEntries(Object.entries(body.devices).map(([key, value]) => [key, value.entity_id])), {
      lamp: 'switch.ihome_ww117_smart_plug_socket_1',
      desktop: 'switch.desktop_socket_1',
      pi: 'switch.pi_socket_1',
      tv: 'media_player.tv_un75nu6900'
    });
    assert.equal(body.devices.pi.available, false);
    assert.equal(body.devices.pi.state, 'unavailable');
    assert.equal(body.devices.pi.friendly_name, null);
    assert.equal(body.devices.pi.last_updated, null);
  });
  assert.ok(calls.every((call) => call.authorization === 'Bearer top-secret'));
});

test('Home Assistant per-device reads and controls use only frozen entity and service mappings', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, method: options.method || 'GET', body: options.body });
    if (url.includes('/api/services/')) return jsonResponse([]);
    return jsonResponse({ state: 'on', attributes: { friendly_name: 'Device' }, last_updated: 'today' });
  };
  await withServer({ env: { HA_URL: 'http://ha.local', HA_TOKEN: 'secret' }, fetchImpl }, async (base) => {
    for (const device of ['lamp', 'desktop', 'pi', 'tv']) {
      const response = await fetch(`${base}/api/homeassistant/${device}`);
      assert.equal(response.status, 200);
      assert.equal((await response.json()).available, true);
    }
    for (const [device, action] of [['lamp', 'on'], ['desktop', 'off'], ['tv', 'on']]) {
      const response = await fetch(`${base}/api/homeassistant/${device}/${action}`, { method: 'POST' });
      assert.equal(response.status, 200);
    }
  });
  const posts = calls.filter((call) => call.method === 'POST');
  assert.deepEqual(posts.map((call) => [call.url, JSON.parse(call.body).entity_id]), [
    ['http://ha.local/api/services/switch/turn_on', 'switch.ihome_ww117_smart_plug_socket_1'],
    ['http://ha.local/api/services/switch/turn_off', 'switch.desktop_socket_1'],
    ['http://ha.local/api/services/media_player/turn_on', 'media_player.tv_un75nu6900']
  ]);
});

test('Raspberry Pi power routes are disabled without contacting Home Assistant', async () => {
  let calls = 0;
  await withServer({
    env: { HA_URL: 'http://ha.local', HA_TOKEN: 'secret' },
    fetchImpl: async () => { calls += 1; return jsonResponse({}); }
  }, async (base) => {
    for (const action of ['on', 'off']) {
      const response = await fetch(`${base}/api/homeassistant/pi/${action}`, { method: 'POST' });
      assert.equal(response.status, 405);
      assert.deepEqual(await response.json(), { error: { code: 'POWER_CONTROL_DISABLED', message: 'Raspberry Pi power control is disabled.' } });
    }
  });
  assert.equal(calls, 0);
});

test('Home Assistant failures do not leak upstream details', async () => {
  await withServer({
    env: { HA_URL: 'http://private-ha', HA_TOKEN: 'top-secret' },
    fetchImpl: async () => { throw new Error('top-secret at private-ha'); }
  }, async (base) => {
    const response = await fetch(`${base}/api/homeassistant/pi`);
    assert.equal(response.status, 502);
    const text = await response.text();
    assert.doesNotMatch(text, /top-secret|private-ha/);
    assert.equal(JSON.parse(text).error.code, 'HA_UNAVAILABLE');
  });
});

test('Home Assistant timeout returns a standard 504 error', async () => {
  const fetchImpl = async (url, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(Object.assign(new Error('timed out at private-ha'), { name: 'AbortError' })));
  });
  await withServer({
    env: { HA_URL: 'http://private-ha', HA_TOKEN: 'top-secret', UPSTREAM_TIMEOUT_MS: '5' },
    fetchImpl
  }, async (base) => {
    const response = await fetch(`${base}/api/homeassistant/pi`);
    assert.equal(response.status, 504);
    assert.deepEqual(await response.json(), { error: { code: 'HA_TIMEOUT', message: 'Home Assistant request timed out.' } });
  });
});

test('device aggregate reports Pi telemetry and online Tailscale devices', async () => {
  const probes = [];
  const system = { hostname: 'pi', cpu_percent: 1, memory_percent: 2, disk_percent: 3, uptime_seconds: 4 };
  await withServer({
    env: {
      PI_API_URL: 'http://pi-agent:8000',
      DESKTOP_TAILSCALE_HOST: 'desktop-ts', DESKTOP_LOCAL_HOST: 'desktop-lan',
      LAPTOP_TAILSCALE_HOST: 'laptop-ts', LAPTOP_LOCAL_HOST: 'laptop-lan'
    },
    now: () => new Date('2026-08-19T12:00:00.000Z'),
    fetchImpl: async () => jsonResponse({ system }),
    probe: async (host) => { probes.push(host); return true; }
  }, async (base) => {
    const response = await fetch(`${base}/api/devices/status`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.checked_at, '2026-08-19T12:00:00.000Z');
    assert.deepEqual(body.devices.pi, { configured: true, online: true, connection: 'telemetry', system });
    assert.equal(body.devices.desktop.connection, 'tailscale');
    assert.equal(body.devices.laptop.connection, 'tailscale');
    assert.deepEqual(body.summary, { configured: 3, online: 3 });
  });
  assert.deepEqual(probes.sort(), ['desktop-ts', 'laptop-ts']);
});

test('device aggregate falls back from Tailscale to local', async () => {
  const probes = [];
  await withServer({
    env: { DESKTOP_TAILSCALE_HOST: 'desktop-ts', DESKTOP_LOCAL_HOST: 'desktop-lan' },
    probe: async (host) => { probes.push(host); return host === 'desktop-lan'; }
  }, async (base) => {
    const body = await (await fetch(`${base}/api/devices/status`)).json();
    assert.deepEqual(body.devices.desktop, { configured: true, online: true, connection: 'local', system: null });
    assert.deepEqual(body.summary, { configured: 1, online: 1 });
  });
  assert.deepEqual(probes, ['desktop-ts', 'desktop-lan']);
});

test('device aggregate reports configured unreachable devices offline', async () => {
  await withServer({
    env: { LAPTOP_TAILSCALE_HOST: 'laptop-ts', LAPTOP_LOCAL_HOST: 'laptop-lan' },
    probe: async () => false
  }, async (base) => {
    const body = await (await fetch(`${base}/api/devices/status`)).json();
    assert.deepEqual(body.devices.laptop, { configured: true, online: false, connection: null, system: null });
    assert.deepEqual(body.summary, { configured: 1, online: 0 });
  });
});

test('device aggregate honestly reports partial configuration', async () => {
  const probes = [];
  await withServer({
    env: { DESKTOP_LOCAL_HOST: 'desktop-lan' },
    probe: async (host) => { probes.push(host); return true; }
  }, async (base) => {
    const body = await (await fetch(`${base}/api/devices/status`)).json();
    assert.deepEqual(body.devices.pi, { configured: false, online: false, connection: null, system: null });
    assert.deepEqual(body.devices.desktop, { configured: true, online: true, connection: 'local', system: null });
    assert.deepEqual(body.devices.laptop, { configured: false, online: false, connection: null, system: null });
  });
  assert.deepEqual(probes, ['desktop-lan']);
});

test('Pi telemetry failure does not fail the device aggregate', async () => {
  await withServer({
    env: { PI_API_URL: 'http://pi-agent:8000', DESKTOP_TAILSCALE_HOST: 'desktop-ts' },
    fetchImpl: async () => { throw new Error('private upstream failure'); },
    probe: async () => true
  }, async (base) => {
    const response = await fetch(`${base}/api/devices/status`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.devices.pi, { configured: true, online: false, connection: null, system: null });
    assert.equal(body.devices.desktop.online, true);
    assert.deepEqual(body.summary, { configured: 2, online: 1 });
    assert.doesNotMatch(JSON.stringify(body), /private upstream failure|pi-agent/);
  });
});
