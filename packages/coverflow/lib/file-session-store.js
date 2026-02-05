import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import session from 'express-session';

const fsp = fs.promises;

function sidToFilename(sid) {
  return crypto.createHash('sha256').update(String(sid)).digest('hex');
}

async function safeUnlink(filePath) {
  try {
    await fsp.unlink(filePath);
  } catch (err) {
    if (err?.code !== 'ENOENT') throw err;
  }
}

async function atomicWriteJson(filePath, data) {
  const dir = path.dirname(filePath);
  await fsp.mkdir(dir, { recursive: true });
  const tmpPath = `${filePath}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  await fsp.writeFile(tmpPath, JSON.stringify(data), { encoding: 'utf8', mode: 0o600 });
  await fsp.rename(tmpPath, filePath);
}

function getExpiresAtMs(sess, defaultTtlMs) {
  const now = Date.now();
  const cookieExpires = sess?.cookie?.expires;
  if (cookieExpires) {
    const ms = new Date(cookieExpires).getTime();
    if (Number.isFinite(ms)) return ms;
  }
  const cookieMaxAge = sess?.cookie?.maxAge;
  if (typeof cookieMaxAge === 'number' && Number.isFinite(cookieMaxAge)) {
    return now + cookieMaxAge;
  }
  return now + defaultTtlMs;
}

export class FileSessionStore extends session.Store {
  constructor({ dir, defaultTtlMs = 24 * 60 * 60 * 1000 } = {}) {
    super();
    if (!dir) throw new Error('FileSessionStore requires { dir }');
    this.dir = dir;
    this.defaultTtlMs = defaultTtlMs;
  }

  #filePathForSid(sid) {
    return path.join(this.dir, `${sidToFilename(sid)}.json`);
  }

  get(sid, callback) {
    const filePath = this.#filePathForSid(sid);
    fsp
      .readFile(filePath, 'utf8')
      .then(async (raw) => {
        let record;
        try {
          record = JSON.parse(raw);
        } catch {
          await safeUnlink(filePath);
          return callback(null, null);
        }

        const expiresAtMs = record?.expiresAtMs;
        if (typeof expiresAtMs === 'number' && Date.now() >= expiresAtMs) {
          await safeUnlink(filePath);
          return callback(null, null);
        }
        return callback(null, record?.session || null);
      })
      .catch((err) => {
        if (err?.code === 'ENOENT') return callback(null, null);
        return callback(err);
      });
  }

  set(sid, sess, callback) {
    const filePath = this.#filePathForSid(sid);
    const record = {
      expiresAtMs: getExpiresAtMs(sess, this.defaultTtlMs),
      session: sess
    };

    atomicWriteJson(filePath, record)
      .then(() => callback?.(null))
      .catch((err) => callback?.(err));
  }

  destroy(sid, callback) {
    const filePath = this.#filePathForSid(sid);
    safeUnlink(filePath)
      .then(() => callback?.(null))
      .catch((err) => callback?.(err));
  }

  touch(sid, sess, callback) {
    // Update expiry on activity (when resave=false)
    return this.set(sid, sess, callback);
  }
}

