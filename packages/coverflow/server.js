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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_DIR = path.join(__dirname, 'public');
const ADMIN_DIR = path.join(__dirname, 'admin');
const DATA_DIR = path.join(__dirname, 'data');
// Removed UPLOADS_DIR and all local upload logic

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy in production (for secure cookies behind reverse proxy)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow any subdomain of allmyfriendsinc.com in production
    if (process.env.NODE_ENV === 'production') {
      if (origin && origin.includes('allmyfriendsinc.com')) {
        return callback(null, true);
      }
    } else {
      // Allow all origins in development
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true // Allow cookies to be sent
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
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'lax',
    domain: process.env.NODE_ENV === 'production' ? '.allmyfriendsinc.com' : undefined
  }
}));

// Helper to check if user is authenticated
function isAuthenticated(req) {
  return req.session && req.session.user;
}

// Helper to check if this is admin subdomain
function isAdminSubdomain(req) {
  return req.hostname.startsWith('admin.');
}

// Authentication middleware - COMPLETELY REWRITTEN
const requireAuth = (requiredRole = 'viewer') => {
  return (req, res, next) => {
    if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
      req.session.user = req.session.user || { username: 'dev', role: 'admin' };
      return next();
    }

    if (!req.session.user) {
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      return res.redirect('/admin/login.html');
    }

    // Convert string to array for consistency
    const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    
    // Check if user has required role
    if (!allowedRoles.includes(req.session.user.role)) {
      // Admin can access everything
      if (req.session.user.role === 'admin') {
        return next();
      }
      
      // Editor can access viewer content
      if (req.session.user.role === 'editor' && allowedRoles.includes('viewer')) {
        return next();
      }
      
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      return res.status(403).send('Access denied');
    }

    next();
  };
};

// Simple in-memory cache for JSON data
class DataCache {
  constructor(ttl = 60000) { // 1 minute default TTL
    this.cache = new Map();
    this.ttl = ttl;
  }
  
  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }
  
  set(key, data) {
    this.cache.set(key, {
      data,
      expiry: Date.now() + this.ttl
    });
  }
  
  invalidate(key) {
    this.cache.delete(key);
  }
  
  clear() {
    this.cache.clear();
  }
}

// Initialize caches
const dataCache = new DataCache(60000); // 1 minute cache
const userCache = new DataCache(300000); // 5 minute cache for users

// Helper function to read JSON with caching
async function readJsonFile(filePath, cacheKey, cache = dataCache) {
  // Check cache first
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  
  // Read from file
  try {
    const data = await fs.promises.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(data);
    
    // Cache the result
    cache.set(cacheKey, parsed);
    
    return parsed;
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error);
    throw error;
  }
}

// User management functions with caching
async function loadUsers() {
  const usersPath = path.join(DATA_DIR, 'users.json');
  
  try {
    return await readJsonFile(usersPath, 'users', userCache);
  } catch {
    const defaultUsers = [{
      username: 'admin',
      hash: await bcrypt.hash(process.env.ADMIN_PASSWORD || 'password', 10),
      role: 'admin'
    }];
    await fs.promises.writeFile(usersPath, JSON.stringify(defaultUsers, null, 2));
    userCache.set('users', defaultUsers);
    return defaultUsers;
  }
}

async function saveUsers(users) {
  const usersPath = path.join(DATA_DIR, 'users.json');
  await fs.promises.writeFile(usersPath, JSON.stringify(users, null, 2));
  userCache.invalidate('users');
}

