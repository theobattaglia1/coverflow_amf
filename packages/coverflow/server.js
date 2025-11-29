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
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import { execSync } from 'child_process';

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

// --- Diagnostic Log ---
// This line confirms that the correct file is being executed on Render.
console.log("--- Executing /packages/coverflow/server.js @ " + new Date().toISOString() + " ---");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_DIR = path.join(__dirname, 'public');
const ADMIN_DIR = path.join(__dirname, 'admin');

const DEFAULT_DATA_DIR = path.join(__dirname, 'data');

function ensureWritableDirectory(dirPath) {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
    fs.accessSync(dirPath, fs.constants.W_OK);
    return true;
  } catch (err) {
    console.warn(`[DATA] Directory ${dirPath} not usable (${err.code || err.message})`);
    return false;
  }
}

const DATA_DIR = (() => {
  // If GCS sync is enabled, always use bundled directory (GCS is the persistence layer)
  const syncProvider = (process.env.DATA_SYNC_PROVIDER || '').toLowerCase();
  if (syncProvider === 'gcs') {
    ensureWritableDirectory(DEFAULT_DATA_DIR);
    console.log(`[DATA] GCS sync enabled - using bundled data directory: ${DEFAULT_DATA_DIR}`);
    return DEFAULT_DATA_DIR;
  }
  
  // Otherwise, try override path if specified
  const overridePath = process.env.DATA_DIR_PATH?.trim();
  if (overridePath) {
    const resolved = path.resolve(overridePath);
    if (ensureWritableDirectory(resolved)) {
      console.log(`[DATA] Using override data directory: ${resolved}`);
      return resolved;
    }
    console.warn(`[DATA] Override directory not writable, falling back to bundled: ${DEFAULT_DATA_DIR}`);
  } else {
    console.log(`[DATA] Using bundled data directory: ${DEFAULT_DATA_DIR}`);
  }
  ensureWritableDirectory(DEFAULT_DATA_DIR);
  return DEFAULT_DATA_DIR;
})();
prepareDataDirectory();

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

const dataSyncConfig = (() => {
  const files = (process.env.DATA_SYNC_FILES || 'covers.json,assets.json')
    .split(',')
    .map(f => f.trim())
    .filter(Boolean);
  return {
    provider: (process.env.DATA_SYNC_PROVIDER || '').toLowerCase(),
    bucket: process.env.DATA_SYNC_BUCKET || gcsBucketName,
    prefix: process.env.DATA_SYNC_PREFIX || 'admin-data',
    files,
    enableStartupSync: process.env.DATA_SYNC_ON_START !== 'false',
    enablePostWriteSync: process.env.DATA_SYNC_ON_SAVE !== 'false'
  };
})();
const dataSyncEnabled = ['gcs'].includes(dataSyncConfig.provider);
if (dataSyncEnabled) {
  console.log(`[DATA SYNC] Enabled with provider=${dataSyncConfig.provider}, bucket=${dataSyncConfig.bucket}, prefix=${dataSyncConfig.prefix}, files=${dataSyncConfig.files.join(', ')}`);
}

await initializeDataSync();


// --- Middleware Setup ---

