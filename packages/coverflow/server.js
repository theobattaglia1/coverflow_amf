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
import { execSync } from 'child_process';

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
  keyFilename: process.env.NODE_ENV === 'production' 
    ? '/etc/secrets/service-account.json' // Correct path for Render Secret Files
    : path.join(__dirname, '../../gcp/service-account.json') // Local development path
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
  // In development, treat localhost as admin subdomain if accessing /admin/ paths
  // or if the Host header indicates admin subdomain
  if (process.env.NODE_ENV === 'development') {
    return req.hostname.startsWith('admin.') || 
           req.path.startsWith('/admin/') ||
           req.get('Host')?.startsWith('admin.');
  }
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
      // Redirect to appropriate login page based on context
      if (isAdminSubdomain(req) || req.path.startsWith('/admin/')) {
        return res.redirect('/admin/login.html');
      }
      return res.redirect('/login.html');
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

// Safe file write with backup
async function safeWriteJson(filePath, data) {
  const backupPath = filePath.replace('.json', '-backup.json');
  const tempPath = filePath + '.tmp';
  
  try {
    // Create backup if original file exists
    try {
      await fs.promises.access(filePath);
      await fs.promises.copyFile(filePath, backupPath);
    } catch (err) {
      // Original file doesn't exist, no backup needed
    }
    
    // Write to temporary file first
    await fs.promises.writeFile(tempPath, JSON.stringify(data, null, 2));
    
    // Atomic move to final location
    await fs.promises.rename(tempPath, filePath);
    
    console.log(`Successfully saved ${filePath}`);
  } catch (err) {
    // Clean up temp file if it exists
    try {
      await fs.promises.unlink(tempPath);
    } catch (unlinkErr) {
      // Ignore unlink errors
    }
    throw err;
  }
}

async function saveUsers(users) {
  const usersPath = path.join(DATA_DIR, 'users.json');
  await safeWriteJson(usersPath, users);
  userCache.invalidate('users');
}

// Helper: Git commit and push automation
function gitAutoSyncDataFiles() {
  if (process.env.ENABLE_GIT_SYNC !== 'true') {
    console.log('[GIT SYNC] Skipped: ENABLE_GIT_SYNC is not set to true');
    return;
  }
  try {
    const coversPath = path.join(DATA_DIR, 'covers.json');
    const assetsPath = path.join(DATA_DIR, 'assets.json');
    execSync(`git add "${coversPath}" "${assetsPath}"`, { stdio: 'inherit' });
    execSync('git config user.name "AMF Admin Bot"', { stdio: 'inherit' });
    execSync('git config user.email "admin-bot@allmyfriendsinc.com"', { stdio: 'inherit' });
    execSync('git commit -m "Auto-sync covers and assets after push live"', { stdio: 'inherit' });
    let pushCmd = 'git push';
    if (process.env.GIT_TOKEN) {
      // Use HTTPS with token for authentication
      const repo = process.env.GIT_REPO_URL || 'https://github.com/theobattaglia1/coverflow_amf.git';
      pushCmd = `git push https://${process.env.GIT_TOKEN}@${repo.replace(/^https:\/\//, '')} main`;
    }
    execSync(pushCmd, { stdio: 'inherit' });
    console.log('[GIT SYNC] Successfully committed and pushed covers.json and assets.json');
  } catch (err) {
    if (err.message && err.message.includes('nothing to commit')) {
      console.log('[GIT SYNC] No changes to commit');
    } else {
      console.error('[GIT SYNC] Failed to commit and push:', err);
    }
  }
}

// --- Routing ---