// Admin subdomain handler - MUST COME BEFORE PUBLIC STATIC FILES
app.use((req, res, next) => {
  if (isAdminSubdomain(req)) {
    console.log(`Admin subdomain request: ${req.method} ${req.path}`);
    
    // Allow API routes to pass through
    if (req.path.startsWith('/api/')) {
      return next();
    }
    
    // Allow data routes to pass through
    if (req.path.startsWith('/data/')) {
      return next();
    }
    
    // Allow upload routes to pass through
    if (req.path.startsWith('/upload')) {
      return next();
    }
    
    // Allow save/delete cover routes to pass through
    if (req.path === '/save-cover' || req.path === '/delete-cover' || req.path === '/save-covers') {
      return next();
    }
    
    // Allow assets routes to pass through
    if (req.path === '/save-assets') {
      return next();
    }
    
    // Allow artist tracks routes to pass through
    if (req.path.startsWith('/artist-tracks') || req.path === '/save-artist-tracks') {
      return next();
    }
    
    // Allow push-live route to pass through
    if (req.path === '/push-live') {
      return next();
    }
    
    // Handle root path
    if (req.path === '/' || req.path === '') {
      if (isAuthenticated(req)) {
        // User is logged in, show Swiss dashboard
        return res.sendFile(path.join(ADMIN_DIR, 'index-swiss.html'));
      } else {
        // User is not logged in, show login
        return res.sendFile(path.join(ADMIN_DIR, 'login.html'));
      }
    }
    
    // Handle login page explicitly
    if (req.path === '/login' || req.path === '/login.html') {
      return res.sendFile(path.join(ADMIN_DIR, 'login.html'));
    }
    
    // Handle other admin assets (css, js, etc)
    if (req.path.startsWith('/')) {
      const filePath = req.path.substring(1); // Remove leading slash
      const fullPath = path.join(ADMIN_DIR, filePath);
      
      // Check if file exists
      if (fs.existsSync(fullPath)) {
        // For HTML files, check auth (except login)
        if (fullPath.endsWith('.html') && !filePath.includes('login')) {
          if (!isAuthenticated(req)) {
            return res.redirect('/');
          }
        }
        return res.sendFile(fullPath);
      }
    }
    
    // If no file matched, but we're on admin subdomain, return 404
    return res.status(404).send('Not found');
  }
  next();
});

// Basic auth for hudson-deck.html - ADDED HERE BEFORE STATIC FILES
app.get('/hudson-deck.html', 
  basicAuth({
    users: { 'guest': 'MakeItTogether25!' },
    challenge: true,
    realm: 'Private Deck'
  }),
  (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'hudson-deck.html'));
  }
);

// Static files for PUBLIC site (no auth required) - MOVED AFTER ADMIN HANDLER
app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));

// Admin routes for main domain (with /admin prefix)
app.use('/admin', (req, res, next) => {
  // Always allow access to login page and its assets
  if (req.path === '/login.html' || 
      req.path === '/login.js' || 
      req.path === '/admin.css' ||
      req.path.includes('/login')) {
    return express.static(ADMIN_DIR)(req, res, next);
  }
  
  // Check auth for everything else
  if (!isAuthenticated(req)) {
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    return res.redirect('/admin/login.html');
  }
  
  // Serve static files
  express.static(ADMIN_DIR, { extensions: ['html'] })(req, res, next);
});

// Public access to covers.json
app.get('/data/covers.json', async (req, res) => {
  try {
    const covers = await readJsonFile(path.join(DATA_DIR, 'covers.json'), 'covers');
    res.json(covers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load covers' });
  }
});

// Public access to assets.json
app.get('/data/assets.json', async (req, res) => {
  try {
    const assets = await readJsonFile(path.join(DATA_DIR, 'assets.json'), 'assets');
    res.json(assets);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load assets' });
  }
});

// Public static serving for /data
app.use('/data', express.static(DATA_DIR, {
  setHeaders: res => res.setHeader('Cache-Control', 'no-store')
}));

// Set up multer for memory storage only (for GCS uploads)
const assetUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/') || file.mimetype.startsWith('audio/')) {
      return cb(null, true);
    }
    cb(new Error('Only image, video, or audio files are allowed'));
  }
});

const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/webm'];
    const allowedExtensions = ['.mp3', '.wav', '.m4a', '.webm', '.mpeg'];
    if (!allowedMimes.includes(file.mimetype)) {
      return cb(new Error('Only audio files are allowed'));
    }
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      return cb(new Error('Invalid audio file extension'));
    }
    cb(null, true);
  }
});

// Rate limiting for login endpoint
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many login attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Authentication endpoints
app.post('/api/login', loginLimiter, async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
      req.session.user = { username: 'dev', role: 'admin' };
      return res.json({ success: true, role: 'admin' });
    }

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
  if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true' && !req.session.user) {
    req.session.user = {
      username: 'dev',
      role: 'admin'
    };
  }
  
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  res.json({ user: req.session.user });
});

