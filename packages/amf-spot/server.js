// packages/amf-spot/server.js
require('dotenv').config();

const express       = require('express');
const fs            = require('fs-extra');
const path          = require('path');
const winston       = require('winston');
const basicAuth     = require('express-basic-auth');
const multer        = require('multer');

//─── Multer setup for temporary uploads ────────────────────────────────────────
const tmpUploadDir = path.join(__dirname, 'tmp-uploads');
fs.mkdirpSync(tmpUploadDir);
const upload = multer({ dest: tmpUploadDir });

//─── Logger ────────────────────────────────────────────────────────────────────
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) =>
      `${timestamp} [${level}] ${message}`
    )
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

// serve uploaded assets
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Admin UI (protected) ──────────────────────────────────────────────────────
app.use(
  '/admin',
  basicAuth({
    users: { [process.env.ADMIN_USERNAME]: process.env.ADMIN_PASSWORD },
    challenge: true
  }),
  express.static(path.join(__dirname, 'public', 'admin'))
);

// ── Public SPA assets ─────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── Artist middleware ─────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const artist = req.header('X-Artist-ID') || 'default';
  req.artistDir = path.join(dataDir, artist);
  next();
});

//─── IMAGE UPLOAD ──────────────────────────────────────────────────────────────
app.post('/upload-image', upload.single('file'), async (req, res) => {
  try {
    const artist = req.header('X-Artist-ID') || 'default';
    const destDir = path.join(__dirname, 'uploads', artist);
    await fs.mkdirp(destDir);
    const filename = `${Date.now()}-${req.file.originalname}`;
    await fs.move(req.file.path, path.join(destDir, filename));
    logger.info(`Saved image ${filename} for ${artist}`);
    res.json({ url: `/uploads/${artist}/${filename}` });
  } catch (err) {
    logger.error(`POST /upload-image error: ${err.stack}`);
    res.status(500).json({ error: 'Upload failed' });
  }
});

//─── FONT UPLOAD ───────────────────────────────────────────────────────────────
app.post('/upload-font', upload.single('file'), async (req, res) => {
  try {
    const artist = req.header('X-Artist-ID') || 'default';
    const destDir = path.join(__dirname, 'public', 'assets', 'fonts', artist);
    await fs.mkdirp(destDir);
    const filename = `${Date.now()}-${req.file.originalname}`;
    await fs.move(req.file.path, path.join(destDir, filename));
    logger.info(`Saved font ${filename} for ${artist}`);
    res.json({ url: `/assets/fonts/${artist}/${filename}` });
  } catch (err) {
    logger.error(`POST /upload-font error: ${err.stack}`);
    res.status(500).json({ error: 'Upload failed' });
  }
});

//─── AUDIO UPLOAD ──────────────────────────────────────────────────────────────
app.post('/api/upload-audio', upload.single('audio'), async (req, res) => {
  try {
    const artist = req.header('X-Artist-ID') || 'default';
    const destDir = path.join(__dirname, 'uploads', artist);
    await fs.mkdirp(destDir);
    const filename = `${Date.now()}-${req.file.originalname}`;
    await fs.move(req.file.path, path.join(destDir, filename));
    logger.info(`Saved audio ${filename} for ${artist}`);
    res.json({ success: true, filename });
  } catch (err) {
    logger.error(`POST /api/upload-audio error: ${err.stack}`);
    res.status(500).json({ error: 'Audio upload failed' });
  }
});

//─── LIST AUDIO FILES ──────────────────────────────────────────────────────────
app.get('/api/audio-files', async (req, res) => {
  try {
    const artist = path.basename(req.artistDir);
    const dir = path.join(__dirname, 'uploads', artist);
    const files = (await fs.pathExists(dir)) ? await fs.readdir(dir) : [];
    res.json(files.map(f => `/uploads/${artist}/${f}`));
  } catch (err) {
    logger.error(`GET /api/audio-files error: ${err.stack}`);
    res.status(500).json({ error: 'Could not list audio files' });
  }
});

