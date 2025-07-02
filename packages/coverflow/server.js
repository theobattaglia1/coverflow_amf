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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_DIR = path.join(__dirname, 'public');
const ADMIN_DIR = path.join(__dirname, 'admin');
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, 'uploads');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Session configuration
const sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'lax'
  }
}));

// Authentication middleware - FIXED VERSION
const requireAuth = (requiredRole = 'viewer') => {
  return (req, res, next) => {
    // Skip auth for login-related paths
    if (req.path.includes('login') || 
        req.path === '/' && req.hostname.startsWith('admin.')) {
      return next();
    }
    
    // Development bypass
    if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
      req.session.user = {
        username: 'dev',
        role: 'admin'
      };
      return next();
    }

    if (!req.session.user) {
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      // Prevent redirect loop - check if already on login page
      if (req.path === '/admin/login.html' || req.path === '/login.html') {
        return next();
      }
      
      // For admin subdomain, redirect to root which will show login
      if (req.hostname.startsWith('admin.')) {
        return res.redirect('/');
      }
      
      // For main domain, redirect to admin login
      return res.redirect('/admin/login.html');
    }

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

// Admin subdomain rewrite - FIXED VERSION
app.use((req, res, next) => {
  // Check if this is the admin subdomain
  if (req.hostname.startsWith('admin.') && req.method === 'GET') {
    // Special handling for login page
    if (req.path === '/' || req.path === '') {
      req.url = '/admin/login.html';
    } else if (req.path === '/login' || req.path === '/login.html') {
      req.url = '/admin/login.html';
    } else if (!req.path.startsWith('/admin') &&
               !req.path.startsWith('/api/') &&
               !req.path.startsWith('/data/') &&
               !req.path.startsWith('/uploads/')) {
      // For all other paths, prepend /admin
      req.url = '/admin' + req.path;
    }
  }
  next();
});

// Static files (public access)
app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));
app.use('/uploads', express.static(UPLOADS_DIR, {
  setHeaders: res => res.setHeader('Cache-Control', 'no-store')
}));

// Make sure login page and its assets are publicly accessible (no auth required)
app.use('/admin/login.html', express.static(path.join(ADMIN_DIR, 'login.html')));
app.use('/admin/login.js', express.static(path.join(ADMIN_DIR, 'login.js')));
app.use('/admin/admin.css', express.static(path.join(ADMIN_DIR, 'admin.css')));

// Protected admin routes (require authentication) - FIXED VERSION
app.use('/admin', (req, res, next) => {
  // Skip auth for login page and its assets
  if (req.path === '/login.html' || 
      req.path === '/login.js' || 
      req.path === '/admin.css' ||
      req.path.includes('/login')) {
    return next();
  }
  // Apply auth to everything else
  return requireAuth('viewer')(req, res, next);
}, express.static(ADMIN_DIR, { extensions: ['html'] }));

// Public access to covers.json only
app.get('/data/covers.json', (req, res) => {
  res.sendFile(path.join(DATA_DIR, 'covers.json'));
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

app.get('/api/me', requireAuth(), (req, res) => {
  if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true' && !req.session.user) {
    req.session.user = {
      username: 'dev',
      role: 'admin'
    };
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
    } else {
      covers[idx] = cover;
    }

    await fs.promises.writeFile(jsonPath, JSON.stringify(covers, null, 2));
    await writeJsonToGitHub('packages/coverflow/data/covers.json', JSON.stringify(covers, null, 2), 'Update cover');

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
});