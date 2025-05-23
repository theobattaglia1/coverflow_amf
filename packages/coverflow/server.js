/* packages/coverflow/server.js
   ONE-SERVICE VERSION  –  23 May 2025
   ----------------------------------- */

import express   from 'express';
import path      from 'path';
import fs        from 'fs';
import multer    from 'multer';
import basicAuth from 'express-basic-auth';
import { Octokit } from '@octokit/rest';
import { fileURLToPath } from 'url';

/* -------------------------------------------------- */
/* 1 ▶ absolute paths                                 */
/* -------------------------------------------------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const PUBLIC_DIR   = path.join(__dirname, 'public');          // built gallery
const UPLOADS_DIR  = path.join(PUBLIC_DIR, 'uploads');        // images/fonts
const DATA_DIR     = path.join(__dirname, 'data');            // JSON files

/* -------------------------------------------------- */
/* 2 ▶ basic Express setup                            */
/* -------------------------------------------------- */
const app  = express();
const PORT = process.env.PORT || 3000;                        // Render injects PORT

app.use(express.json());

/* serve the built gallery + uploaded assets */
app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));

/* no-cache for JSON + uploaded files */
app.use('/data',    express.static(DATA_DIR,    { setHeaders: res => res.setHeader('Cache-Control', 'no-store') }));
app.use('/uploads', express.static(UPLOADS_DIR, { setHeaders: res => res.setHeader('Cache-Control', 'no-store') }));

/* admin auth (simple Basic Auth) */
app.use('/admin', basicAuth({ users: { admin: 'password' }, challenge: true }),
                  express.static(path.join(__dirname, 'admin')));

/* SPA fallback → any unknown route returns index.html */
app.get('*', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

/* -------------------------------------------------- */
/* 3 ▶ GitHub helper                                  */
/* -------------------------------------------------- */
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const GH_OWNER = 'theobattaglia1';
const GH_REPO  = 'coverflow_amf';
const GH_JSON_PATH = 'data/covers.json';                      // repo-relative

async function writeJsonToGitHub(jsonString, commitMsg) {
  try {
    /* get current SHA (may 404 on first push) */
    let sha;
    try {
      const { data } = await octokit.repos.getContent({ owner: GH_OWNER, repo: GH_REPO, path: GH_JSON_PATH });
      sha = data.sha;
    } catch (err) {
      if (err.status !== 404) throw err;
    }

    await octokit.repos.createOrUpdateFileContents({
      owner: GH_OWNER,
      repo : GH_REPO,
      path : GH_JSON_PATH,
      message: commitMsg,
      content: Buffer.from(jsonString).toString('base64'),
      sha
    });

    console.log('🚀  pushed to GitHub');
    return true;
  } catch (err) {
    console.error('❌  GitHub push failed:', err);
    return false;
  }
}

/* -------------------------------------------------- */
/* 4 ▶ Multer setup – write straight into /public     */
/* -------------------------------------------------- */
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOADS_DIR),
  filename:    (_, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `image-${Date.now()}${ext}`);
  }
});
const upload = multer({ storage });

/* -------------------------------------------------- */
/* 5 ▶ API routes                                     */
/* -------------------------------------------------- */

/* Save / update a single cover */
app.post('/save-cover', async (req, res) => {
  const cover = req.body;
  console.log('📥  save-cover request', cover.id);

  /* read local JSON (create blank if missing) */
  const jsonPath = path.join(DATA_DIR, 'covers.json');
  let covers = [];
  try   { covers = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')); }
  catch { console.warn('starting fresh covers.json'); }

  const idx = covers.findIndex(c => c.id.toString() === cover.id.toString());
  idx === -1 ? covers.push(cover) : covers.splice(idx, 1, cover);

  fs.writeFileSync(jsonPath, JSON.stringify(covers, null, 2));
  console.log('✅  local JSON updated');

  /* push to GitHub (non-blocking for UI) */
  await writeJsonToGitHub(JSON.stringify(covers, null, 2),
                          `🔄 cover ${cover.id} via admin panel`);

  res.json({ success: true });
});

/* Re-order or bulk-save covers */
app.post('/save-covers', (req, res) => {
  if (!Array.isArray(req.body)) return res.status(400).json({ error: 'invalid format' });

  const jsonPath = path.join(DATA_DIR, 'covers.json');
  fs.writeFileSync(jsonPath, JSON.stringify(req.body, null, 2));
  writeJsonToGitHub(JSON.stringify(req.body, null, 2), '🔄 bulk covers update');

  res.json({ success: true });
});

/* Delete cover */
app.post('/delete-cover', (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'missing id' });

  const jsonPath = path.join(DATA_DIR, 'covers.json');
  const covers = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))
                      .filter(c => c.id.toString() !== id.toString());

  fs.writeFileSync(jsonPath, JSON.stringify(covers, null, 2));
  writeJsonToGitHub(JSON.stringify(covers, null, 2), `🗑️ delete cover ${id}`);

  res.json({ success: true });
});

/* Upload image – returns URL usable in frontImage field */
app.post('/upload-image', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no image' });
  res.json({ url: `/uploads/${req.file.filename}` });
});

/* -------------------------------------------------- */
/* 6 ▶ start server                                   */
/* -------------------------------------------------- */
app.listen(PORT, () => {
  console.log(`🚀  running on http://localhost:${PORT}`);
});