//─── POST /api/comments ────────────────────────────────────────────────────────
// body: { audio: '<filename>', time: Number, text: String }
app.post('/api/comments', async (req, res) => {
  try {
    const file = path.join(req.artistDir, 'audio-comments.json');
    await ensureDirectoryExists(req.artistDir);
    await ensureFileExists(file, []);
    const comments = await fs.readJson(file);
    comments.push({ ...req.body, timestamp: Date.now() });
    await fs.writeJson(file, comments, { spaces: 2 });
    logger.info(`Added comment on ${req.body.audio} at ${req.body.time}`);
    res.json({ success: true });
  } catch (err) {
    logger.error(`POST /api/comments error: ${err.stack}`);
    res.status(500).json({ error: 'Failed to save comment' });
  }
});

//─── GET /api/comments ──────────────────────────────────────────────────────────
app.get('/api/comments', async (req, res) => {
  try {
    const file = path.join(req.artistDir, 'audio-comments.json');
    await ensureDirectoryExists(req.artistDir);
    await ensureFileExists(file, []);
    let all = await fs.readJson(file);
    if (req.query.audio) all = all.filter(c => c.audio === req.query.audio);
    res.json(all);
  } catch (err) {
    logger.error(`GET /api/comments error: ${err.stack}`);
    res.status(500).json({ error: 'Failed to load comments' });
  }
});

//─── GET /api/styles ──────────────────────────────────────────────────────────
app.get('/api/styles', async (req, res) => {
  const styleFile = path.join(req.artistDir, 'styles.json');
  try {
    await ensureDirectoryExists(req.artistDir);
    await ensureFileExists(styleFile, {
      fontFamily: 'GT America',
      fontSize: 16,
      fonts: [],
      overrides: {}
    });
    const styles = await fs.readJson(styleFile);
    logger.info(`Fetched styles for ${path.basename(req.artistDir)}`);
    res.json(styles);
  } catch (err) {
    logger.error(`GET /api/styles error: ${err.stack}`);
    res.status(500).json({ error: 'Failed to load styles' });
  }
});

//─── POST /api/save-style-settings ────────────────────────────────────────────
app.post('/api/save-style-settings', async (req, res) => {
  const styleFile = path.join(req.artistDir, 'styles.json');
  try {
    await ensureDirectoryExists(req.artistDir);
    await fs.writeJson(styleFile, req.body, { spaces: 2 });
    logger.info(`Saved styles for ${path.basename(req.artistDir)}`);
    res.json({ success: true });
  } catch (err) {
    logger.error(`POST /api/save-style-settings error: ${err.stack}`);
    res.status(500).json({ error: 'Failed to save styles' });
  }
});

//─── GET /api/covers ──────────────────────────────────────────────────────────
app.get('/api/covers', async (req, res) => {
  const coversFile = path.join(req.artistDir, 'covers.json');
  try {
    await ensureDirectoryExists(req.artistDir);
    await ensureFileExists(coversFile, []);
    const covers = await fs.readJson(coversFile);
    logger.info(`Fetched covers for ${path.basename(req.artistDir)}`);
    res.json(covers);
  } catch (err) {
    logger.error(`GET /api/covers error: ${err.stack}`);
    res.status(500).json({ error: 'Failed to load covers' });
  }
});

//─── POST /api/save-cover ─────────────────────────────────────────────────────
app.post('/api/save-cover', async (req, res) => {
  const coversFile = path.join(req.artistDir, 'covers.json');
  try {
    await ensureDirectoryExists(req.artistDir);
    await ensureFileExists(coversFile, []);
    const covers = await fs.readJson(coversFile);
    const incoming = req.body;
    const idx = covers.findIndex(c => c.id === incoming.id);
    if (idx >= 0) covers[idx] = incoming;
    else covers.push(incoming);
    await fs.writeJson(coversFile, covers, { spaces: 2 });
    logger.info(`Saved one cover for ${path.basename(req.artistDir)}`);
    res.json({ success: true });
  } catch (err) {
    logger.error(`POST /api/save-cover error: ${err.stack}`);
    res.status(500).json({ error: 'Failed to save cover' });
  }
});

