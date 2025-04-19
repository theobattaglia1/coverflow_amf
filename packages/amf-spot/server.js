require('dotenv').config();

const express   = require('express');
const fs        = require('fs-extra');
const path      = require('path');
const winston   = require('winston');
const basicAuth = require('express-basic-auth');
const multer    = require('multer');

// Multer for uploads (temp storage)
const upload = multer({ dest: path.join(__dirname, 'tmp-uploads') });

//─── Logger ────────────────────────────────────────────────────────────────────
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(function(info) {
      return `${info.timestamp} [${info.level}] ${info.message}`;
    })
  ),
  transports: [ new winston.transports.Console() ]
});

//─── Data dir detection ──────────────────────────────────────────────────────────
let dataDir = '/data';
if (!fs.existsSync(dataDir)) {
  dataDir = path.join(__dirname, 'data');
}
logger.info(`Using data path: ${dataDir}`);

//─── Helpers ───────────────────────────────────────────────────────────────────
async function ensureDirectoryExists(dir) {
  if (!(await fs.pathExists(dir))) {
    await fs.mkdirp(dir);
    logger.info(`Created directory: ${dir}`);
  }
}

async function ensureFileExists(filePath, defaultContent) {
  if (!(await fs.pathExists(filePath))) {
    await fs.writeJson(filePath, defaultContent, { spaces: 2 });
    logger.info(`Created missing file: ${filePath}`);
  }
}

//─── Express setup ─────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());

// serve uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// admin UI (protected)
app.use(
  '/admin',
  basicAuth({
    users: { [process.env.ADMIN_USERNAME]: process.env.ADMIN_PASSWORD },
    challenge: true
  }),
  express.static(path.join(__dirname, 'public', 'admin'))
);

// public SPA
app.use(express.static(path.join(__dirname, 'public')));

// artist context
app.use((req, res, next) => {
  const artist = req.header('X-Artist-ID') || 'default';
  req.artistDir = path.join(dataDir, artist);
  next();
});

//─── IMAGE upload ──────────────────────────────────────────────────────────────
app.post('/admin/upload-image', upload.single('cover'), async (req, res) => {
  try {
    const artist = req.header('X-Artist-ID') || 'default';
    const destDir = path.join(__dirname, 'uploads', artist, 'images');
    await fs.mkdirp(destDir);
    const filename = `${Date.now()}-${req.file.originalname}`;
    await fs.move(req.file.path, path.join(destDir, filename));
    logger.info(`Saved image ${filename} for ${artist}`);
    res.json({ url: `/uploads/${artist}/images/${filename}` });
  } catch (err) {
    logger.error(`POST /admin/upload-image error: ${err.stack}`);
    res.status(500).json({ error: 'Upload failed' });
  }
});

//─── AUDIO upload ──────────────────────────────────────────────────────────────
app.post('/admin/upload-audio', upload.single('audio'), async (req, res) => {
  try {
    const artist = req.header('X-Artist-ID') || 'default';
    const destDir = path.join(__dirname, 'uploads', artist, 'audio');
    await fs.mkdirp(destDir);
    const filename = `${Date.now()}-${req.file.originalname}`;
    await fs.move(req.file.path, path.join(destDir, filename));
    logger.info(`Saved audio ${filename} for ${artist}`);
    res.json({ url: `/uploads/${artist}/audio/${filename}` });
  } catch (err) {
    logger.error(`POST /admin/upload-audio error: ${err.stack}`);
    res.status(500).json({ error: 'Upload failed' });
  }
});

//─── GET audio files ───────────────────────────────────────────────────────────
app.get('/api/audio-files', async (req, res) => {
  const artist = req.header('X-Artist-ID') || 'default';
  const dir = path.join(__dirname, 'uploads', artist, 'audio');
  try {
    await fs.mkdirp(dir);
    const files = await fs.readdir(dir);
    const list = files.map(f => ({ filename: f, url: `/uploads/${artist}/audio/${f}` }));
    logger.info(`Fetched audio files for ${artist}`);
    res.json(list);
  } catch (err) {
    logger.error(`GET /api/audio-files error: ${err.stack}`);
    res.status(500).json({ error: 'Failed to load audio files' });
  }
});

//─── COMMENTS APIs ─────────────────────────────────────────────────────────────
app.get('/api/comments', async (req, res) => {
  const commentsFile = path.join(req.artistDir, 'comments.json');
  try {
    await ensureDirectoryExists(req.artistDir);
    await ensureFileExists(commentsFile, []);
    const comments = await fs.readJson(commentsFile);
    logger.info(`Fetched comments for ${path.basename(req.artistDir)}`);
    res.json(comments);
  } catch (err) {
    logger.error(`GET /api/comments error: ${err.stack}`);
    res.status(500).json({ error: 'Failed to load comments' });
  }
});

app.post('/api/comments', async (req, res) => {
  const commentsFile = path.join(req.artistDir, 'comments.json');
  try {
    await ensureDirectoryExists(req.artistDir);
    await ensureFileExists(commentsFile, []);
    const comments = await fs.readJson(commentsFile);
    const incoming = req.body; // { filename, time, text }
    incoming.id = Date.now().toString();
    comments.push(incoming);
    await fs.writeJson(commentsFile, comments, { spaces: 2 });
    logger.info(`Added comment for ${path.basename(req.artistDir)}`);
    res.json({ success: true, comment: incoming });
  } catch (err) {
    logger.error(`POST /api/comments error: ${err.stack}`);
    res.status(500).json({ error: 'Failed to save comment' });
  }
});

//─── (leave your existing styles/covers/push endpoints unchanged) ─────────────

//─── Export & start ──────────────────────────────────────────────────────────
module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    logger.info(`Server listening on port ${PORT}`);
  });
}
