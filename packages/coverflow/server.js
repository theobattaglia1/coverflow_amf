/* packages/coverflow/server.js
   --------------------------------------------------
   Production build — investor sub-domain added
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
const __filename  = fileURLToPath(import.meta.url);
const __dirname   = path.dirname(__filename);

const PUBLIC_DIR   = path.join(__dirname, 'public');
const ADMIN_DIR    = path.join(__dirname, 'admin');
const DATA_DIR     = path.join(__dirname, 'data');
const INVESTORS_DIR = PUBLIC_DIR;                               // file lives in /public
const UPLOADS_DIR  = process.env.UPLOADS_DIR || path.join(__dirname, 'uploads');

/* -------------------------------------------------- */
/* 2 ▶ basic Express setup                            */
/* -------------------------------------------------- */
const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

/* -------------------------------------------------- */
/* 2.1 ▶ admin sub-domain rewrite                     */
/* -------------------------------------------------- */
app.use((req, res, next) => {
  if (req.hostname.startsWith('admin.') && req.method === 'GET') {
    if (
      !req.path.startsWith('/admin') &&
      !req.path.startsWith('/data/') &&
      !req.path.startsWith('/uploads/') &&
      !req.path.startsWith('/save-') &&
      !req.path.startsWith('/delete-') &&
      !req.path.startsWith('/upload-') &&
      !req.path.startsWith('/push-') &&
      !req.path.startsWith('/artist-tracks/')
    ) {
      req.url = '/admin' + (req.url === '/' ? '/index.html' : req.url);
    }
  }
  next();
});

/* -------------------------------------------------- */
/* 2.2 ▶ investors sub-domain auth + rewrite          */
/* -------------------------------------------------- */
app.use((req, res, next) => {
  const isInvestorsSub = req.hostname.startsWith('investors.');
  if (isInvestorsSub) {
    if (req.url === '/' || req.url === '') req.url = '/index.html';

    return basicAuth({
      challenge : true,
      realm     : 'AMF-Investors',
      authorizer: (_u, pwd) => pwd === process.env.INVESTOR_PASS
    })(req, res, next);
  }
  next();
});

/* -------------------------------------------------- */
/* 2.3 ▶ static assets                                */
/* -------------------------------------------------- */
app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));

app.use(
  '/admin',
  basicAuth({
    users    : { admin: process.env.ADMIN_PASSWORD || 'password' },
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
  '/uploads/audio',
  (req, res, next) => {
    const isInvestorsSub = req.hostname.startsWith('investors.');
    const isAdminSub = req.hostname.startsWith('admin.');
    
    if (!isInvestorsSub && !isAdminSub) {
      return res.status(403).send('Access denied');
    }
    next();
  }
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
        repo : GH_REPO,
        path : GH_JSON_PATH
      });
      sha = data.sha;
    } catch (err) {
      if (err.status !== 404) throw err;
    }

    await octokit.repos.createOrUpdateFileContents({
      owner  : GH_OWNER,
      repo   : GH_REPO,
      path   : GH_JSON_PATH,
      message: commitMsg,
      content: Buffer.from(jsonString).toString('base64'),
      sha
    });

    console.log('✅ pushed covers.json to GitHub');
  } catch (err) {
    console.error('❌ GitHub push failed:', err);
  }
}

/* Add this function to sync artist tracks to GitHub */
async function writeArtistTracksToGitHub(jsonString) {
  try {
    let sha;
    try {
      const { data } = await octokit.repos.getContent({
        owner: GH_OWNER,
        repo: GH_REPO,
        path: 'data/artist-tracks.json'
      });
      sha = data.sha;
    } catch (err) {
      if (err.status !== 404) throw err;
    }

    await octokit.repos.createOrUpdateFileContents({
      owner: GH_OWNER,
      repo: GH_REPO,
      path: 'data/artist-tracks.json',
      message: '🎵 Update artist tracks',
      content: Buffer.from(jsonString).toString('base64'),
      sha
    });

    console.log('✅ pushed artist-tracks.json to GitHub');
  } catch (err) {
    console.error('❌ GitHub artist tracks push failed:', err);
  }
}