// Admin subdomain handler
app.use((req, res, next) => {
  if (isAdminSubdomain(req)) {
    console.log(`Admin subdomain request: ${req.method} ${req.path} from ${req.get('Host')}`);
    
    // First, try to serve static files from the ADMIN_DIR
    express.static(ADMIN_DIR)(req, res, (err) => {
      // If the static file is not found, or there's an error, move to other routes
      if (err) {
        console.error('Static file error in admin handler:', err);
        return next(err);
      }
      // If a file was served, the response is already sent.
      // If not, we check our specific routes.
      if (res.headersSent) {
        return;
      }

      // Admin endpoints that should pass through to their handlers
      const adminEndpoints = [
        '/api/', '/data/', '/upload-image', '/save-cover', '/delete-cover', 
        '/save-covers', '/save-assets', '/push-live'
      ];
      
      if (adminEndpoints.some(endpoint => req.path.startsWith(endpoint) || req.path === endpoint.slice(0, -1))) {
        console.log(`Passing through admin endpoint: ${req.path}`);
        return next();
      }

      // Handle root path for authenticated vs unauthenticated users
      if (req.path === '/' || req.path === '') {
        if (isAuthenticated(req)) {
          return res.sendFile(path.join(ADMIN_DIR, 'index.html'));
        } else {
          return res.redirect('/admin/login.html');
        }
      }
      
      // If we reach here, it means no static file was found and no specific route matched.
      // Let the next handlers try, or it will eventually 404.
      console.log(`No specific handler found for admin path: ${req.path}, passing to next`);
      next();
    });
  } else {
    // Not an admin subdomain, continue to public routes
    next();
  }
});

// Development mode: Add specific routes for /admin/* paths
if (process.env.NODE_ENV === 'development') {
  app.get('/admin', (req, res) => {
    console.log('Hit /admin route, checking auth...');
    console.log('isAuthenticated result:', isAuthenticated(req));
    if (isAuthenticated(req)) {
      const filePath = path.join(ADMIN_DIR, 'index.html');
      console.log('Serving admin file:', filePath);
      res.sendFile(filePath);
    } else {
      console.log('Not authenticated, redirecting to login');
      res.redirect('/admin/login.html');
    }
  });
  
  app.use('/admin', express.static(ADMIN_DIR));
}


// Basic auth for specific public files
app.get('/hudson-deck.html', basicAuth({ users: { 'guest': 'MakeItTogether25!' }, challenge: true }), (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'hudson-deck.html'));
});

// Static files for PUBLIC site
app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));

// Static files for /data directory (JSON files) with better error handling
app.use('/data', (req, res, next) => {
  // Add CORS headers for data requests
  res.header('Access-Control-Allow-Origin', req.get('Origin') || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Log data requests for debugging
  console.log(`Data request: ${req.method} ${req.path} from ${req.get('Host')}`);
  
  express.static(DATA_DIR)(req, res, (err) => {
    if (err) {
      console.error('Error serving data file:', err);
      res.status(404).json({ error: 'Data file not found', path: req.path });
    } else {
      next();
    }
  });
});

// Multer setup for file uploads
const assetUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

// --- API Endpoints ---

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: '1.0.0'
  });
});

