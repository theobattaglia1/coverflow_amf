import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { FileSessionStore } from '../lib/file-session-store.js';

async function withTempDir(prefix, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  try {
    return await fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function promisifyStoreCall(store, method, ...args) {
  return new Promise((resolve, reject) => {
    store[method](...args, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

test('FileSessionStore set/get/destroy', async () => {
  await withTempDir('coverflow-sessions-', async (dir) => {
    const store = new FileSessionStore({ dir, defaultTtlMs: 1000 });
    const sid = 'sid-123';
    const sess = { cookie: { maxAge: 1000 }, user: { username: 'admin', role: 'admin' } };

    await promisifyStoreCall(store, 'set', sid, sess);
    const roundTrip = await promisifyStoreCall(store, 'get', sid);
    assert.equal(roundTrip?.user?.username, 'admin');

    await promisifyStoreCall(store, 'destroy', sid);
    const afterDestroy = await promisifyStoreCall(store, 'get', sid);
    assert.equal(afterDestroy, null);
  });
});

test('FileSessionStore expires sessions', async () => {
  await withTempDir('coverflow-sessions-', async (dir) => {
    const store = new FileSessionStore({ dir, defaultTtlMs: 50 });
    const sid = 'sid-exp';
    const sess = { cookie: { maxAge: 50 }, user: { username: 'admin' } };

    await promisifyStoreCall(store, 'set', sid, sess);
    await new Promise((r) => setTimeout(r, 80));

    const expired = await promisifyStoreCall(store, 'get', sid);
    assert.equal(expired, null);
  });
});