/* -------------------------------------------------- */
/* 4 ▶ Multer setup                                   */
/* -------------------------------------------------- */
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename   : (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `upload-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits    : { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    file.mimetype.startsWith('image/')
      ? cb(null, true)
      : cb(new Error('Only image files are allowed'))
});

/* -------------------------------------------------- */
/* 4.1 ▶ Audio Upload Configuration                   */
/* -------------------------------------------------- */
const audioStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const audioDir = path.join(UPLOADS_DIR, 'audio');
    fs.mkdirSync(audioDir, { recursive: true });
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
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit for audio
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'));
    }
  }
});

/* -------------------------------------------------- */
/* 5 ▶ REST API routes                                */
/* -------------------------------------------------- */

/* save / update one cover */
app.post('/save-cover', async (req, res) => {
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

    const idx = covers.findIndex(c => String(c.id) === String(cover.id));
    if (idx === -1) covers.push(cover);
    else covers[idx] = cover;

    await fs.promises.writeFile(jsonPath, JSON.stringify(covers, null, 2));
    writeJsonToGitHub(JSON.stringify(covers, null, 2), `🔄 cover ${cover.id} via admin panel`);
    res.json({ success: true, id: cover.id });
  } catch (err) {
    console.error('Save cover error:', err);
    res.status(500).json({ error: 'Failed to save cover', details: err.message });
  }
});

/* bulk save / reorder covers */
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
    if (!id) return res.status(400).json({ error: 'Missing id' });

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
  if (!req.file) return res.status(400).json({ error: 'No image provided' });
  res.json({ url: `/uploads/${req.file.filename}`, filename: req.file.filename });
});

/* audio upload */
app.post('/upload-audio', audioUpload.single('audio'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No audio file provided' });
  res.json({ 
    url: `/uploads/audio/${req.file.filename}`, 
    filename: req.file.filename,
    originalName: req.file.originalname 
  });
});

/* save artist tracks - UPDATED to sync to GitHub */
app.post('/save-artist-tracks', async (req, res) => {
  try {
    const { artistId, tracks } = req.body;
    if (!artistId) return res.status(400).json({ error: 'Missing artistId' });

    const jsonPath = path.join(DATA_DIR, 'artist-tracks.json');
    let allTracks = {};

    try {
      const data = await fs.promises.readFile(jsonPath, 'utf-8');
      allTracks = JSON.parse(data);
    } catch {
      console.log('Creating new artist-tracks.json');
    }

    allTracks[artistId] = tracks;
    await fs.promises.writeFile(jsonPath, JSON.stringify(allTracks, null, 2));
    
    // Sync to GitHub
    await writeArtistTracksToGitHub(JSON.stringify(allTracks, null, 2));
    
    res.json({ success: true });
  } catch (err) {
    console.error('Save artist tracks error:', err);
    res.status(500).json({ error: 'Failed to save tracks', details: err.message });
  }
});

/* get artist tracks */
app.get('/artist-tracks/:artistId', async (req, res) => {
  try {
    const jsonPath = path.join(DATA_DIR, 'artist-tracks.json');
    const data = await fs.promises.readFile(jsonPath, 'utf-8');
    const allTracks = JSON.parse(data);
    res.json(allTracks[req.params.artistId] || []);
  } catch {
    res.json([]);
  }
});

/* push live placeholder */
app.post('/push-live', async (req, res) => {
  try {
    const jsonPath = path.join(DATA_DIR, 'covers.json');
    const data = await fs.promises.readFile(jsonPath, 'utf-8');
    await writeJsonToGitHub(data, '🚀 Push to production');
    res.json({ success: true, message: 'Changes pushed to GitHub' });
  } catch (err) {
    console.error('Push live error:', err);
    res.status(500).json({ error: 'Failed to push live', details: err.message });
  }
});

/* save assets */
app.post('/save-assets', async (req, res) => {
  try {
    const assets = req.body;
    const jsonPath = path.join(DATA_DIR, 'assets.json');
    await fs.promises.writeFile(jsonPath, JSON.stringify(assets, null, 2));
    res.json({ success: true });
  } catch (err) {
    console.error('Save assets error:', err);
    res.status(500).json({ error: 'Failed to save assets', details: err.message });
  }
});

/* -------------------------------------------------- */
/* 5.5 ▶ global error handler                         */
/* -------------------------------------------------- */
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error  : 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

/* -------------------------------------------------- */
/* 6 ▶ start server                                   */
/* -------------------------------------------------- */
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📁 Uploads directory: ${UPLOADS_DIR}`);
  console.log(`🔐 Admin at: http://admin.localhost:${PORT}`);
});

/* graceful shutdown */
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server…');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
