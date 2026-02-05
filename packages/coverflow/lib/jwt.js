import crypto from 'crypto';

function base64UrlEncode(input) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(String(input));
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecodeToBuffer(input) {
  const str = String(input).replace(/-/g, '+').replace(/_/g, '/');
  const padding = str.length % 4 ? '='.repeat(4 - (str.length % 4)) : '';
  return Buffer.from(str + padding, 'base64');
}

function parseExpirySeconds(expiresIn) {
  // Supports a small subset of jsonwebtoken-style durations: "30s", "15m", "24h", "7d"
  if (typeof expiresIn === 'number' && Number.isFinite(expiresIn)) return Math.floor(expiresIn);
  const raw = String(expiresIn || '').trim();
  if (/^\d+$/.test(raw)) return Number(raw);
  const match = raw.match(/^(\d+)([smhd])$/i);
  if (!match) return null;
  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = { s: 1, m: 60, h: 3600, d: 86400 };
  return value * (multipliers[unit] || 0);
}

export function signJwt(payload, secret, expiresIn) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const ttlSeconds = parseExpirySeconds(expiresIn);
  const body = {
    ...payload,
    iat: now,
    ...(ttlSeconds ? { exp: now + ttlSeconds } : {})
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(body));
  const data = `${encodedHeader}.${encodedPayload}`;

  const signature = base64UrlEncode(crypto.createHmac('sha256', secret).update(data).digest());
  return `${data}.${signature}`;
}

export function verifyJwt(token, secret) {
  const parts = String(token).split('.');
  if (parts.length !== 3) throw new Error('Invalid token format');
  const [encodedHeader, encodedPayload, encodedSig] = parts;
  const data = `${encodedHeader}.${encodedPayload}`;

  const expectedSig = base64UrlEncode(crypto.createHmac('sha256', secret).update(data).digest());
  const expectedBuf = Buffer.from(expectedSig);
  const actualBuf = Buffer.from(encodedSig);
  if (expectedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(expectedBuf, actualBuf)) {
    throw new Error('Invalid token signature');
  }

  const header = JSON.parse(base64UrlDecodeToBuffer(encodedHeader).toString('utf-8'));
  if (header?.alg !== 'HS256') throw new Error('Unsupported token algorithm');

  const payload = JSON.parse(base64UrlDecodeToBuffer(encodedPayload).toString('utf-8'));
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload?.exp === 'number' && now >= payload.exp) {
    throw new Error('Token expired');
  }
  return payload;
}
