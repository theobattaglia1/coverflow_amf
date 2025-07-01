import ‘dotenv/config’;
import express from ‘express’;
import path from ‘path’;
import fs from ‘fs’;
import multer from ‘multer’;
import bcrypt from ‘bcrypt’;
import session from ‘express-session’;
import { Octokit } from ‘@octokit/rest’;
import { fileURLToPath } from ‘url’;
import crypto from ‘crypto’;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_DIR = path.join(__dirname, ‘public’);
const ADMIN_DIR = path.join(__dirname, ‘admin’);
const DATA_DIR = path.join(__dirname, ‘data’);
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, ‘uploads’);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Session configuration
const sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString(‘hex’);
app.use(session({
secret: sessionSecret,
resave: false,
saveUninitialized: false,
cookie: {
secure: false, // Allow cookies over HTTP in development
httpOnly: true,
maxAge: 24 * 60 * 60 * 1000, // 24 hours
sameSite: ‘lax’
}
}));

// Authentication middleware
const requireAuth = (requiredRole = ‘viewer’) => {
return (req, res, next) => {
// Development bypass
if (process.env.NODE_ENV === ‘development’ && process.env.BYPASS_AUTH === ‘true’) {
req.session.user = {
username: ‘dev’,
role: ‘admin’
};
return next();
}

```
if (!req.session.user) {
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  return res.redirect('/admin/login.html');
}

const roleHierarchy = { admin: 3, editor: 2, viewer: 1 };
if (roleHierarchy[req.session.user.role] < roleHierarchy[requiredRole]) {
  return res.status(403).json({ error: 'Insufficient permissions' });
}

next();
```

};
};

// User management functions
async function loadUsers() {
const usersPath = path.join(DATA_DIR, ‘users.json’);
try {
const data = await fs.promises.readFile(usersPath, ‘utf-8’);
return JSON.parse(data);
} catch {
// Initialize with default admin user
const defaultUsers = [{
username: ‘admin’,
hash: await bcrypt.hash(process.env.ADMIN_PASSWORD || ‘password’, 10),
role: ‘admin’
}];
await fs.promises.writeFile(usersPath, JSON.stringify(defaultUsers, null, 2));
return defaultUsers;
}
}

async function saveUsers(users) {
const usersPath = path.join(DATA_DIR, ‘users.json’);
await fs.promises.writeFile(usersPath, JSON.stringify(users, null, 2));
}

// Admin subdomain rewrite
app.use((req, res, next) => {
if (req.hostname.startsWith(‘admin.’) && req.method === ‘GET’) {
if (!req.path.startsWith(’/admin’) &&
!req.path.startsWith(’/api/’) &&
!req.path.startsWith(’/data/’) &&
!req.path.startsWith(’/uploads/’)) {
req.url = ‘/admin’ + (req.url === ‘/’ ? ‘/index.html’ : req.url);
}
}
next();
});

// Static files (public access)
app.use(express.static(PUBLIC_DIR, { extensions: [‘html’] }));
app.use(’/uploads’, express.static(UPLOADS_DIR, {
setHeaders: res => res.setHeader(‘Cache-Control’, ‘no-store’)
}));

// Protected admin routes
app.use(’/admin/login.html’, express.static(path.join(ADMIN_DIR, ‘login.html’)));
app.use(’/admin/login.js’, express.static(path.join(ADMIN_DIR, ‘login.js’)));
app.use(’/admin’, requireAuth(‘viewer’), express.static(ADMIN_DIR, { extensions: [‘html’] }));

// Public access to covers.json only
app.get(’/data/covers.json’, (req, res) => {
res.sendFile(path.join(DATA_DIR, ‘covers.json’));
});

// Protected access to other data files
app.use(’/data’, requireAuth(‘viewer’), express.static(DATA_DIR, {
setHeaders: res => res.setHeader(‘Cache-Control’, ‘no-store’)
}));

// GitHub integration
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const GH_OWNER = ‘theobattaglia1’;
const GH_REPO = ‘coverflow_amf’;

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

```
await octokit.repos.createOrUpdateFileContents({
  owner: GH_OWNER,
  repo: GH_REPO,
  path: filePath,
  message: commitMsg,
  content: Buffer.from(jsonString).toString('base64'),
  sha
});

return { success: true };
```

} catch (err) {
console.error(`GitHub push failed for ${filePath}:`, err.message);
throw err;
}
}

// Enhanced multer setup with folder support
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
destination: async (req, file, cb) => {
const folder = req.body.folder || ‘’;
const destPath = path.join(UPLOADS_DIR, folder);
await fs.promises.mkdir(destPath, { recursive: true });
cb(null, destPath);
},
filename: (req, file, cb) => {
const uniqueSuffix = Date.now() + ‘-’ + Math.round(Math.random() * 1e9);
const ext = path.extname(file.originalname);
cb(null, `upload-${uniqueSuffix}${ext}`);
}
});

const upload = multer({
storage,
limits: { fileSize: 10 * 1024 * 1024 },
fileFilter: (req, file, cb) =>
file.mimetype.startsWith(‘image/’)
? cb(null, true)
: cb(new Error(‘Only image files are allowed’))
});

// Audio upload configuration
const audioStorage = multer.diskStorage({
destination: async (req, file, cb) => {
const audioDir = path.join(UPLOADS_DIR, ‘audio’);
await fs.promises.mkdir(audioDir, { recursive: true });
cb(null, audioDir);
},
filename: (req, file, cb) => {
const uniqueSuffix = Date.now() + ‘-’ + Math.round(Math.random() * 1e9);
const ext = path.extname(file.originalname);
cb(null, `audio-${uniqueSuffix}${ext}`);
}
});

