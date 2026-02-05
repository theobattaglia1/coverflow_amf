import { spawn } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForHealthy(baseUrl, timeoutMs = 15000) {
  const start = Date.now();
  // Node 18+ has global fetch; keep it dependency-free.
  // If this project is run on older Node, switch to node-fetch.
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      if (res.ok) return true;
    } catch {}
    await sleep(250);
  }
  return false;
}

async function assertJson(res, message) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`${message}: expected JSON, got: ${text.slice(0, 200)}`);
  }
}

async function main() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const projectDir = path.resolve(__dirname, '..');

  const port = String(19000 + Math.floor(Math.random() * 1000));
  const baseUrl = `http://localhost:${port}`;

  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'coverflow-smoke-'));
  const adminPassword = 'smoke-test-password';

  const logs = [];
  const logMax = 200;
  let serverExited = null;

  const server = spawn(process.execPath, ['server.js'], {
    cwd: projectDir,
    env: {
      ...process.env,
      PORT: port,
      NODE_ENV: 'development',
      BYPASS_AUTH: 'true',
      ADMIN_PASSWORD: adminPassword,
      DATA_DIR_PATH: dataDir,
      // Exercise DATA_DIR override even when provider is set.
      DATA_SYNC_PROVIDER: 'gcs',
      DATA_SYNC_ON_START: 'false',
      DATA_SYNC_ON_SAVE: 'false',
      ENABLE_GIT_SYNC: 'false'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  try {
    server.on('exit', (code, signal) => {
      serverExited = { code, signal };
    });
    server.on('error', err => {
      serverExited = { error: err };
    });

    const pipeWithCapture = (stream, label) => {
      if (!stream) return;
      stream.on('data', chunk => {
        const text = chunk.toString('utf-8');
        text.split('\n').forEach(line => {
          if (!line) return;
          logs.push(`[${label}] ${line}`);
          if (logs.length > logMax) logs.shift();
        });
        process.stdout.write(text);
      });
    };
    pipeWithCapture(server.stdout, 'server');
    pipeWithCapture(server.stderr, 'server');

    const ready = await waitForHealthy(baseUrl, 120000);
    if (!ready) {
      if (serverExited?.error) throw serverExited.error;
      if (serverExited) throw new Error(`Server exited before becoming healthy (code=${serverExited.code}, signal=${serverExited.signal})`);
      const tail = logs.length ? `\n--- server logs (tail) ---\n${logs.join('\n')}` : '';
      throw new Error(`Server did not become healthy in time.${tail}`);
    }

    // 1) /data endpoints should resolve from DATA_DIR_PATH, not repo data dir
    const coversRes = await fetch(`${baseUrl}/data/covers.json`);
    if (!coversRes.ok) throw new Error(`GET /data/covers.json failed: ${coversRes.status}`);
    const covers = await assertJson(coversRes, 'GET /data/covers.json');
    if (!Array.isArray(covers)) throw new Error('covers.json should be an array');

    const assetsRes = await fetch(`${baseUrl}/data/assets.json`);
    if (!assetsRes.ok) throw new Error(`GET /data/assets.json failed: ${assetsRes.status}`);
    const assets = await assertJson(assetsRes, 'GET /data/assets.json');
    if (!assets || typeof assets !== 'object') throw new Error('assets.json should be an object');

    // 2) Login should work and return a JWT; JWT should authorize /api/me
    const loginRes = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: adminPassword })
    });
    if (!loginRes.ok) throw new Error(`POST /api/login failed: ${loginRes.status}`);
    const login = await assertJson(loginRes, 'POST /api/login');
    if (!login?.token) throw new Error('Login response missing token');

    const meRes = await fetch(`${baseUrl}/api/me`, {
      headers: { Authorization: `Bearer ${login.token}` }
    });
    if (!meRes.ok) throw new Error(`GET /api/me failed: ${meRes.status}`);
    const me = await assertJson(meRes, 'GET /api/me');
    if (me?.user?.username !== 'admin') throw new Error('Expected /api/me user.username to be admin');

    // 3) Saving should write into DATA_DIR_PATH
    const marker = `smoke-${Date.now()}`;
    const saveAssetsRes = await fetch(`${baseUrl}/save-assets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${login.token}`
      },
      body: JSON.stringify({ ...assets, smokeMarker: marker })
    });
    if (!saveAssetsRes.ok) throw new Error(`POST /save-assets failed: ${saveAssetsRes.status}`);
    await assertJson(saveAssetsRes, 'POST /save-assets');

    const savedAssetsText = await fs.readFile(path.join(dataDir, 'assets.json'), 'utf-8');
    const savedAssets = JSON.parse(savedAssetsText);
    if (savedAssets.smokeMarker !== marker) {
      throw new Error('Expected assets.json to be written to DATA_DIR_PATH');
    }

    // 4) Push live should validate and succeed (git sync disabled)
    const pushRes = await fetch(`${baseUrl}/push-live`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${login.token}`
      },
      body: JSON.stringify({})
    });
    if (!pushRes.ok) throw new Error(`POST /push-live failed: ${pushRes.status}`);
    const push = await assertJson(pushRes, 'POST /push-live');
    if (!push?.success) throw new Error('Expected /push-live to return success=true');

    console.log('Smoke test passed');
  } finally {
    server.kill('SIGTERM');
    await sleep(250);
    try {
      await fs.rm(dataDir, { recursive: true, force: true });
    } catch {}
  }
}

main().catch(err => {
  console.error('Smoke test failed:', err);
  process.exitCode = 1;
});
