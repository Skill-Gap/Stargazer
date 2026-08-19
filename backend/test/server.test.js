const test = require('node:test');
const assert = require('node:assert/strict');
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

test('health works and backend files are not served', async () => {
  await withServer({ env: {} }, async (base) => {
    const health = await fetch(`${base}/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: 'ok' });
    assert.equal((await fetch(`${base}/backend/server.js`)).status, 404);
    assert.equal((await fetch(`${base}/.env`)).status, 404);
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

test('Home Assistant device state and controls preserve contracts', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, method: options.method || 'GET', authorization: options.headers.Authorization, body: options.body });
    if (url.includes('/api/services/')) return jsonResponse([]);
    return jsonResponse({ state: 'on', attributes: { friendly_name: 'Pi plug' }, last_updated: 'today' });
  };
  const env = { HA_URL: 'http://ha.local', HA_TOKEN: 'top-secret' };
  await withServer({ env, fetchImpl }, async (base) => {
    const getResponse = await fetch(`${base}/api/homeassistant/pi`);
    assert.equal(getResponse.status, 200);
    assert.equal((await getResponse.json()).state, 'on');

    const postResponse = await fetch(`${base}/api/homeassistant/pi/on`, { method: 'POST' });
    assert.equal(postResponse.status, 200);
    assert.equal((await postResponse.json()).power, 'on');
  });
  assert.equal(calls[1].method, 'POST');
  assert.equal(calls[1].body, JSON.stringify({ entity_id: 'switch.pi_socket_1' }));
  assert.ok(calls.every((call) => call.authorization === 'Bearer top-secret'));
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
