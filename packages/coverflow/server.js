// --- Corrected and Consolidated server.js ---
// File Path: packages/coverflow/server.js
// Last Updated: 2025-07-15

import basicAuth from 'express-basic-auth';
import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import bcrypt from 'bcrypt';
import session from 'express-session';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { Storage } from '@google-cloud/storage';
import sharp from 'sharp';

// --- Diagnostic Log ---
// This line confirms that the correct file is being executed on Render.
console.log("--- Executing /packages/coverflow/server.js @ " + new Date().toISOString() + " ---");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_DIR = path.join(__dirname, 'public');
const ADMIN_DIR = path.join(__dirname, 'admin');
const DATA_DIR = path.join(__dirname, 'data');

const app = express();
const PORT = process.env.PORT || 10000; // Use Render's default port

// --- Best Practice: Initialize GCS Client and Bucket Name Once ---
// This single instance is reused for all GCS operations, which is more efficient.
const gcsStorage = new Storage({
  keyFilename: '/etc/secrets/service-account.json' // Correct path for Render Secret Files
});
const gcsBucketName = process.env.GCS_BUCKET_NAME || 'allmyfriends-assets-2025';


// --- Middleware Setup ---

// Trust proxy in production for secure cookies
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (process.env.NODE_ENV === 'production') {
      if (origin.endsWith('.allmyfriendsinc.com') || origin === 'https://allmyfriendsinc.com') {
        return callback(null, true);
      }
    } else {
      return callback(null, true); // Allow all in development
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

// Session configuration
const sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax',
    domain: process.env.NODE_ENV === 'production' ? '.allmyfriendsinc.com' : undefined
  }
}));

// --- Helper Functions ---

function isAuthenticated(req) {
  return req.session && req.session.user;
}

function isAdminSubdomain(req) {
  return req.hostname.startsWith('admin.');
}

const requireAuth = (requiredRole = 'viewer') => {
  return (req, res, next) => {
    if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
      req.session.user = req.session.user || { username: 'dev', role: 'admin' };
      return next();
    }
    if (!isAuthenticated(req)) {
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      return res.redirect('/admin/login.html');
    }
    const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    const userRole = req.session.user.role;
    if (userRole === 'admin' || allowedRoles.includes(userRole) || (userRole === 'editor' && allowedRoles.includes('viewer'))) {
      return next();
    }
    return res.status(403).json({ error: 'Insufficient permissions' });
  };
};

class DataCache {
  constructor(ttl = 60000) { this.cache = new Map(); this.ttl = ttl; }
  get(key) { const item = this.cache.get(key); if (!item || Date.now() > item.expiry) { this.cache.delete(key); return null; } return item.data; }
  set(key, data) { this.cache.set(key, { data, expiry: Date.now() + this.ttl }); }
  invalidate(key) { this.cache.delete(key); }
}

const dataCache = new DataCache();
const userCache = new DataCache(300000);

async function readJsonFile(filePath, cacheKey, cache = dataCache) {
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  try {
    const data = await fs.promises.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(data);
    cache.set(cacheKey, parsed);
    return parsed;
  } catch (error) {
    if (error.code === 'ENOENT') return null; // Return null if file doesn't exist
    console.error(`Error reading ${filePath}:`, error);
    throw error;
  }
}

async function loadUsers() {
    const usersPath = path.join(DATA_DIR, 'users.json');
    let users = await readJsonFile(usersPath, 'users', userCache);
    if (!users) {
        const adminPassword = process.env.ADMIN_PASSWORD || 'password';
        const hash = await bcrypt.hash(adminPassword, 10);
        users = [{ username: 'admin', hash, role: 'admin' }];
        await fs.promises.writeFile(usersPath, JSON.stringify(users, null, 2));
        userCache.set('users', users);
    }
    return users;
}

async function saveUsers(users) {
  const usersPath = path.join(DATA_DIR, 'users.json');
  await fs.promises.writeFile(usersPath, JSON.stringify(users, null, 2));
  userCache.invalidate('users');
}

// --- Routing ---

// Admin subdomain handler
app.use((req, res, next) => {
  if (isAdminSubdomain(req)) {
    console.log(`Admin subdomain request: ${req.method} ${req.path}`);
    if (['/api/', '/data/', '/upload'].some(p => req.path.startsWith(p)) || ['/save-cover', '/delete-cover', '/save-covers', '/save-assets', '/push-live'].includes(req.path)) {
      return next();
    }
    if (req.path === '/' || req.path === '') {
      return res.sendFile(path.join(ADMIN_DIR, isAuthenticated(req) ? 'index-swiss.html' : 'login.html'));
    }
    if (req.path.startsWith('/admin')) {
      req.url = req.url.replace('/admin', '');
    }
    return express.static(ADMIN_DIR)(req, res, next);
  }
  next();
});

