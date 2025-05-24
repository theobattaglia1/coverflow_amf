/* packages/coverflow/server.js
   FIXED VERSION — Immediate repairs for drag & drop
   -------------------------------------------------- */

import express           from 'express';
import path              from 'path';
import fs                from 'fs';
import multer            from 'multer';
import basicAuth         from 'express-basic-auth';
import { Octokit }       from '@octokit/rest';
import { fileURLToPath } from 'url';

/* -------------------------------------------------- */
/* 1 ▶ absolute paths & constants                     */
/* -------------------------------------------------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const PUBLIC_DIR  = path.join(__dirname, 'public');
const ADMIN_DIR   = path.join(__dirname, 'admin');
const DATA_DIR    = path.join(__dirname, 'data');

/* persistent Render Disk lives here */
const UPLOADS_DIR  = process.env.UPLOADS_DIR || path.join(__dirname, 'uploads');

/* -------------------------------------------------- */
/* 2 ▶ basic Express setup                            */
/* -------------------------------------------------- */
const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

/* FIX: Better admin routing */
app.use((req, res, next) => {
  // Only rewrite for admin subdomain on GET requests
if (req.hostname.startsWith('admin.') && req.method === 'GET') {
  // Don't rewrite API routes, paths that already have /admin, or data/uploads files
  if (!req.path.startsWith('/admin') &&
      !req.path.startsWith('/data/') &&     // Add this line
      !req.path.startsWith('/uploads/') &&  // Add this line
      !req.path.startsWith('/save-') && 
      !req.path.startsWith('/delete-') && 
      !req.path.startsWith('/upload-') &&
      !req.path.startsWith('/push-')) {
    req.url = '/admin' + (req.url === '/' ? '/index.html' : req.url);
  }
}
  next();
});

/* static assets */
app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));
app.use(
  '/admin',
  basicAuth({ 
    users: { admin: process.env.ADMIN_PASSWORD || 'password' }, 
    challenge: true 
  }),
  express.static(ADMIN_DIR, { extensions: ['html'] })
);
app.use(
  '/data',
  express.static(DATA_DIR, {
    setHeaders: res => res.setHeader('Cache-Control', 'no-store')
  })
);
app.use(
  '/uploads',
  express.static(UPLOADS_DIR, {
    setHeaders: res => res.setHeader('Cache-Control', 'no-store')
  })
);

/* -------------------------------------------------- */
/* 3 ▶ GitHub helper                                  */
/* -------------------------------------------------- */
const octokit      = new Octokit({ auth: process.env.GITHUB_TOKEN });
const GH_OWNER     = 'theobattaglia1';
const GH_REPO      = 'coverflow_amf';
const GH_JSON_PATH = 'data/covers.json';

async function writeJsonToGitHub(jsonString, commitMsg) {
  try {
    let sha;
    try {
      const { data } = await octokit.repos.getContent({
        owner: GH_OWNER,
        repo:  GH_REPO,
        path:  GH_JSON_PATH
      });
      sha = data.sha;
    } catch (err) {
      if (err.status !== 404) throw err;
    }

    await octokit.repos.createOrUpdateFileContents({
      owner:   GH_OWNER,
      repo:    GH_REPO,
      path:    GH_JSON_PATH,
      message: commitMsg,
      content: Buffer.from(jsonString).toString('base64'),
      sha
    });

    console.log('✅ pushed covers.json to GitHub');
  } catch (err) {
    console.error('❌ GitHub push failed:', err);
    // Don't fail the request if GitHub is down
  }
}

/* -------------------------------------------------- */
/* 4 ▶ Multer setup - FIXED                           */
/* -------------------------------------------------- */
// Ensure uploads directory exists
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `upload-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // Only allow images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

/* -------------------------------------------------- */
/* 5 ▶ REST API routes with better error handling     */
/* -------------------------------------------------- */

/* save/update one cover */
app.post('/save-cover', async (req, res) => {
  try {
    const cover = req.body;
    
    // Basic validation
    if (!cover || !cover.id) {
      return res.status(400).json({ error: 'Invalid cover data', details: 'Missing ID' });
    }

    const jsonPath = path.join(DATA_DIR, 'covers.json');
    let covers = [];
    
    try {
      const data = await fs.promises.readFile(jsonPath, 'utf-8');
      covers = JSON.parse(data);
    } catch (err) {
      console.warn('Creating new covers.json');
    }

    const idx = covers.findIndex(c => String(c.id) === String(cover.id));
    if (idx === -1) {
      covers.push(cover);
    } else {
      covers[idx] = cover;
    }

    await fs.promises.writeFile(jsonPath, JSON.stringify(covers, null, 2));
    
    // Async GitHub push - don't block response
    writeJsonToGitHub(JSON.stringify(covers, null, 2), 
                      `🔄 cover ${cover.id} via admin panel`);

    res.json({ success: true, id: cover.id });
  } catch (err) {
    console.error('Save cover error:', err);
    res.status(500).json({ 
      error: 'Failed to save cover', 
      details: err.message 
    });
  }
});

/* bulk save/reorder */
app.post('/save-covers', async (req, res) => {
  try {
    if (!Array.isArray(req.body)) {
      return res.status(400).json({ error: 'Invalid format - expected array' });
    }

    const jsonPath = path.join(DATA_DIR, 'covers.json');
    await fs.promises.writeFile(jsonPath, JSON.stringify(req.body, null, 2));
    
    writeJsonToGitHub(JSON.stringify(req.body, null, 2), '🔄 bulk covers update');

    res.json({ success: true });
  } catch (err) {
    console.error('Save covers error:', err);
    res.status(500).json({ error: 'Failed to save covers', details: err.message });
  }
});

/* delete cover */
app.post('/delete-cover', async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ error: 'Missing id' });
    }

    const jsonPath = path.join(DATA_DIR, 'covers.json');
    const data = await fs.promises.readFile(jsonPath, 'utf-8');
    const covers = JSON.parse(data).filter(c => String(c.id) !== String(id));

    await fs.promises.writeFile(jsonPath, JSON.stringify(covers, null, 2));
    
    writeJsonToGitHub(JSON.stringify(covers, null, 2), `🗑️ delete cover ${id}`);

    res.json({ success: true });
  } catch (err) {
    console.error('Delete cover error:', err);
    res.status(500).json({ error: 'Failed to delete cover', details: err.message });
  }
});

/* image upload */
app.post('/upload-image', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image provided' });
  }
  
  // Return full URL for consistency
  const url = `/uploads/${req.file.filename}`;
  res.json({ url, filename: req.file.filename });
});

/* push live endpoint (placeholder for now) */
app.post('/push-live', async (req, res) => {
  try {
    // In the future, this could trigger a production deploy
    // For now, just ensure GitHub is synced
    const jsonPath = path.join(DATA_DIR, 'covers.json');
    const data = await fs.promises.readFile(jsonPath, 'utf-8');
    
    await writeJsonToGitHub(data, '🚀 Push to production');
    
    res.json({ success: true, message: 'Changes pushed to GitHub' });
  } catch (err) {
    console.error('Push live error:', err);
    res.status(500).json({ error: 'Failed to push live', details: err.message });
  }
});

/* Error handling middleware */
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error', 
    details: process.env.NODE_ENV === 'development' ? err.message : undefined 
  });
});

/* -------------------------------------------------- */
/* 6 ▶ start server with graceful shutdown            */
/* -------------------------------------------------- */
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📁 Uploads directory: ${UPLOADS_DIR}`);
  console.log(`🔐 Admin at: http://admin.localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