// Authentication
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Only allow login for the 'admin' user from env variable
    if (
      username === 'admin' &&
      password === process.env.ADMIN_PASSWORD
    ) {
      req.session.user = { username: 'admin', role: 'admin' };
      return res.json({ success: true, role: 'admin' });
    } else {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
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

// Bulk asset operations for multi-select drag-and-drop
app.post('/api/assets/bulk-move', requireAuth('editor'), async (req, res) => {
    try {
        const { assetUrls, targetFolder } = req.body;
        if (!Array.isArray(assetUrls) || assetUrls.length === 0) {
            return res.status(400).json({ error: 'Invalid asset URLs provided' });
        }
        
        const assetsPath = path.join(DATA_DIR, 'assets.json');
        let assets = await readJsonFile(assetsPath, 'assets') || { images: [], folders: [] };
        
        // Ensure assets structure exists
        if (!assets.images) assets.images = [];
        if (!assets.folders) assets.folders = [];
        
        // Find assets to move
        const assetsToMove = assets.images.filter(asset => assetUrls.includes(asset.url));
        
        if (assetsToMove.length === 0) {
            return res.status(404).json({ error: 'No matching assets found' });
        }
        
        // Remove assets from current location
        assets.images = assets.images.filter(asset => !assetUrls.includes(asset.url));
        
        // Add folder property to moved assets
        assetsToMove.forEach(asset => {
            asset.folder = targetFolder || '';
            asset.movedAt = new Date().toISOString();
        });
        
        // For simplified implementation, we'll just add them back to the images array
        // In a more complex implementation, you'd handle the folder structure properly
        assets.images.push(...assetsToMove);
        
        await safeWriteJson(assetsPath, assets);
        dataCache.invalidate('assets');
        
        console.log(`Bulk moved ${assetsToMove.length} assets to folder: ${targetFolder || 'ROOT'}`);
        res.json({ 
            success: true, 
            movedCount: assetsToMove.length,
            targetFolder: targetFolder || 'ROOT'
        });
    } catch (err) {
        console.error('Bulk asset move error:', err);
        res.status(500).json({ error: 'Failed to move assets', details: err.message });
    }
});

app.delete('/api/assets/bulk-delete', requireAuth('editor'), async (req, res) => {
    try {
        const { assetUrls } = req.body;
        if (!Array.isArray(assetUrls) || assetUrls.length === 0) {
            return res.status(400).json({ error: 'Invalid asset URLs provided' });
        }
        
        const assetsPath = path.join(DATA_DIR, 'assets.json');
        let assets = await readJsonFile(assetsPath, 'assets') || { images: [], folders: [] };
        
        const initialCount = assets.images?.length || 0;
        
        // Remove assets from data structure
        if (assets.images) {
            assets.images = assets.images.filter(asset => !assetUrls.includes(asset.url));
        }
        
        const deletedCount = initialCount - (assets.images?.length || 0);
        
        await safeWriteJson(assetsPath, assets);
        dataCache.invalidate('assets');
        
        console.log(`Bulk deleted ${deletedCount} assets`);
        res.json({ 
            success: true, 
            deletedCount,
            remainingCount: assets.images?.length || 0
        });
    } catch (err) {
        console.error('Bulk asset delete error:', err);
        res.status(500).json({ error: 'Failed to delete assets', details: err.message });
    }
});

app.put('/api/assets/bulk-update', requireAuth('editor'), async (req, res) => {
    try {
        const { updates } = req.body; // Array of { url, name, folder, ... }
        if (!Array.isArray(updates) || updates.length === 0) {
            return res.status(400).json({ error: 'Invalid updates provided' });
        }
        
        const assetsPath = path.join(DATA_DIR, 'assets.json');
        let assets = await readJsonFile(assetsPath, 'assets') || { images: [], folders: [] };
        
        if (!assets.images) assets.images = [];
        
        let updateCount = 0;
        
        // Apply updates
        updates.forEach(update => {
            const asset = assets.images.find(a => a.url === update.url);
            if (asset) {
                Object.assign(asset, update);
                asset.updatedAt = new Date().toISOString();
                updateCount++;
            }
        });
        
        await safeWriteJson(assetsPath, assets);
        dataCache.invalidate('assets');
        
        console.log(`Bulk updated ${updateCount} assets`);
        res.json({ 
            success: true, 
            updatedCount: updateCount
        });
    } catch (err) {
        console.error('Bulk asset update error:', err);
        res.status(500).json({ error: 'Failed to update assets', details: err.message });
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
    
    // In development mode, return mock data when GCS is not available
    if (process.env.NODE_ENV === 'development') {
      console.log('--- DEVELOPMENT MODE: Returning mock GCS assets ---');
      const mockAssets = [
        `https://storage.googleapis.com/${gcsBucketName}/sample-cover-1.jpg`,
        `https://storage.googleapis.com/${gcsBucketName}/sample-cover-2.jpg`,
        `https://storage.googleapis.com/${gcsBucketName}/sample-cover-3.jpg`,
        `https://storage.googleapis.com/${gcsBucketName}/album-art/demo-album.png`,
        `https://storage.googleapis.com/${gcsBucketName}/assets/uploaded-image.jpg`
      ];
      return res.json({ images: mockAssets });
    }
    
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
            console.log(`Added new cover: ${cover.id} - ${cover.albumTitle || 'Untitled'}`);
        } else {
            covers[idx] = cover;
            console.log(`Updated cover: ${cover.id} - ${cover.albumTitle || 'Untitled'}`);
        }
        
        await safeWriteJson(jsonPath, covers);
        dataCache.invalidate('covers');
        res.json({ success: true });
    } catch (err) {
        console.error('Save cover error:', err);
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
        if (!Array.isArray(covers)) {
            return res.status(400).json({ error: 'Invalid data format', details: 'Expected array of covers' });
        }
        
        const jsonPath = path.join(DATA_DIR, 'covers.json');
        await safeWriteJson(jsonPath, covers);
        dataCache.invalidate('covers');
        console.log(`Bulk saved ${covers.length} covers`);
        res.json({ success: true, count: covers.length });
    } catch (err) {
        console.error('Save covers error:', err);
        res.status(500).json({ error: 'Failed to save covers', details: err.message });
    }
});