// User management endpoints
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
    
    // Validate input
    if (!username || !password || !role) {
      return res.status(400).json({ error: 'Username, password, and role are required' });
    }
    
    if (typeof username !== 'string' || username.length < 3 || username.length > 50) {
      return res.status(400).json({ error: 'Username must be between 3 and 50 characters' });
    }
    
    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    if (!['admin', 'editor', 'viewer'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    const users = await loadUsers();

    if (users.find(u => u.username === username)) {
      return res.status(400).json({ error: 'User already exists' });
    }

    users.push({
      username,
      hash: await bcrypt.hash(password, 10),
      role
    });

    await saveUsers(users);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create user' });
  }
});

app.delete('/api/users/:username', requireAuth('admin'), async (req, res) => {
  try {
    const users = await loadUsers();
    const filtered = users.filter(u => u.username !== req.params.username);

    if (filtered.length === users.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    await saveUsers(filtered);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Folder management endpoints
app.post('/api/folder', requireAuth('editor'), async (req, res) => {
  try {
    const { path: folderPath, name } = req.body;
    const assetsPath = path.join(DATA_DIR, 'assets.json');
    const assets = JSON.parse(await fs.promises.readFile(assetsPath, 'utf-8'));

    // Navigate to the target folder
    const pathParts = folderPath ? folderPath.split('/').filter(Boolean) : [];
    let current = assets;

    for (const part of pathParts) {
      if (!current.folders) current.folders = [];
      let folder = current.folders.find(f => f.name === part);
      if (!folder) {
        folder = { name: part, children: [] };
        current.folders.push(folder);
      }
      current = folder;
    }

    if (!current.children) current.children = [];

    // Check if folder already exists
    if (current.children.find(c => c.type === 'folder' && c.name === name)) {
      return res.status(400).json({ error: 'Folder already exists' });
    }

    current.children.push({ type: 'folder', name, children: [] });

    await fs.promises.writeFile(assetsPath, JSON.stringify(assets, null, 2));
    // Removed gitHubSync.add('packages/coverflow/data/assets.json', JSON.stringify(assets, null, 2), '📁 Create folder');

    res.json({ success: true });
  } catch (err) {
    console.error('Create folder error:', err);
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
      if (!parent.folders) parent.folders = [];
      parent = parent.folders.find(f => f.name === part);
      if (!parent) return res.status(404).json({ error: 'Parent folder not found' });
    }

    if (!parent.children) parent.children = [];
    parent.children = parent.children.filter(c => !(c.type === 'folder' && c.name === folderName));

    await fs.promises.writeFile(assetsPath, JSON.stringify(assets, null, 2));
    // Removed gitHubSync.add('packages/coverflow/data/assets.json', JSON.stringify(assets, null, 2), '🗑️ Delete folder');

    res.json({ success: true });
  } catch (err) {
    console.error('Delete folder error:', err);
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
      if (!parent.folders) parent.folders = [];
      parent = parent.folders.find(f => f.name === part);
      if (!parent) return res.status(404).json({ error: 'Parent folder not found' });
    }

    if (!parent.children) parent.children = [];
    const folder = parent.children.find(c => c.type === 'folder' && c.name === oldName);
    if (!folder) return res.status(404).json({ error: 'Folder not found' });

    folder.name = newName;

    await fs.promises.writeFile(assetsPath, JSON.stringify(assets, null, 2));
    // Removed gitHubSync.add('packages/coverflow/data/assets.json', JSON.stringify(assets, null, 2), '✏️ Rename folder');

    res.json({ success: true });
  } catch (err) {
    console.error('Rename folder error:', err);
    res.status(500).json({ error: 'Failed to rename folder' });
  }
});

// Unified asset upload endpoint (GCS, accept both 'file' and 'image')
app.post('/upload-image', requireAuth('editor'), assetUpload.any(), async (req, res) => {
  // Debug logging
  console.log('req.files:', req.files);
  console.log('req.body:', req.body);
  // Accept both 'file' and 'image' fields
  const file = req.files?.find(f => f.fieldname === 'file' || f.fieldname === 'image');
  if (!file) {
    console.error('[UPLOAD ERROR] No file provided');
    return res.status(400).json({ error: 'No file provided' });
  }
  const folder = req.body.folder || '';
  let subdir = '';
  if (file.mimetype.startsWith('video/')) subdir = 'video';
  else if (file.mimetype.startsWith('audio/')) subdir = 'audio';
  // Build GCS path
  const gcsPath = [subdir, folder, file.originalname].filter(Boolean).join('/');
  const storage = new Storage();
  const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);
  const blob = bucket.file(gcsPath);
  const blobStream = blob.createWriteStream({ resumable: false, contentType: file.mimetype });
  blobStream.on('error', err => {
    console.error('[UPLOAD ERROR] GCS:', err);
    res.status(500).json({ error: err.message });
  });
  blobStream.on('finish', () => {
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
    console.log('[UPLOAD] GCS publicUrl:', publicUrl);
    res.json({
      url: publicUrl,
      filename: file.originalname,
      folder: folder,
      type: file.mimetype.split('/')[0]
    });
  });
  blobStream.end(file.buffer);
});

// Audio upload (GCS only)
app.post('/upload-audio', requireAuth('editor'), audioUpload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No audio file provided' });
  const file = req.file;
  const folder = req.body.folder || '';
  const gcsPath = ['audio', folder, file.originalname].filter(Boolean).join('/');
  const storage = new Storage();
  const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);
  const blob = bucket.file(gcsPath);
  const blobStream = blob.createWriteStream({ resumable: false, contentType: file.mimetype });
  blobStream.on('error', err => {
    console.error('[UPLOAD ERROR] GCS:', err);
    res.status(500).json({ error: err.message });
  });
  blobStream.on('finish', () => {
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
    res.json({
      url: publicUrl,
      originalName: file.originalname
    });
  });
  blobStream.end(file.buffer);
});