const audioUpload = multer({
storage: audioStorage,
limits: { fileSize: 50 * 1024 * 1024 },
fileFilter: (req, file, cb) => {
const allowedMimes = [‘audio/mpeg’, ‘audio/mp3’, ‘audio/wav’, ‘audio/m4a’, ‘audio/webm’];
if (allowedMimes.includes(file.mimetype)) {
cb(null, true);
} else {
cb(new Error(‘Only audio files are allowed’));
}
}
});

// Authentication endpoints
app.post(’/api/login’, async (req, res) => {
try {
// Development bypass - auto-login
if (process.env.NODE_ENV === ‘development’ && process.env.BYPASS_AUTH === ‘true’) {
req.session.user = { username: ‘dev’, role: ‘admin’ };
return res.json({ success: true, role: ‘admin’ });
}

```
const { username, password } = req.body;
const users = await loadUsers();
const user = users.find(u => u.username === username);

if (!user || !(await bcrypt.compare(password, user.hash))) {
  return res.status(401).json({ error: 'Invalid credentials' });
}

req.session.user = { username: user.username, role: user.role };
res.json({ success: true, role: user.role });
```

} catch (err) {
console.error(‘Login error:’, err);
res.status(500).json({ error: ‘Login failed’ });
}
});

app.post(’/api/logout’, (req, res) => {
req.session.destroy(err => {
if (err) return res.status(500).json({ error: ‘Logout failed’ });
res.json({ success: true });
});
});

app.get(’/api/me’, requireAuth(), (req, res) => {
// Development bypass - ensure session is set
if (process.env.NODE_ENV === ‘development’ && process.env.BYPASS_AUTH === ‘true’ && !req.session.user) {
req.session.user = {
username: ‘dev’,
role: ‘admin’
};
}
res.json({ user: req.session.user });
});

// User management endpoints
app.get(’/api/users’, requireAuth(‘admin’), async (req, res) => {
try {
const users = await loadUsers();
res.json(users.map(u => ({ username: u.username, role: u.role })));
} catch (err) {
res.status(500).json({ error: ‘Failed to load users’ });
}
});

app.post(’/api/users’, requireAuth(‘admin’), async (req, res) => {
try {
const { username, password, role } = req.body;
const users = await loadUsers();

```
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
```

} catch (err) {
res.status(500).json({ error: ‘Failed to create user’ });
}
});

app.delete(’/api/users/:username’, requireAuth(‘admin’), async (req, res) => {
try {
const users = await loadUsers();
const filtered = users.filter(u => u.username !== req.params.username);

```
if (filtered.length === users.length) {
  return res.status(404).json({ error: 'User not found' });
}

await saveUsers(filtered);
res.json({ success: true });
```

} catch (err) {
res.status(500).json({ error: ‘Failed to delete user’ });
}
});

// Folder management endpoints
app.post(’/api/folder’, requireAuth(‘editor’), async (req, res) => {
try {
const { path: folderPath, name } = req.body;
const assetsPath = path.join(DATA_DIR, ‘assets.json’);
const assets = JSON.parse(await fs.promises.readFile(assetsPath, ‘utf-8’));

```
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
```

} catch (err) {
console.error(‘Create folder error:’, err);
res.status(500).json({ error: ‘Failed to create folder’ });
}
});

app.delete(’/api/folder’, requireAuth(‘editor’), async (req, res) => {
try {
const { path: folderPath } = req.body;
const assetsPath = path.join(DATA_DIR, ‘assets.json’);
const assets = JSON.parse(await fs.promises.readFile(assetsPath, ‘utf-8’));

```
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
```

} catch (err) {
console.error(‘Delete folder error:’, err);
res.status(500).json({ error: ‘Failed to delete folder’ });
}
});

app.put(’/api/folder/rename’, requireAuth(‘editor’), async (req, res) => {
try {
const { path: folderPath, newName } = req.body;
const assetsPath = path.join(DATA_DIR, ‘assets.json’);
const assets = JSON.parse(await fs.promises.readFile(assetsPath, ‘utf-8’));

```
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
```

} catch (err) {
console.error(‘Rename folder error:’, err);
res.status(500).json({ error: ‘Failed to rename folder’ });
}
});

// Enhanced image upload with folder support
app.post(’/upload-image’, requireAuth(‘editor’), upload.single(‘image’), (req, res) => {
if (!req.file) return res.status(400).json({ error: ‘No image provided’ });
const folder = req.body.folder || ‘’;
const relativePath = path.join(folder, req.file.filename);
res.json({
url: `/uploads/${relativePath.replace(/\\/g, '/')}`,
filename: req.file.filename,
folder: folder
});
});

// Cover management endpoints
app.post(’/save-cover’, requireAuth(‘editor’), async (req, res) => {
try {
const cover = req.body;
if (!cover || !cover.id) {
return res.status(400).json({ error: ‘Invalid cover data’, details: ‘Missing ID’ });
}

```
const jsonPath = path.join(DATA_DIR, 'covers.json');
let covers = [];

try {
  const data = await fs.promises.readFile(jsonPath, 'utf-8');
  covers = JSON.parse(data);
} catch {
  console.warn('Creating new covers.json');
}

// Generate artistId if new artist
if (cover.artistDetails?.name && !cover.artistId) {
  cover.artistId = cover.artistDetails.name.toLowerCase().replace(/\s+/g, '-');
}

const idx = covers.findIndex(c => String(c.id) === String(cover.id));
if (idx === -1) {
  covers.push(cover);
  
  // Auto-create artist folder if enabled
  if (cover.artistDetails?.name && req.body.createArtistFolder) {
    const assetsPath = path.join(DATA_DIR, 'assets.json');
    const assets = JSON.
```