//─── POST /api/save-covers ────────────────────────────────────────────────────
app.post('/api/save-covers', async (req, res) => {
  const coversFile = path.join(req.artistDir, 'covers.json');
  try {
    await ensureDirectoryExists(req.artistDir);
    const coversArray = req.body;
    if (!Array.isArray(coversArray)) {
      return res.status(400).json({ error: 'Invalid format' });
    }
    await fs.writeJson(coversFile, coversArray, { spaces: 2 });
    logger.info(`Replaced covers list for ${path.basename(req.artistDir)}`);
    res.json({ success: true });
  } catch (err) {
    logger.error(`POST /api/save-covers error: ${err.stack}`);
    res.status(500).json({ error: 'Failed to save covers' });
  }
});

//─── POST /api/delete-cover ───────────────────────────────────────────────────
app.post('/api/delete-cover', async (req, res) => {
  const coversFile = path.join(req.artistDir, 'covers.json');
  try {
    await ensureDirectoryExists(req.artistDir);
    await ensureFileExists(coversFile, []);
    const covers = await fs.readJson(coversFile);
    const coverID = req.body.coverID || req.body.id;
    if (!coverID) {
      return res.status(400).json({ error: 'Missing cover ID' });
    }
    const filtered = covers.filter(c => c.id !== coverID);
    await fs.writeJson(coversFile, filtered, { spaces: 2 });
    logger.info(`Deleted cover ${coverID} for ${path.basename(req.artistDir)}`);
    res.json({ success: true });
  } catch (err) {
    logger.error(`POST /api/delete-cover error: ${err.stack}`);
    res.status(500).json({ error: 'Failed to delete cover' });
  }
});

//─── POST /api/push-to-test ────────────────────────────────────────────────────
app.post('/api/push-to-test', async (req, res) => {
  const dir        = req.artistDir;
  const coversFile = path.join(dir, 'covers.json');
  const stylesFile = path.join(dir, 'styles.json');
  const testCovers = path.join(dir, 'test-covers.json');
  const testStyles = path.join(dir, 'test-styles.json');
  try {
    await ensureDirectoryExists(dir);
    await ensureFileExists(coversFile, []);
    await ensureFileExists(stylesFile, {
      fontFamily: 'GT America',
      fontSize: 16,
      fonts: [],
      overrides: {}
    });
    await fs.copy(coversFile, testCovers);
    await fs.copy(stylesFile, testStyles);
    logger.info(`Pushed to test for ${path.basename(dir)}`);
    res.json({ success: true });
  } catch (err) {
    logger.error(`POST /api/push-to-test error: ${err.stack}`);
    res.status(500).json({ error: 'Push to test failed' });
  }
});

//─── POST /api/push-to-live ────────────────────────────────────────────────────
app.post('/api/push-to-live', async (req, res) => {
  const dir        = req.artistDir;
  const coversFile = path.join(dir, 'covers.json');
  const stylesFile = path.join(dir, 'styles.json');
  const testCovers = path.join(dir, 'test-covers.json');
  const testStyles = path.join(dir, 'test-styles.json');
  try {
    await ensureDirectoryExists(dir);
    await ensureFileExists(testCovers, []);
    await ensureFileExists(testStyles, {
      fontFamily: 'GT America',
      fontSize: 16,
      fonts: [],
      overrides: {}
    });
    await fs.copy(testCovers, coversFile);
    await fs.copy(testStyles, stylesFile);
    logger.info(`Pushed to live for ${path.basename(dir)}`);
    res.json({ success: true });
  } catch (err) {
    logger.error(`POST /api/push-to-live error: ${err.stack}`);
    res.status(500).json({ error: 'Push to live failed' });
  }
});

//─── Export & listen ──────────────────────────────────────────────────────────
module.exports = app;
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    logger.info(`Server listening on port ${PORT}`);
  });
}