// Basic auth for specific public files
app.get('/hudson-deck.html', basicAuth({ users: { 'guest': 'MakeItTogether25!' }, challenge: true }), (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'hudson-deck.html'));
});

// Static files for PUBLIC site
app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));

// Static files for /data directory (JSON files)
app.use('/data', express.static(DATA_DIR));

// Multer setup for file uploads
const assetUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true });

// --- API Endpoints ---

// Authentication
app.post('/api/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    const users = await loadUsers();
    const user = users.find(u => u.username === username);
    if (!user || !(await bcrypt.compare(password, user.hash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    req.session.user = { username: user.username, role: user.role };
    res.json({ success: true, role: user.role });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.json({ success: true });
  });
});

app.get('/api/me', (req, res) => {
  if (req.session.user) {
    res.json({ user: req.session.user });
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

// User Management
app.get('/api/users', requireAuth('admin'), async (req, res) => {
    try {
        const users = await loadUsers();
        res.json(users.map(u => ({ username: u.username, role: u.role })));
    } catch (err) {
        res.status(500).json({ error: 'Failed to load users' });
    }
});

app.post('/api/users', requireAuth('admin'), async (req, res) => {
    try {
        const { username, password, role } = req.body;
        if (!username || !password || !role || !['admin', 'editor', 'viewer'].includes(role)) {
            return res.status(400).json({ error: 'Invalid input' });
        }
        const users = await loadUsers();
        if (users.find(u => u.username === username)) {
            return res.status(400).json({ error: 'User already exists' });
        }
        users.push({ username, hash: await bcrypt.hash(password, 10), role });
        await saveUsers(users);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to create user' });
    }
});

app.delete('/api/users/:username', requireAuth('admin'), async (req, res) => {
    try {
        let users = await loadUsers();
        const initialLength = users.length;
        users = users.filter(u => u.username !== req.params.username);
        if (users.length === initialLength) {
            return res.status(404).json({ error: 'User not found' });
        }
        await saveUsers(users);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// Folder Management
app.post('/api/folder', requireAuth('editor'), async (req, res) => {
    try {
        const { path: folderPath, name } = req.body;
        const assetsPath = path.join(DATA_DIR, 'assets.json');
        const assets = JSON.parse(await fs.promises.readFile(assetsPath, 'utf-8'));
        const pathParts = folderPath ? folderPath.split('/').filter(Boolean) : [];
        let current = assets;
        for (const part of pathParts) {
            if (!current.folders) current.folders = [];
            current = current.folders.find(f => f.name === part);
            if (!current) return res.status(404).send('Parent folder not found');
        }
        if (!current.children) current.children = [];
        if (current.children.some(c => c.name === name)) {
            return res.status(400).json({ error: 'Folder already exists' });
        }
        current.children.push({ type: 'folder', name, children: [], folders: [] });
        await fs.promises.writeFile(assetsPath, JSON.stringify(assets, null, 2));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to create folder' });
    }
});

app.delete('/api/folder', requireAuth('editor'), async (req, res) => {
    try {
        const { path: folderPath } = req.body;
        const assetsPath = path.join(DATA_DIR, 'assets.json');
        const assets = JSON.parse(await fs.promises.readFile(assetsPath, 'utf-8'));
        const pathParts = folderPath.split('/').filter(Boolean);
        const folderName = pathParts.pop();
        let parent = assets;
        for (const part of pathParts) {
            if (!parent.folders) return res.status(404).json({ error: 'Parent folder not found' });
            parent = parent.folders.find(f => f.name === part);
            if (!parent) return res.status(404).json({ error: 'Parent folder not found' });
        }
        if (!parent.children) return res.status(404).json({ error: 'Folder not found' });
        parent.children = parent.children.filter(c => !(c.type === 'folder' && c.name === folderName));
        await fs.promises.writeFile(assetsPath, JSON.stringify(assets, null, 2));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete folder' });
    }
});

app.put('/api/folder/rename', requireAuth('editor'), async (req, res) => {
    try {
        const { path: folderPath, newName } = req.body;
        const assetsPath = path.join(DATA_DIR, 'assets.json');
        const assets = JSON.parse(await fs.promises.readFile(assetsPath, 'utf-8'));
        const pathParts = folderPath.split('/').filter(Boolean);
        const oldName = pathParts.pop();
        let parent = assets;
        for (const part of pathParts) {
            if (!parent.folders) return res.status(404).json({ error: 'Parent folder not found' });
            parent = parent.folders.find(f => f.name === part);
            if (!parent) return res.status(404).json({ error: 'Parent folder not found' });
        }
        if (!parent.children) return res.status(404).json({ error: 'Folder not found' });
        const folder = parent.children.find(c => c.type === 'folder' && c.name === oldName);
        if (!folder) return res.status(404).json({ error: 'Folder not found' });
        folder.name = newName;
        await fs.promises.writeFile(assetsPath, JSON.stringify(assets, null, 2));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to rename folder' });
    }
});


// GCS Asset Upload
app.post('/upload-image', requireAuth('editor'), assetUpload.any(), async (req, res) => {
    let file = req.files?.find(f => ['file', 'image'].includes(f.fieldname));
    if (!file) return res.status(400).json({ error: 'No file provided' });
    
    const folder = req.body.folder || '';
    let buffer = file.buffer, filename = file.originalname, contentType = file.mimetype;
    
    if (contentType === 'image/tiff') {
        try {
            buffer = await sharp(file.buffer).png().toBuffer();
            filename = filename.replace(/\.tif{1,2}$/i, '.png');
            contentType = 'image/png';
        } catch (err) {
            return res.status(500).json({ error: 'Failed to convert TIFF to PNG' });
        }
    }

    const gcsPath = [folder, filename].filter(Boolean).join('/');
    const bucket = gcsStorage.bucket(gcsBucketName);
    const blob = bucket.file(gcsPath);
    const blobStream = blob.createWriteStream({ resumable: false, contentType });

    blobStream.on('error', err => res.status(500).json({ error: err.message }))
              .on('finish', () => res.json({ url: `https://storage.googleapis.com/${bucket.name}/${blob.name}` }))
              .end(buffer);
});

// --- CORRECTED GCS ASSET LISTING ENDPOINT ---
// This is the single, correct endpoint for listing GCS assets.
app.get('/api/list-gcs-assets', requireAuth('editor'), async (req, res) => {
  console.log(`--- Received request for /api/list-gcs-assets at ${new Date().toISOString()} ---`);
  try {
    console.log(`Using bucket: ${gcsBucketName}`);
    const bucket = gcsStorage.bucket(gcsBucketName);
    
    const [files] = await bucket.getFiles();
    console.log(`Successfully fetched ${files.length} files from GCS.`);

    const assetFiles = files.filter(f => f.metadata.contentType && (f.metadata.contentType.startsWith('image/') || f.metadata.contentType.startsWith('video/')));
    const urls = assetFiles.map(f => `https://storage.googleapis.com/${gcsBucketName}/${f.name}`);

    console.log(`Found ${urls.length} image/video assets. Sending response.`);
    
    // Ensure the response format is exactly what the frontend expects
    res.json({ images: urls });

  } catch (err) {
    console.error('--- ERROR IN /api/list-gcs-assets ---', err);
    res.status(500).json({
      error: 'Failed to list GCS assets',
      details: err.message,
      fullError: err,
    });
  }
});

// Cover & Data Management Endpoints
app.post('/save-cover', requireAuth('editor'), async (req, res) => {
    try {
        const cover = req.body;
        if (!cover || !cover.id) {
            return res.status(400).json({ error: 'Invalid cover data', details: 'Missing ID' });
        }
        const jsonPath = path.join(DATA_DIR, 'covers.json');
        let covers = await readJsonFile(jsonPath, 'covers') || [];
        const idx = covers.findIndex(c => String(c.id) === String(cover.id));
        if (idx === -1) {
            covers.push(cover);
        } else {
            covers[idx] = cover;
        }
        await fs.promises.writeFile(jsonPath, JSON.stringify(covers, null, 2));
        dataCache.invalidate('covers');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to save cover', details: err.message });
    }
});

app.post('/delete-cover', requireAuth('editor'), async (req, res) => {
    try {
        const { id } = req.body;
        const jsonPath = path.join(DATA_DIR, 'covers.json');
        let covers = await readJsonFile(jsonPath, 'covers') || [];
        covers = covers.filter(c => String(c.id) !== String(id));
        await fs.promises.writeFile(jsonPath, JSON.stringify(covers, null, 2));
        dataCache.invalidate('covers');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete cover', details: err.message });
    }
});

app.post('/save-covers', requireAuth('editor'), async (req, res) => {
    try {
        const covers = req.body;
        const jsonPath = path.join(DATA_DIR, 'covers.json');
        await fs.promises.writeFile(jsonPath, JSON.stringify(covers, null, 2));
        dataCache.invalidate('covers');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to save covers', details: err.message });
    }
});

app.post('/save-assets', requireAuth('editor'), async (req, res) => {
    try {
        const assets = req.body;
        const jsonPath = path.join(DATA_DIR, 'assets.json');
        await fs.promises.writeFile(jsonPath, JSON.stringify(assets, null, 2));
        dataCache.invalidate('assets');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to save assets', details: err.message });
    }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  if (process.env.NODE_ENV === 'production') {
    console.log(`Admin interface available at: https://admin.allmyfriendsinc.com/`);
  } else {
    console.log(`Admin interface: http://localhost:${PORT}/admin/`);
  }
});
