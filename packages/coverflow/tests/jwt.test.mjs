import assert from 'node:assert/strict';
import test from 'node:test';

import { signJwt, verifyJwt } from '../lib/jwt.js';

test('jwt sign/verify round-trip', () => {
  const secret = 'test-secret';
  const token = signJwt({ username: 'admin', role: 'admin' }, secret, '24h');
  const decoded = verifyJwt(token, secret);

  assert.equal(decoded.username, 'admin');
  assert.equal(decoded.role, 'admin');
  assert.equal(typeof decoded.iat, 'number');
  assert.equal(typeof decoded.exp, 'number');
  assert.ok(decoded.exp > decoded.iat);
});

test('jwt rejects invalid signature', () => {
  const secret = 'test-secret';
  const token = signJwt({ username: 'admin', role: 'admin' }, secret, '24h');
  const parts = token.split('.');
  assert.equal(parts.length, 3);

  // Flip one character in the signature section.
  const tamperedSig = parts[2].slice(0, -1) + (parts[2].slice(-1) === 'a' ? 'b' : 'a');
  const tampered = `${parts[0]}.${parts[1]}.${tamperedSig}`;

  assert.throws(() => verifyJwt(tampered, secret), /signature/i);
});

test('jwt expires', async () => {
  const secret = 'test-secret';
  const token = signJwt({ username: 'admin', role: 'admin' }, secret, '1s');
  await new Promise(r => setTimeout(r, 1100));
  assert.throws(() => verifyJwt(token, secret), /expired/i);
});