// Trust proxy in production for secure cookies
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// CORS configuration - Permissive for FlutterFlow Testing
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    // For now, allow ALL origins so FlutterFlow Test Mode works without issues.
    // We can tighten this back up later when the app is published.
    return callback(null, true);
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
  const serialized = JSON.stringify(data, null, 2);
  
  try {
    // Ensure the directory exists before writing
    const dirPath = path.dirname(filePath);
    try {
      await fs.promises.mkdir(dirPath, { recursive: true });
    } catch (mkdirErr) {
      // If directory creation fails, try to write anyway (parent might exist)
      if (mkdirErr.code !== 'EEXIST') {
        console.warn(`Could not ensure directory exists for ${filePath}: ${mkdirErr.message}`);
      }
    }
    
    // Create backup if original file exists
    try {
      await fs.promises.access(filePath);
      await fs.promises.copyFile(filePath, backupPath);
    } catch (err) {
      // Original file doesn't exist, no backup needed
    }
    
    // Write to temporary file first
    await fs.promises.writeFile(tempPath, serialized);
    
    // Atomic move to final location
    await fs.promises.rename(tempPath, filePath);
    
    console.log(`Successfully saved ${filePath}`);
    await syncFileToRemote(filePath, serialized);
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

function prepareDataDirectory() {
  const resolvedDataDir = path.resolve(DATA_DIR);
  const resolvedDefaultDir = path.resolve(DEFAULT_DATA_DIR);

  if (resolvedDataDir !== resolvedDefaultDir && fs.existsSync(resolvedDefaultDir)) {
    try {
      const seedFiles = fs.readdirSync(DEFAULT_DATA_DIR).filter(file => file.endsWith('.json'));
      for (const file of seedFiles) {
        const targetPath = path.join(DATA_DIR, file);
        if (!fs.existsSync(targetPath)) {
          fs.copyFileSync(path.join(DEFAULT_DATA_DIR, file), targetPath);
          console.log(`[DATA] Seeded ${file} into ${DATA_DIR}`);
        }
      }
    } catch (err) {
      console.warn(`[DATA] Could not seed files: ${err.message}`);
    }
  }
}

async function initializeDataSync() {
  if (!dataSyncEnabled) {
    return;
  }
  if (!dataSyncConfig.enableStartupSync) {
    console.log('[DATA SYNC] Startup sync disabled via DATA_SYNC_ON_START=false');
    return;
  }

  console.log(`[DATA SYNC] Starting startup sync for files: ${dataSyncConfig.files.join(', ')}`);
  for (const fileName of dataSyncConfig.files) {
    try {
      const didSync = await syncFileFromRemote(fileName);
      if (didSync) {
        console.log(`[DATA SYNC] Synced ${fileName} from remote source`);
      } else {
        console.warn(`[DATA SYNC] Remote copy for ${fileName} not found; keeping local version`);
      }
    } catch (err) {
      console.error(`[DATA SYNC] Failed to synchronize ${fileName} on startup:`, err.message);
      console.warn(`[DATA SYNC] Continuing with local version of ${fileName}`);
      // Don't throw - allow server to start even if sync fails
    }
  }
}

async function syncFileFromRemote(fileName) {
  if (!dataSyncEnabled) return false;
  if (!dataSyncConfig.files.includes(fileName)) return false;

  switch (dataSyncConfig.provider) {
    case 'gcs':
      return downloadJsonFromGcs(fileName);
    default:
      console.warn(`[DATA SYNC] Unsupported provider "${dataSyncConfig.provider}"`);
      return false;
  }
}

async function syncFileToRemote(filePath, serializedPayload) {
  if (!dataSyncEnabled) return;
  if (!dataSyncConfig.enablePostWriteSync) return;

  const fileName = path.basename(filePath);
  if (!dataSyncConfig.files.includes(fileName)) return;

  switch (dataSyncConfig.provider) {
    case 'gcs':
      await uploadJsonToGcs(fileName, serializedPayload);
      break;
    default:
      console.warn(`[DATA SYNC] Unsupported provider "${dataSyncConfig.provider}"`);
  }
}

function getRemoteDataKey(fileName) {
  const trimmedPrefix = (dataSyncConfig.prefix || '').replace(/^\/+|\/+$/g, '');
  return trimmedPrefix ? `${trimmedPrefix}/${fileName}` : fileName;
}

async function uploadJsonToGcs(fileName, serializedPayload) {
  if (!dataSyncConfig.bucket) {
    throw new Error('DATA_SYNC_BUCKET is not configured');
  }
  const bucket = gcsStorage.bucket(dataSyncConfig.bucket);
  const remoteKey = getRemoteDataKey(fileName);
  console.log(`[DATA SYNC] Uploading ${fileName} to gs://${bucket.name}/${remoteKey}`);
  await bucket
    .file(remoteKey)
    .save(serializedPayload, { contentType: 'application/json', resumable: false });
}

async function downloadJsonFromGcs(fileName) {
  if (!dataSyncConfig.bucket) {
    throw new Error('DATA_SYNC_BUCKET is not configured');
  }
  const bucket = gcsStorage.bucket(dataSyncConfig.bucket);
  const remoteKey = getRemoteDataKey(fileName);
  const file = bucket.file(remoteKey);
  const [exists] = await file.exists();
  if (!exists) {
    console.warn(`[DATA SYNC] Remote file gs://${bucket.name}/${remoteKey} does not exist`);
    return false;
  }
  const [contents] = await file.download();
  const destinationPath = path.join(DATA_DIR, fileName);
  
  // Ensure the directory exists before writing
  try {
    await fs.promises.mkdir(DATA_DIR, { recursive: true });
    // Verify we can actually write to it
    await fs.promises.access(DATA_DIR, fs.constants.W_OK);
  } catch (dirErr) {
    // If we can't use DATA_DIR, this is a serious problem
    console.error(`[DATA SYNC] Cannot write to DATA_DIR ${DATA_DIR}: ${dirErr.message}`);
    throw new Error(`Data directory not writable: ${DATA_DIR}`);
  }
  
  try {
    await fs.promises.writeFile(destinationPath, contents);
    console.log(`[DATA SYNC] Downloaded ${fileName} from gs://${bucket.name}/${remoteKey} to ${destinationPath}`);
    return true;
  } catch (writeErr) {
    console.error(`[DATA SYNC] Failed to write ${fileName} to ${destinationPath}: ${writeErr.message}`);
    throw writeErr;
  }
}

// Helper: Git commit and push automation
function gitAutoSyncDataFiles() {
  if (process.env.ENABLE_GIT_SYNC !== 'true') {
    console.log('[GIT SYNC] Skipped: ENABLE_GIT_SYNC is not set to true');
    return;
  }

  const resolvedDataDir = path.resolve(DATA_DIR);
  const resolvedRepoDir = path.resolve(__dirname);

  if (!resolvedDataDir.startsWith(resolvedRepoDir)) {
    console.log('[GIT SYNC] Skipped: DATA_DIR_PATH points outside of repo');
    return;
  }
  try {
    // Collect all JSON files in DATA_DIR except backups
    const allFiles = fs.readdirSync(DATA_DIR)
      .filter(f => f.endsWith('.json') && !f.includes('-backup'))
      .map(f => path.join(DATA_DIR, f));

    if (allFiles.length === 0) {
      console.log('[GIT SYNC] No data files found to add');
      return;
    }

    const addCmd = `git add ${allFiles.map(p => `"${p}"`).join(' ')}`;
    execSync(addCmd, { stdio: 'inherit' });

    // Ensure identity is set (works even if already configured)
    execSync('git config user.name "AMF Admin Bot"', { stdio: 'inherit' });
    execSync('git config user.email "admin-bot@allmyfriendsinc.com"', { stdio: 'inherit' });

    // Commit; if nothing changed, this will throw and be handled below
    execSync('git commit -m "Auto-sync data after Push Live"', { stdio: 'inherit' });

    const branch = process.env.GIT_BRANCH || 'main';
    let pushCmd = 'git push';
    if (process.env.GIT_TOKEN) {
      const repo = process.env.GIT_REPO_URL || 'https://github.com/theobattaglia1/coverflow_amf.git';
      pushCmd = `git push https://${process.env.GIT_TOKEN}@${repo.replace(/^https:\/\//, '')} ${branch}`;
    }
    execSync(pushCmd, { stdio: 'inherit' });
    console.log(`[GIT SYNC] Successfully committed and pushed ${allFiles.length} data file(s)`);
  } catch (err) {
    if (String(err?.message || '').includes('nothing to commit')) {
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
        
        console.log(`[FOLDER] Raw request body:`, req.body);
        console.log(`[FOLDER] Creating folder: "${name}" at path: "${folderPath || 'root'}"`);
        
        if (!name || name.trim() === '') {
            console.error(`[FOLDER] Invalid folder name provided`);
            return res.status(400).json({ error: 'Folder name is required' });
        }
        
        const assetsPath = path.join(DATA_DIR, 'assets.json');
        let assets;
        
        try {
            const assetsData = await fs.promises.readFile(assetsPath, 'utf-8');
            assets = JSON.parse(assetsData);
        } catch (parseError) {
            console.error(`[FOLDER] Failed to read/parse assets.json:`, parseError);
            return res.status(500).json({ error: 'Failed to read assets data' });
        }
        
        // Ensure root structure exists
        if (!assets.children) assets.children = [];
        
        // Navigate to the parent folder
        const pathParts = folderPath ? folderPath.split('/').filter(Boolean) : [];
        let current = assets;
        
        console.log(`[FOLDER] Navigating through path parts:`, pathParts);
        
        for (const part of pathParts) {
            if (!current.children) current.children = [];
            const folder = current.children.find(c => c.type === 'folder' && c.name === part);
            if (!folder) {
                console.error(`[FOLDER] Parent folder not found: "${part}" in path "${folderPath}"`);
                return res.status(404).json({ 
                    error: `Parent folder not found: ${part}`,
                    path: folderPath,
                    searchedFor: part
                });
            }
            current = folder;
            console.log(`[FOLDER] Found folder: "${part}"`);
        }
        
        // Ensure current folder has children array
        if (!current.children) current.children = [];
        
        // Check if folder already exists
        const existingFolder = current.children.find(c => c.type === 'folder' && c.name === name);
        if (existingFolder) {
            console.warn(`[FOLDER] Folder already exists: "${name}" at path "${folderPath}"`);
            return res.status(400).json({ 
                error: `Folder "${name}" already exists`,
                existingFolder: existingFolder.name
            });
        }
        
        // Create new folder
        const newFolder = {
            type: 'folder',
            name: name.trim(),
            children: [],
            createdAt: new Date().toISOString()
        };
        
        current.children.push(newFolder);
        console.log(`[FOLDER] Added folder to structure:`, newFolder);
        
        // Save to file with atomic write
        try {
            await safeWriteJson(assetsPath, assets);
            dataCache.invalidate('assets');
            console.log(`[FOLDER] Successfully saved assets.json`);
        } catch (saveError) {
            console.error(`[FOLDER] Failed to save assets.json:`, saveError);
            return res.status(500).json({ 
                error: 'Failed to save folder data',
                details: saveError.message 
            });
        }
        
        console.log(`[FOLDER] Successfully created folder: "${name}" at path "${folderPath}"`);
        res.json({ 
            success: true, 
            folder: newFolder,
            path: folderPath 
        });
        
    } catch (err) {
        console.error('[FOLDER] Unexpected error creating folder:', err);
        res.status(500).json({ 
            error: 'Failed to create folder', 
            details: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
});

app.delete('/api/folder', requireAuth('editor'), async (req, res) => {
    try {
        const { path: folderPath } = req.body;
        console.log(`[FOLDER] Deleting folder at path: ${folderPath}`);
        
        const assetsPath = path.join(DATA_DIR, 'assets.json');
        const assets = JSON.parse(await fs.promises.readFile(assetsPath, 'utf-8'));
        
        const pathParts = folderPath.split('/').filter(Boolean);
        const folderName = pathParts.pop();
        
        // Navigate to parent folder
        let parent = assets;
        for (const part of pathParts) {
            if (!parent.children) {
                console.error(`[FOLDER] Parent folder not found: ${part}`);
                return res.status(404).json({ error: 'Parent folder not found' });
            }
            const folder = parent.children.find(c => c.type === 'folder' && c.name === part);
            if (!folder) {
                console.error(`[FOLDER] Parent folder not found: ${part}`);
                return res.status(404).json({ error: 'Parent folder not found' });
            }
            parent = folder;
        }
        
        if (!parent.children) {
            console.error(`[FOLDER] Folder not found: ${folderName}`);
            return res.status(404).json({ error: 'Folder not found' });
        }
        
        // Remove the folder
        const originalLength = parent.children.length;
        parent.children = parent.children.filter(c => !(c.type === 'folder' && c.name === folderName));
        
        if (parent.children.length === originalLength) {
            console.error(`[FOLDER] Folder not found: ${folderName}`);
            return res.status(404).json({ error: 'Folder not found' });
        }
        
        // Save to file with atomic write
        await safeWriteJson(assetsPath, assets);
        dataCache.invalidate('assets');
        
        console.log(`[FOLDER] Successfully deleted folder: ${folderName}`);
        res.json({ success: true });
        
    } catch (err) {
        console.error('[FOLDER] Failed to delete folder:', err);
        res.status(500).json({ error: 'Failed to delete folder', details: err.message });
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

// Helper functions for asset management
function findAssetRecursively(container, assetUrl) {
    // Search in root images array
    if (container.images) {
        const asset = container.images.find(img => img.url === assetUrl);
        if (asset) {
            return { asset, parent: container, location: 'images' };
        }
    }
    
    // Search in children folders recursively
    if (container.children) {
        for (const child of container.children) {
            if (child.type === 'folder') {
                const result = findAssetRecursively(child, assetUrl);
                if (result) {
                    return result;
                }
            } else if (child.type === 'image' && child.url === assetUrl) {
                // Found asset directly in children array
                return { asset: child, parent: container, location: 'children' };
            }
        }
    }
    
    return null;
}

function removeAssetFromLocation(container, assetUrl) {
    // Remove from root images array
    if (container.images) {
        const index = container.images.findIndex(img => img.url === assetUrl);
        if (index !== -1) {
            return container.images.splice(index, 1)[0];
        }
    }
    
    // Remove from children array
    if (container.children) {
        const index = container.children.findIndex(child => child.type === 'image' && child.url === assetUrl);
        if (index !== -1) {
            return container.children.splice(index, 1)[0];
        }
        
        // Remove from children folders recursively
        for (const child of container.children) {
            if (child.type === 'folder') {
                const removed = removeAssetFromLocation(child, assetUrl);
                if (removed) {
                    return removed;
                }
            }
        }
    }
    
    return null;
}

function findFolderByPath(container, folderPath) {
    if (!folderPath || folderPath === '' || folderPath === 'ROOT') {
        return container; // Return root container
    }
    
    const pathParts = folderPath.split('/').filter(Boolean);
    let current = container;
    
    for (const part of pathParts) {
        if (!current.children) {
            return null; // Path doesn't exist
        }
        
        const folder = current.children.find(child => child.type === 'folder' && child.name === part);
        if (!folder) {
            return null; // Folder not found
        }
        
        current = folder;
    }
    
    return current;
}

// Bulk asset operations for multi-select drag-and-drop
app.post('/api/assets/bulk-move', requireAuth('editor'), async (req, res) => {
    try {
        const { assetUrls, targetFolder } = req.body;
        if (!Array.isArray(assetUrls) || assetUrls.length === 0) {
            return res.status(400).json({ error: 'Invalid asset URLs provided' });
        }
        
        const assetsPath = path.join(DATA_DIR, 'assets.json');
        let assets = await readJsonFile(assetsPath, 'assets') || { images: [], children: [] };
        
        // Ensure assets structure exists
        if (!assets.images) assets.images = [];
        if (!assets.children) assets.children = [];
        
        // Find target folder
        const targetFolderContainer = findFolderByPath(assets, targetFolder);
        if (!targetFolderContainer) {
            return res.status(404).json({ error: `Target folder not found: ${targetFolder}` });
        }
        
        // Find and remove assets from their current locations
        const assetsToMove = [];
        for (const assetUrl of assetUrls) {
            const removedAsset = removeAssetFromLocation(assets, assetUrl);
            if (removedAsset) {
                // Update asset metadata
                removedAsset.folder = targetFolder || '';
                removedAsset.movedAt = new Date().toISOString();
                assetsToMove.push(removedAsset);
            }
        }
        
        if (assetsToMove.length === 0) {
            return res.status(404).json({ error: 'No matching assets found' });
        }
        
        // Insert assets into target location
        if (!targetFolder || targetFolder === '' || targetFolder === 'ROOT') {
            // Move to root images array
            assets.images.push(...assetsToMove);
        } else {
            // Move to target folder's children array
            if (!targetFolderContainer.children) {
                targetFolderContainer.children = [];
            }
            
            // Convert assets to the correct format for folder children
            const folderAssets = assetsToMove.map(asset => ({
                type: 'image',
                url: asset.url,
                name: asset.filename || asset.name || path.basename(asset.url),
                uploadedAt: asset.uploadedAt || asset.movedAt,
                ...asset
            }));
            
            targetFolderContainer.children.push(...folderAssets);
        }
        
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


// GCS Asset Upload with Comprehensive Thumbnail Generation
app.post('/upload-image', requireAuth('editor'), assetUpload.any(), async (req, res) => {
    let file = req.files?.find(f => ['file', 'image'].includes(f.fieldname));
    if (!file) return res.status(400).json({ error: 'No file provided' });
    
    const folder = req.body.folder ? req.body.folder.trim() : '';
    let buffer = file.buffer, filename = file.originalname, contentType = file.mimetype;
    
    console.log(`[UPLOAD] Processing file: ${filename}, type: ${contentType}, size: ${buffer.length} bytes`);
    
    try {
        // Comprehensive file conversion for web compatibility
        const originalContentType = contentType;
        
        // Handle ALL image formats - convert to web-compatible formats
        if (contentType.startsWith('image/') || isImageByExtension(filename)) {
            console.log(`[UPLOAD] Processing image file: ${filename}, original type: ${contentType}`);
            
            try {
                // For formats that need conversion to web-compatible versions
                if (contentType === 'image/heic' || 
                    contentType === 'image/heif' ||
                    filename.toLowerCase().endsWith('.heic') || 
                    filename.toLowerCase().endsWith('.heif')) {
                    
                    console.log('[UPLOAD] Converting HEIC/HEIF to JPEG...');
                    buffer = await sharp(file.buffer).jpeg({ quality: 90 }).toBuffer();
                    filename = filename.replace(/\.heic?$/i, '.jpg');
                    contentType = 'image/jpeg';
                    
                } else if (contentType === 'image/tiff' || 
                          contentType === 'image/tif' ||
                          filename.toLowerCase().endsWith('.tiff') || 
                          filename.toLowerCase().endsWith('.tif')) {
                    
                    console.log('[UPLOAD] Converting TIFF to PNG...');
                    buffer = await sharp(file.buffer).png({ quality: 90 }).toBuffer();
                    filename = filename.replace(/\.tif{1,2}$/i, '.png');
                    contentType = 'image/png';
                    
                } else if (contentType === 'image/bmp' || filename.toLowerCase().endsWith('.bmp')) {
                    
                    console.log('[UPLOAD] Converting BMP to JPEG...');
                    buffer = await sharp(file.buffer).jpeg({ quality: 90 }).toBuffer();
                    filename = filename.replace(/\.bmp$/i, '.jpg');
                    contentType = 'image/jpeg';
                    
                } else if (contentType === 'image/webp' || filename.toLowerCase().endsWith('.webp')) {
                    
                    // WebP is web-compatible, but convert to JPEG for broader compatibility
                    console.log('[UPLOAD] Converting WebP to JPEG for compatibility...');
                    buffer = await sharp(file.buffer).jpeg({ quality: 90 }).toBuffer();
                    filename = filename.replace(/\.webp$/i, '.jpg');
                    contentType = 'image/jpeg';
                    
                } else if (isRawImageFormat(filename)) {
                    
                    console.log('[UPLOAD] Converting RAW image format to JPEG...');
                    buffer = await sharp(file.buffer).jpeg({ quality: 90 }).toBuffer();
                    filename = filename.replace(/\.(raw|cr2|nef|dng|orf|arw|rw2|pef|srw|x3f)$/i, '.jpg');
                    contentType = 'image/jpeg';
                    
                } else {
                    // For other image formats (JPEG, PNG, GIF), keep as-is but ensure they're optimized
                    console.log('[UPLOAD] Optimizing existing web-compatible image...');
                    if (contentType === 'image/jpeg' || filename.toLowerCase().endsWith('.jpg') || filename.toLowerCase().endsWith('.jpeg')) {
                        // Optimize JPEG
                        buffer = await sharp(file.buffer).jpeg({ quality: 85, progressive: true }).toBuffer();
                    } else if (contentType === 'image/png' || filename.toLowerCase().endsWith('.png')) {
                        // Optimize PNG
                        buffer = await sharp(file.buffer).png({ quality: 85, progressive: true }).toBuffer();
                    }
                    // Keep GIF and SVG as-is since they have special properties
                }
                
                console.log(`[UPLOAD] Image conversion successful: ${originalContentType} → ${contentType}`);
                
            } catch (conversionError) {
                console.error('[UPLOAD] Image conversion failed:', conversionError.message);
                console.log('[UPLOAD] Proceeding with original file...');
                // Continue with original file if conversion fails
            }
        }

        // Handle video files - keep original but note the type for thumbnails
        if (contentType.startsWith('video/')) {
            console.log(`[UPLOAD] Video file detected: ${filename}, type: ${contentType}`);
            // Videos are kept as-is, but we'll extract thumbnails
        }
        
        // Upload original file first
        const gcsPath = [folder, filename].filter(Boolean).join('/');
        const bucket = gcsStorage.bucket(gcsBucketName);
        const blob = bucket.file(gcsPath);
        
        console.log('[UPLOAD] Uploading original file to GCS...');
        await new Promise((resolve, reject) => {
            const blobStream = blob.createWriteStream({ resumable: false, contentType });
            blobStream.on('error', reject);
            blobStream.on('finish', resolve);
            blobStream.end(buffer);
        });
        
        const gcsUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
        console.log('[UPLOAD] Original file uploaded successfully:', gcsUrl);
        
        // Try to generate and upload thumbnail (don't fail if this doesn't work)
        let thumbnailUrl = null;
        try {
            console.log('[UPLOAD] Generating thumbnail...');
            // CRITICAL FIX: Use converted buffer and contentType, not original file data
            const thumbnailData = await generateThumbnail(buffer, filename, contentType);
            
            const thumbnailPath = [folder, 'thumbnails', thumbnailData.filename].filter(Boolean).join('/');
            const thumbnailBlob = bucket.file(thumbnailPath);
            
            console.log('[UPLOAD] Uploading thumbnail to GCS...');
            await new Promise((resolve, reject) => {
                const thumbnailStream = thumbnailBlob.createWriteStream({ 
                    resumable: false, 
                    contentType: thumbnailData.contentType 
                });
                thumbnailStream.on('error', reject);
                thumbnailStream.on('finish', resolve);
                thumbnailStream.end(thumbnailData.buffer);
            });
            
            thumbnailUrl = `https://storage.googleapis.com/${bucket.name}/${thumbnailBlob.name}`;
            console.log('[UPLOAD] Thumbnail uploaded successfully:', thumbnailUrl);
        } catch (thumbnailError) {
            console.warn('[UPLOAD] Thumbnail generation failed, continuing without thumbnail:', thumbnailError.message);
        }
        
        // Update assets.json with URLs
        if (folder) {
            try {
                console.log(`[UPLOAD] Attempting to update assets.json for folder: "${folder}"`);
                const assetsPath = path.join(DATA_DIR, 'assets.json');
                const assets = JSON.parse(await fs.promises.readFile(assetsPath, 'utf-8'));
                
                console.log(`[UPLOAD] Assets.json loaded, checking for children array...`);
                console.log(`[UPLOAD] Assets.children exists:`, !!assets.children);
                console.log(`[UPLOAD] Assets.children length:`, assets.children?.length || 0);
                
                if (assets.children) {
                    console.log(`[UPLOAD] Looking for folder "${folder}" in:`, assets.children.map(c => `"${c.name}" (type: ${c.type})`));
                }
                
                let targetFolder = null;
                if (assets.children) {
                    targetFolder = assets.children.find(c => c.type === 'folder' && c.name === folder);
                }
                
                console.log(`[UPLOAD] Target folder found:`, !!targetFolder);
                if (targetFolder) {
                    console.log(`[UPLOAD] Target folder name: "${targetFolder.name}", children count:`, targetFolder.children?.length || 0);
                }
                
                if (targetFolder) {
                    if (!targetFolder.children) {
                        targetFolder.children = [];
                        console.log(`[UPLOAD] Initialized children array for folder "${folder}"`);
                    }
                    
                    const imageEntry = {
                        type: file.mimetype.startsWith('video/') ? 'video' : 'image',
                        url: gcsUrl,
                        thumbnailUrl: thumbnailUrl, // Will be null if thumbnail failed
                        name: filename.replace(/\.[^/.]+$/, ''),
                        filename: filename,
                        originalFilename: file.originalname,
                        size: file.size,
                        mimeType: file.mimetype,
                        uploadedAt: new Date().toISOString()
                    };
                    
                    console.log(`[UPLOAD] Adding entry to folder:`, imageEntry);
                    targetFolder.children.push(imageEntry);
                    
                    console.log(`[UPLOAD] Folder now has ${targetFolder.children.length} children`);
                    console.log(`[UPLOAD] Saving assets.json...`);
                    await safeWriteJson(assetsPath, assets);
                    dataCache.invalidate('assets');
                    console.log(`[UPLOAD] Successfully saved to assets.json and invalidated cache`);
                    console.log(`[UPLOAD] Added ${imageEntry.type} to folder '${folder}':`, filename);
                } else {
                    console.warn(`[UPLOAD] ERROR: Folder '${folder}' not found in assets.json`);
                    console.warn(`[UPLOAD] Available folders:`, assets.children?.filter(c => c.type === 'folder').map(c => c.name) || []);
                }
            } catch (err) {
                console.error('[UPLOAD] Failed to update assets.json:', err);
                console.error('[UPLOAD] Error details:', err.stack);
            }
        } else {
            console.log('[UPLOAD] No folder specified, not updating assets.json');
        }
        
        res.json({ 
            url: gcsUrl, 
            thumbnailUrl: thumbnailUrl,
            type: file.mimetype.startsWith('video/') ? 'video' : 'image',
            filename: filename,
            size: file.size,
            success: true
        });
        
    } catch (error) {
        console.error('[UPLOAD] Error processing file:', error);
        res.status(500).json({ 
            error: 'Failed to process file', 
            details: error.message,
            filename: filename 
        });
    }
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

    // IMPORTANT:
    // The File objects returned by getFiles() do NOT always have metadata.contentType
    // populated unless we make an additional getMetadata() call, which would be
    // very expensive for large buckets. Instead, we infer asset type from the
    // filename extension, which is sufficient for our admin library.
    const assetFiles = files.filter((f) => {
      const name = (f.name || '').toLowerCase();
      return /\.(jpe?g|png|gif|webp|heic|heif|tiff?|bmp|svg|mov|mp4|m4v|webm)$/i.test(name);
    });

    const urls = assetFiles.map((f) => `https://storage.googleapis.com/${gcsBucketName}/${f.name}`);

    console.log(`Found ${urls.length} image/video assets by filename extension. Sending response.`);
    
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

// --- NEW ENDPOINT: List Audio Files ---
app.get('/api/list-audio', requireAuth('viewer'), async (req, res) => {
  try {
    console.log(`[AUDIO] Listing audio files from bucket: ${gcsBucketName}`);
    const bucket = gcsStorage.bucket(gcsBucketName);
    const [files] = await bucket.getFiles();

    // Filter for audio extensions only
    const audioFiles = files.filter((f) => {
      const name = (f.name || '').toLowerCase();
      return /\.(mp3|wav|m4a|aac|flac|ogg|aiff)$/i.test(name);
    });

    // Map to a clean format for the app
    const tracks = audioFiles.map((f) => ({
      name: f.name.split('/').pop(), // Get just the filename
      path: f.name, // The full path needed for the signing endpoint
      size: f.metadata.size,
      updated: f.metadata.updated
    }));

    res.json({ tracks });

  } catch (err) {
    console.error('[AUDIO] Error listing files:', err);
    res.status(500).json({ error: 'Failed to list audio', details: err.message });
  }
});

// --- NEW ENDPOINT: Generate Signed URL for Streaming ---
app.post('/api/generate-stream-link', requireAuth('viewer'), async (req, res) => {
  try {
    // The App sends: { "filePath": "artist-name/song-title.mp3" }
    // Note: The filePath should be the relative path inside the bucket, e.g. "my-folder/song.mp3"
    const { filePath } = req.body;

    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' });
    }

    console.log(`[STREAM] Generating signed URL for: ${filePath}`);

    // Define the configuration for the signed URL
    const options = {
      version: 'v4',
      action: 'read',
      expires: Date.now() + 60 * 60 * 1000, // Link expires in 1 hour
    };

    // Ask Google Cloud to sign the URL
    // We use the existing gcsStorage instance and bucket name
    const [url] = await gcsStorage
      .bucket(gcsBucketName)
      .file(filePath)
      .getSignedUrl(options);

    // Send the temporary "Key Card" back to the app
    res.json({ signedUrl: url });

  } catch (error) {
    console.error('[STREAM] Error generating signed URL:', error);
    res.status(500).json({ error: 'Failed to generate stream link', details: error.message });
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
        await safeWriteJson(jsonPath, covers);
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

// Enhanced thumbnail generation function with comprehensive format support
async function generateThumbnail(buffer, filename, contentType) {
  const isVideo = contentType.startsWith('video/');
  const isImage = contentType.startsWith('image/') || isImageByExtension(filename);
  
  console.log(`[THUMBNAIL] Generating thumbnail for: ${filename}, type: ${contentType}, isImage: ${isImage}`);
  
  try {
    if (isImage) {
      // Handle ALL image formats with Sharp - it supports a huge range
      console.log(`[THUMBNAIL] Processing image with Sharp...`);
      
      // Sharp can handle: JPEG, PNG, WebP, AVIF, TIFF, GIF, SVG, HEIC, and many others
      const thumbnailBuffer = await sharp(buffer)
        .resize(300, 300, { 
          fit: 'cover', 
          position: 'center',
          withoutEnlargement: false 
        })
        .jpeg({ quality: 85 })
        .toBuffer();
      
      console.log(`[THUMBNAIL] Image thumbnail generated successfully, size: ${thumbnailBuffer.length} bytes`);
      
      return {
        buffer: thumbnailBuffer,
        filename: filename.replace(/\.[^/.]+$/, '_thumb.jpg'),
        contentType: 'image/jpeg'
      };
    } else if (isVideo) {
      // For videos, try to extract an actual frame thumbnail
      console.log(`[THUMBNAIL] Attempting video frame extraction for: ${filename}`);
      
      try {
        const videoThumbnail = await extractVideoFrame(buffer, filename);
        return {
          buffer: videoThumbnail,
          filename: filename.replace(/\.[^/.]+$/, '_thumb.jpg'),
          contentType: 'image/jpeg'
        };
      } catch (videoError) {
        console.warn(`[THUMBNAIL] Video frame extraction failed, using dark placeholder:`, videoError.message);
        // Fallback to dark solid color for videos
        const darkThumbnail = await sharp({
          create: {
            width: 300,
            height: 300,
            channels: 3,
            background: { r: 40, g: 40, b: 40 }
          }
        })
        .jpeg({ quality: 85 })
        .toBuffer();
        
        return {
          buffer: darkThumbnail,
          filename: filename.replace(/\.[^/.]+$/, '_thumb.jpg'),
          contentType: 'image/jpeg'
        };
      }
    } else {
      // For other file types, create a simple colored thumbnail
      console.log(`[THUMBNAIL] Creating simple color thumbnail for: ${filename} (${contentType})`);
      
      const colorThumbnail = await sharp({
        create: {
          width: 300,
          height: 300,
          channels: 3,
          background: { r: 200, g: 200, b: 200 }
        }
      })
      .jpeg({ quality: 85 })
      .toBuffer();
      
      return {
        buffer: colorThumbnail,
        filename: filename.replace(/\.[^/.]+$/, '_thumb.jpg'),
        contentType: 'image/jpeg'
      };
    }
  } catch (error) {
    console.error(`[THUMBNAIL] Generation failed for ${filename}:`, error.message);
    
    // Ultra-simple fallback
    try {
      const fallbackBuffer = await sharp({
        create: {
          width: 300,
          height: 300,
          channels: 3,
          background: { r: 150, g: 150, b: 150 }
        }
      })
      .jpeg({ quality: 85 })
      .toBuffer();
      
      return {
        buffer: fallbackBuffer,
        filename: filename.replace(/\.[^/.]+$/, '_thumb.jpg'),
        contentType: 'image/jpeg'
      };
    } catch (fallbackError) {
      console.error(`[THUMBNAIL] Even fallback failed:`, fallbackError.message);
      throw fallbackError;
    }
  }
}

// Check if file is an image by extension (backup for when MIME type is wrong)
function isImageByExtension(filename) {
  const imageExtensions = [
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.tif',
    '.heic', '.heif', '.avif', '.svg', '.ico', '.raw', '.cr2', '.nef',
    '.dng', '.orf', '.arw', '.rw2', '.pef', '.srw', '.x3f'
  ];
  
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  return imageExtensions.includes(ext);
}

// Check if file is a RAW image format
function isRawImageFormat(filename) {
  const rawExtensions = [
    '.raw', '.cr2', '.nef', '.dng', '.orf', '.arw', '.rw2', 
    '.pef', '.srw', '.x3f', '.crw', '.dcr', '.mrw', '.raf', '.3fr'
  ];
  
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  return rawExtensions.includes(ext);
}

// Extract frame from video file for thumbnail
async function extractVideoFrame(buffer, filename) {
  return new Promise((resolve, reject) => {
    const tempVideoPath = `/tmp/${Date.now()}_${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const tempFramePath = `/tmp/${Date.now()}_frame.jpg`;
    
    try {
      // Write video buffer to temp file
      fs.writeFileSync(tempVideoPath, buffer);
      
      // Use FFmpeg to extract a single frame
      ffmpeg(tempVideoPath)
        .seekInput(1) // Seek to 1 second
        .frames(1) // Extract only 1 frame
        .output(tempFramePath)
        .size('300x300')
        .format('image2')
        .on('end', () => {
          try {
            // Read the extracted frame
            const frameBuffer = fs.readFileSync(tempFramePath);
            
            // Create a proper thumbnail from the frame
            sharp(frameBuffer)
              .resize(300, 300, { 
                fit: 'cover', 
                position: 'center' 
              })
              .jpeg({ quality: 85 })
              .toBuffer()
              .then(thumbnailBuffer => {
                // Cleanup temp files
                try { fs.unlinkSync(tempVideoPath); } catch {}
                try { fs.unlinkSync(tempFramePath); } catch {}
                
                console.log(`[THUMBNAIL] Video frame extracted successfully`);
                resolve(thumbnailBuffer);
              })
              .catch(reject);
          } catch (readError) {
            // Cleanup and reject
            try { fs.unlinkSync(tempVideoPath); } catch {}
            try { fs.unlinkSync(tempFramePath); } catch {}
            reject(readError);
          }
        })
        .on('error', (err) => {
          // Cleanup and reject
          try { fs.unlinkSync(tempVideoPath); } catch {}
          try { fs.unlinkSync(tempFramePath); } catch {}
          reject(err);
        })
        .run();
    } catch (err) {
      reject(err);
    }
  });
}


// Start Server
const port = process.env.PORT || 10000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  if (process.env.NODE_ENV === 'production') {
    console.log(`Admin interface available at: https://admin.allmyfriendsinc.com/`);
  } else {
    console.log(`Admin interface: http://localhost:${port}/admin/`);
  }
});
