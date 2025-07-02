import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import bcrypt from 'bcrypt';
import session from 'express-session';
import { Octokit } from '@octokit/rest';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_DIR = path.join(__dirname, 'public');
const ADMIN_DIR = path.join(__dirname, 'admin');
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, 'uploads');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow any subdomain of allmyfriendsinc.com in production
    if (process.env.NODE_ENV === 'production') {
      if (origin.includes('allmyfriendsinc.com')) {
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
    // Development bypass
    if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
      req.session.user = {
        username: 'dev',
        role: 'admin'
      };
      return next();
    }

    // Check if user is authenticated
    if (!req.session.user) {
      // For API calls, return 401
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      // For admin subdomain, show login page
      if (isAdminSubdomain(req)) {
        // Already on login page? Let it through
        if (req.path === '/' || req.path === '/login.html' || req.path.includes('/login')) {
          return next();
        }
        // Redirect to subdomain root (which will show login)
        return res.redirect('/');
      }
      
      // For main domain, redirect to admin login
      return res.redirect('/admin/login.html');
    }

    // User is authenticated, check role
    const roleHierarchy = { admin: 3, editor: 2, viewer: 1 };
    if (roleHierarchy[req.session.user.role] < roleHierarchy[requiredRole]) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

// User management functions
async function loadUsers() {
  const usersPath = path.join(DATA_DIR, 'users.json');
  try {
    const data = await fs.promises.readFile(usersPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    const defaultUsers = [{
      username: 'admin',
      hash: await bcrypt.hash(process.env.ADMIN_PASSWORD || 'password', 10),
      role: 'admin'
    }];
    await fs.promises.writeFile(usersPath, JSON.stringify(defaultUsers, null, 2));
    return defaultUsers;
  }
}

async function saveUsers(users) {
  const usersPath = path.join(DATA_DIR, 'users.json');
  await fs.promises.writeFile(usersPath, JSON.stringify(users, null, 2));
}

// Admin subdomain handler - MUST COME BEFORE PUBLIC STATIC FILES
app.use((req, res, next) => {
  if (isAdminSubdomain(req)) {
    console.log(`Admin subdomain request: ${req.method} ${req.path}`);
    
    // Allow API requests to pass through
    if (req.path.startsWith('/api/') || 
        req.path.startsWith('/data/') || 
        req.path.startsWith('/upload-') ||
        req.path.startsWith('/save-') ||
        req.path.startsWith('/delete-') ||
        req.path.startsWith('/artist-tracks/') ||
        req.path.startsWith('/uploads/')) {
      return next();
    }
    
    // Handle root path
    if (req.path === '/' || req.path === '') {
      if (isAuthenticated(req)) {
        // User is logged in, show dashboard
        return res.sendFile(path.join(ADMIN_DIR, 'index.html'));
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

// Static files for PUBLIC site (no auth required) - MOVED AFTER ADMIN HANDLER
app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));
app.use('/uploads', express.static(UPLOADS_DIR, {
  setHeaders: res => res.setHeader('Cache-Control', 'no-store')
}));

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

// Public access to covers.json and styles.json only
app.get('/data/covers.json', (req, res) => {
  res.sendFile(path.join(DATA_DIR, 'covers.json'));
});

app.get('/data/styles.json', (req, res) => {
  res.sendFile(path.join(DATA_DIR, 'styles.json'));
});

// Protected access to other data files
app.use('/data', requireAuth('viewer'), express.static(DATA_DIR, {
  setHeaders: res => res.setHeader('Cache-Control', 'no-store')
}));

// GitHub integration
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const GH_OWNER = 'theobattaglia1';
const GH_REPO = 'coverflow_amf';

async function writeJsonToGitHub(filePath, jsonString, commitMsg) {
  try {
    let sha;
    try {
      const { data } = await octokit.repos.getContent({
        owner: GH_OWNER,
        repo: GH_REPO,
        path: filePath
      });
      sha = data.sha;
    } catch (err) {
      if (err.status !== 404) throw err;
    }

    await octokit.repos.createOrUpdateFileContents({
      owner: GH_OWNER,
      repo: GH_REPO,
      path: filePath,
      message: commitMsg,
      content: Buffer.from(jsonString).toString('base64'),
      sha
    });

    return { success: true };
  } catch (err) {
    console.error(`GitHub push failed for ${filePath}:`, err.message);
    throw err;
  }
}

// Enhanced multer setup with folder support
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const folder = req.body.folder || '';
    const destPath = path.join(UPLOADS_DIR, folder);
    await fs.promises.mkdir(destPath, { recursive: true });
    cb(null, destPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `upload-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    file.mimetype.startsWith('image/')
      ? cb(null, true)
      : cb(new Error('Only image files are allowed'))
});

// Audio upload configuration
const audioStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const audioDir = path.join(UPLOADS_DIR, 'audio');
    await fs.promises.mkdir(audioDir, { recursive: true });
    cb(null, audioDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `audio-${uniqueSuffix}${ext}`);
  }
});

const audioUpload = multer({
  storage: audioStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/webm'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'));
    }
  }
});

// Authentication endpoints
app.post('/api/login', async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
      req.session.user = { username: 'dev', role: 'admin' };
      return res.json({ success: true, role: 'admin' });
    }

    const { username, password } = req.body;
    console.log(`Login attempt for user: ${username}`);
    
    const users = await loadUsers();
    const user = users.find(u => u.username === username);

    if (!user) {
      console.log(`User not found: ${username}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const passwordMatch = await bcrypt.compare(password, user.hash);
    if (!passwordMatch) {
      console.log(`Invalid password for user: ${username}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    req.session.user = { username: user.username, role: user.role };
    console.log(`Login successful for user: ${username}, role: ${user.role}`);
    console.log(`Session created:`, req.session.user);
    
    // Explicitly save session
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({ error: 'Session save failed' });
      }
      res.json({ success: true, role: user.role });
    });
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
    await writeJsonToGitHub('packages/coverflow/data/assets.json', JSON.stringify(assets, null, 2), '📁 Create folder');

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
    await writeJsonToGitHub('packages/coverflow/data/assets.json', JSON.stringify(assets, null, 2), '🗑️ Delete folder');

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
    await writeJsonToGitHub('packages/coverflow/data/assets.json', JSON.stringify(assets, null, 2), '✏️ Rename folder');

    res.json({ success: true });
  } catch (err) {
    console.error('Rename folder error:', err);
    res.status(500).json({ error: 'Failed to rename folder' });
  }
});

// Image upload
app.post('/upload-image', requireAuth('editor'), upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image provided' });
  const folder = req.body.folder || '';
  const relativePath = path.join(folder, req.file.filename);
  res.json({
    url: `/uploads/${relativePath.replace(/\\/g, '/')}`,
    filename: req.file.filename,
    folder: folder
  });
});

// Audio upload
app.post('/upload-audio', requireAuth('editor'), audioUpload.single('audio'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No audio file provided' });
  res.json({
    url: `/uploads/audio/${req.file.filename}`,
    originalName: req.file.originalname
  });
});

// Cover management
app.post('/save-cover', requireAuth('editor'), async (req, res) => {
  try {
    const cover = req.body;
    if (!cover || !cover.id) {
      return res.status(400).json({ error: 'Invalid cover data', details: 'Missing ID' });
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
          await writeJsonToGitHub('packages/coverflow/data/assets.json', JSON.stringify(assets, null, 2), `📁 Create artist folder: ${cover.artistDetails.name}`);
        }
      }
    } else {
      covers[idx] = cover;
    }

    await fs.promises.writeFile(jsonPath, JSON.stringify(covers, null, 2));
    await writeJsonToGitHub('packages/coverflow/data/covers.json', JSON.stringify(covers, null, 2), `Update cover: ${cover.albumTitle || 'Untitled'}`);

    res.json({ success: true });
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
    await writeJsonToGitHub('packages/coverflow/data/covers.json', JSON.stringify(covers, null, 2), 'Delete cover');
    
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
    await writeJsonToGitHub('packages/coverflow/data/covers.json', JSON.stringify(covers, null, 2), 'Update covers order');
    
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
    await writeJsonToGitHub('packages/coverflow/data/assets.json', JSON.stringify(assets, null, 2), 'Update assets');
    
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
    await writeJsonToGitHub('packages/coverflow/data/artist-tracks.json', JSON.stringify(allTracks, null, 2), 'Update artist tracks');
    
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

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Admin interface: http://localhost:${PORT}/admin/`);
  if (process.env.NODE_ENV === 'production') {
    console.log(`Admin subdomain: https://admin.allmyfriendsinc.com/`);
  }
});