// Cover management
app.post('/save-cover', requireAuth('editor'), async (req, res) => {
  try {
    const cover = req.body;
    if (!cover || !cover.id) {
      return res.status(400).json({ error: 'Invalid cover data', details: 'Missing ID' });
    }
    
    // Validate cover data
    if (typeof cover.id !== 'string' || cover.id.length === 0) {
      return res.status(400).json({ error: 'Cover ID must be a non-empty string' });
    }
    
    // Validate optional string fields
    const stringFields = ['albumTitle', 'category', 'frontImage', 'backImage', 'recordLabelImage'];
    for (const field of stringFields) {
      if (cover[field] !== undefined && typeof cover[field] !== 'string') {
        return res.status(400).json({ error: `${field} must be a string` });
      }
    }

    const jsonPath = path.join(DATA_DIR, 'covers.json');
    let covers = [];

    try {
      const data = await fs.promises.readFile(jsonPath, 'utf-8');
      covers = JSON.parse(data);
    } catch {
      console.warn('Creating new covers.json');
    }

    if (cover.artistDetails?.name && !cover.artistId) {
      cover.artistId = cover.artistDetails.name.toLowerCase().replace(/\s+/g, '-');
    }

    const idx = covers.findIndex(c => String(c.id) === String(cover.id));
    if (idx === -1) {
      covers.push(cover);
      
      // Auto-create artist folder if enabled
      if (cover.artistDetails?.name && req.body.createArtistFolder) {
        const assetsPath = path.join(DATA_DIR, 'assets.json');
        const assets = JSON.parse(await fs.promises.readFile(assetsPath, 'utf-8'));
        
        if (!assets.folders) assets.folders = [];
        
        // Check if folder already exists
        if (!assets.folders.find(f => f.name === cover.artistDetails.name)) {
          assets.folders.push({
            name: cover.artistDetails.name,
            type: 'folder',
            children: []
          });
          
          await fs.promises.writeFile(assetsPath, JSON.stringify(assets, null, 2));
          // Removed gitHubSync.add('packages/coverflow/data/assets.json', JSON.stringify(assets, null, 2), `📁 Create artist folder: ${cover.artistDetails.name}`);
        }
      }
    } else {
      covers[idx] = cover;
    }

    await fs.promises.writeFile(jsonPath, JSON.stringify(covers, null, 2));
    
    // Removed queue GitHub sync (non-blocking)
    // Removed gitHubSync.add(
    //   'packages/coverflow/data/covers.json', 
    //   JSON.stringify(covers, null, 2), 
    //   `Update cover: ${cover.albumTitle || 'Untitled'}`
    // );
    
    res.json({ success: true, githubSync: 'queued' });
  } catch (err) {
    console.error('Save error:', err);
    res.status(500).json({ error: 'Failed to save', details: err.message });
  }
});

