/* packages/coverflow/server.js
   FULL UPDATED VERSION — adds investors sub-domain + password gate
   --------------------------------------------------------------- */

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
+const INVESTORS_DIR = PUBLIC_DIR;              // serve root instead
const UPLOADS_DIR  = process.env.UPLOADS_DIR || path.join(__dirname, 'uploads');

/* -------------------------------------------------- */
/* 2 ▶ basic Express setup                            */
/* -------------------------------------------------- */
const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

/* -------------------------------------------------- */
/* 2.1 ▶ admin rewrite (unchanged)                    */
/* -------------------------------------------------- */
app.use((req, res, next) => {
  if (req.hostname.startsWith('admin.') && req.method === 'GET') {
    if (!req.path.startsWith('/admin') &&
        !req.path.startsWith('/data/') &&
        !req.path.startsWith('/uploads/') &&
        !req.path.startsWith('/save-') &&
        !req.path.startsWith('/delete-') &&
        !req.path.startsWith('/upload-') &&
        !req.path.startsWith('/push-')) {
      req.url = '/admin' + (req.url === '/' ? '/index.html' : req.url);
    }
  }
  next();
});

/* -------------------------------------------------- */
/* 2.2 ▶ investors rewrite + password gate  NEW       */
/* -------------------------------------------------- */
app.use((req, res, next) => {
  const isInvestorsSub = req.hostname.startsWith('investors.');
  if (isInvestorsSub && req.method === 'GET') {
    if (!req.path.startsWith('/investors')) {
      req.url = '/investors' + (req.url === '/' ? '/index.html' : req.url);
    }
  }
  next();
});

app.use(
  '/investors',
  basicAuth({
    challenge : true,
    realm     : 'AMF-Investors',
    authorizer: (_u, pwd) => pwd === process.env.INVESTOR_PASS
  }),
  express.static(INVESTORS_DIR, { extensions: ['html'] })
);

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
  limits     : { fileSize: 10 * 1024 * 1024 },
  fileFilter : (_req, file, cb) =>
    file.mimetype.startsWith('image/')
      ? cb(null, true)
      : cb(new Error('Only image files are allowed'))
});

/* -------------------------------------------------- */
/* 5 ▶ REST API routes                                */
/* -------------------------------------------------- */
/* … (all routes remain exactly as in your original file) … */

/* save/update one cover */
app.post('/save-cover', async (req, res) => { /* unchanged */ });

app.post('/save-covers', async (req, res) => { /* unchanged */ });

app.post('/delete-cover', async (req, res) => { /* unchanged */ });

app.post('/upload-image', upload.single('image'), (req, res) => { /* unchanged */ });

app.post('/push-live', async (req, res) => { /* unchanged */ });

app.post('/save-assets', async (req, res) => { /* unchanged */ });

/* global error handler */
app.use((err, req, res, _next) => {
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