app.post('/save-assets', requireAuth('editor'), async (req, res) => {
    try {
        const assets = req.body;
        const jsonPath = path.join(DATA_DIR, 'assets.json');
        await safeWriteJson(jsonPath, assets);
        dataCache.invalidate('assets');
        console.log('Assets data saved successfully');
        res.json({ success: true });
    } catch (err) {
        console.error('Save assets error:', err);
        res.status(500).json({ error: 'Failed to save assets', details: err.message });
    }
});

// Push Live Endpoint - Finalizes all changes and makes them live
app.post('/push-live', requireAuth('editor'), async (req, res) => {
    try {
        console.log(`--- Push Live request at ${new Date().toISOString()} by user: ${req.session.user?.username} ---`);
        
        // Validate that all critical data files exist and are readable
        const criticalFiles = [
            { path: path.join(DATA_DIR, 'covers.json'), name: 'covers' },
            { path: path.join(DATA_DIR, 'assets.json'), name: 'assets' }
        ];
        
        const validationResults = [];
        
        for (const file of criticalFiles) {
            try {
                await fs.promises.access(file.path, fs.constants.R_OK);
                const data = await fs.promises.readFile(file.path, 'utf-8');
                const parsed = JSON.parse(data);
                validationResults.push({
                    file: file.name,
                    status: 'ok',
                    size: data.length,
                    records: Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length
                });
            } catch (err) {
                console.error(`Validation failed for ${file.name}:`, err);
                validationResults.push({
                    file: file.name,
                    status: 'error',
                    error: err.message
                });
            }
        }
        
        // Check if any validations failed
        const failed = validationResults.filter(r => r.status === 'error');
        if (failed.length > 0) {
            return res.status(500).json({ 
                error: 'Pre-flight validation failed', 
                details: failed,
                message: 'Cannot push live with invalid data files'
            });
        }
        
        // Invalidate all caches to ensure fresh data
        dataCache.invalidate('covers');
        dataCache.invalidate('assets');
        // --- GIT SYNC: Commit and push covers.json and assets.json ---
        gitAutoSyncDataFiles();
        
        console.log('--- Push Live completed successfully ---');
        console.log('Validation results:', validationResults);
        
        res.json({ 
            success: true, 
            message: 'Changes pushed live successfully',
            validation: validationResults,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error('Push Live error:', err);
        res.status(500).json({ error: 'Failed to push live', details: err.message });
    }
});

// Data backup and recovery endpoints
app.get('/api/backup/list', requireAuth('admin'), async (req, res) => {
  try {
    const files = await fs.promises.readdir(DATA_DIR);
    const backups = files.filter(f => f.endsWith('-backup.json')).map(f => ({
      name: f,
      type: f.replace('-backup.json', ''),
      path: `/data/${f}`
    }));
    res.json({ backups });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list backups', details: err.message });
  }
});

app.post('/api/backup/restore/:type', requireAuth('admin'), async (req, res) => {
  try {
    const { type } = req.params;
    const backupPath = path.join(DATA_DIR, `${type}-backup.json`);
    const mainPath = path.join(DATA_DIR, `${type}.json`);
    
    // Check if backup exists
    await fs.promises.access(backupPath);
    
    // Copy backup to main file
    await fs.promises.copyFile(backupPath, mainPath);
    
    // Invalidate cache
    dataCache.invalidate(type);
    
    console.log(`Restored ${type} from backup by user: ${req.session.user?.username}`);
    res.json({ success: true, message: `Restored ${type} from backup` });
  } catch (err) {
    console.error('Backup restore error:', err);
    res.status(500).json({ error: 'Failed to restore backup', details: err.message });
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