app.post('/delete-cover', requireAuth('editor'), async (req, res) => {
  try {
    const { id } = req.body;
    const jsonPath = path.join(DATA_DIR, 'covers.json');
    const data = await fs.promises.readFile(jsonPath, 'utf-8');
    let covers = JSON.parse(data);
    
    covers = covers.filter(c => String(c.id) !== String(id));
    
    await fs.promises.writeFile(jsonPath, JSON.stringify(covers, null, 2));
    // Removed gitHubSync.add('packages/coverflow/data/covers.json', JSON.stringify(covers, null, 2), 'Delete cover');
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete', details: err.message });
  }
});

app.post('/save-covers', requireAuth('editor'), async (req, res) => {
  try {
    const covers = req.body;
    const jsonPath = path.join(DATA_DIR, 'covers.json');
    
    await fs.promises.writeFile(jsonPath, JSON.stringify(covers, null, 2));
    // Removed gitHubSync.add('packages/coverflow/data/covers.json', JSON.stringify(covers, null, 2), 'Update covers order');
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save', details: err.message });
  }
});

// Assets management
app.post('/save-assets', requireAuth('editor'), async (req, res) => {
  try {
    const assets = req.body;
    const jsonPath = path.join(DATA_DIR, 'assets.json');
    
    await fs.promises.writeFile(jsonPath, JSON.stringify(assets, null, 2));
    // Removed gitHubSync.add('packages/coverflow/data/assets.json', JSON.stringify(assets, null, 2), 'Update assets');
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save assets', details: err.message });
  }
});

// Artist tracks
app.get('/artist-tracks/:artistId', async (req, res) => {
  try {
    const tracksPath = path.join(DATA_DIR, 'artist-tracks.json');
    const data = await fs.promises.readFile(tracksPath, 'utf-8');
    const allTracks = JSON.parse(data);
    res.json(allTracks[req.params.artistId] || []);
  } catch {
    res.json([]);
  }
});

app.post('/save-artist-tracks', requireAuth('editor'), async (req, res) => {
  try {
    const { artistId, tracks } = req.body;
    const tracksPath = path.join(DATA_DIR, 'artist-tracks.json');
    
    let allTracks = {};
    try {
      const data = await fs.promises.readFile(tracksPath, 'utf-8');
      allTracks = JSON.parse(data);
    } catch {}
    
    allTracks[artistId] = tracks;
    
    await fs.promises.writeFile(tracksPath, JSON.stringify(allTracks, null, 2));
    // Removed gitHubSync.add('packages/coverflow/data/artist-tracks.json', JSON.stringify(allTracks, null, 2), 'Update artist tracks');
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save tracks' });
  }
});

// Push live
app.post('/push-live', requireAuth('admin'), async (req, res) => {
  try {
    await writeJsonToGitHub('packages/coverflow/data/covers.json', 
      await fs.promises.readFile(path.join(DATA_DIR, 'covers.json'), 'utf-8'), 
      'Push to production');
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to push live', details: err.message });
  }
});

// Static file caching middleware
app.use(express.static(PUBLIC_DIR, {
  maxAge: '1d',
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    } else if (path.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=2592000, immutable'); // 30 days
    } else if (path.match(/\.(css|js)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // 1 year
    } else if (path.match(/\.(woff|woff2|ttf|otf|eot)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // 1 year
    }
  }
}));

// Admin routes
app.get('/admin/', requireAuth(['admin', 'editor']), (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

// Swiss Modernism admin interface - serve directly
app.get('/admin/swiss', (req, res) => {
  // Check if user is authenticated
  if (!req.session.user) {
    return res.redirect('/admin/login.html');
  }
  
  // Check if user has permission
  if (!['admin', 'editor'].includes(req.session.user.role)) {
    return res.status(403).send('Access denied');
  }
  
  // Serve the Swiss admin interface
  res.sendFile(path.join(__dirname, 'admin', 'index-swiss.html'));
});

app.get('/admin/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'login.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Admin interface: http://localhost:${PORT}/admin/`);
  if (process.env.NODE_ENV === 'production') {
    console.log(`Admin subdomain: https://admin.allmyfriendsinc.com/`);
  }
});