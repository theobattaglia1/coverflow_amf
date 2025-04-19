require('dotenv').config();

const express       = require('express');
const fs            = require('fs-extra');
const path          = require('path');
const winston       = require('winston');
const basicAuth     = require('express-basic-auth');
const multer        = require('multer');

// Multer setup
const upload        = multer({ dest: path.join(__dirname, 'uploads/tmp') });
const audioUpload   = multer({ dest: path.join(__dirname, 'uploads/audio/tmp') });

//── Logger ─────────────────────────────────────────────────────────────────────
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level}] ${message}`;
    })
  ),
  transports: [ new winston.transports.Console() ]
});

//── Data dir detection ───────────────────────────────────────────────────────────
let dataDir = '/data';
if (!fs.existsSync(dataDir)) {
  dataDir = path.join(__dirname, 'data');
}
logger.info(`Using data path: ${dataDir}`);

//── Helpers ─────────────────────────────────────────────────────────────────────
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

//── Express setup ───────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(
  '/admin',
  basicAuth({
    users: { [process.env.ADMIN_USERNAME]: process.env.ADMIN_PASSWORD },
    challenge: true
  }),
  express.static(path.join(__dirname, 'public', 'admin'))
);
app.use((req, res, next) => {
  const artist = req.header('X-Artist-ID') || 'default';
  req.artistDir = path.join(dataDir, artist);
  next();
});

//── GET /api/styles ─────────────────────────────────────────────────────────────
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

//── GET /api/covers ─────────────────────────────────────────────────────────────
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

//── POST /save-cover ────────────────────────────────────────────────────────────
app.post('/save-cover', async (req, res) => {
  const coversFile = path.join(req.artistDir, 'covers.json');
  try {
    await ensureDirectoryExists(req.artistDir);
    await ensureFileExists(coversFile, []);
    const covers  = await fs.readJson(coversFile);
    const incoming = req.body;
    const idx     = covers.findIndex(c => c.id === incoming.id);
    if (idx >= 0) covers[idx] = incoming;
    else covers.push(incoming);
    await fs.writeJson(coversFile, covers, { spaces: 2 });
    logger.info(`Saved cover for ${path.basename(req.artistDir)}`);
    res.json({ success: true });
  } catch (err) {
    logger.error(`POST /save-cover error: ${err.stack}`);
    res.status(500).json({ error: 'Failed to save cover' });
  }
});

//── POST /save-covers ───────────────────────────────────────────────────────────
app.post('/save-covers', async (req, res) => {
  const coversFile = path.join(req.artistDir, 'covers.json');
  try {
    await ensureDirectoryExists(req.artistDir);
    const arr = req.body;
    if (!Array.isArray(arr)) return res.status(400).json({ error: 'Invalid format' });
    await fs.writeJson(coversFile, arr, { spaces: 2 });
    logger.info(`Replaced covers list for ${path.basename(req.artistDir)}`);
    res.json({ success: true });
  } catch (err) {
    logger.error(`POST /save-covers error: ${err.stack}`);
    res.status(500).json({ error: 'Failed to save covers' });
  }
});

//── POST /delete-cover ─────────────────────────────────────────────────────────
app.post('/delete-cover', async (req, res) => {
  const coversFile = path.join(req.artistDir, 'covers.json');
  try {
    await ensureDirectoryExists(req.artistDir);
    await ensureFileExists(coversFile, []);
    const covers  = await fs.readJson(coversFile);
    const coverID = req.body.coverID || req.body.id;
    if (!coverID) return res.status(400).json({ error: 'Missing cover ID' });
    const filtered = covers.filter(c => c.id !== coverID);
    await fs.writeJson(coversFile, filtered, { spaces: 2 });
    logger.info(`Deleted cover ${coverID}`);
    res.json({ success: true });
  } catch (err) {
    logger.error(`POST /delete-cover error: ${err.stack}`);
    res.status(500).json({ error: 'Failed to delete cover' });
  }
});

//── POST /push-to-test & /push-to-live ──────────────────────────────────────────
app.post('/push-to-test', async (req, res) => {
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
    logger.error(`POST /push-to-test error: ${err.stack}`);
    res.status(500).json({ error: 'Push to test failed' });
  }
});
app.post('/push-to-live', async (req, res) => {
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
    logger.error(`POST /push-to-live error: ${err.stack}`);
    res.status(500).json({ error: 'Push to live failed' });
  }
});

//── IMAGE UPLOAD & LISTING ─────────────────────────────────────────────────────
app.post('/upload-image', upload.single('file'), async (req, res) => {
  try {
    const artist = req.header('X-Artist-ID') || 'default';
    const dest   = path.join(__dirname, 'uploads', 'images', artist);
    await fs.mkdirp(dest);
    const fn = `${Date.now()}-${req.file.originalname}`;
    await fs.move(req.file.path, path.join(dest, fn));
    logger.info(`Saved image ${fn}`);
    res.json({ url: `/uploads/images/${artist}/${fn}` });
  } catch (err) {
    logger.error(`POST /upload-image error: ${err.stack}`);
    res.status(500).json({ error: 'Image upload failed' });
  }
});
app.get('/image-files', async (req, res) => {
  try {
    const artist = req.header('X-Artist-ID') || 'default';
    const dir    = path.join(__dirname, 'uploads', 'images', artist);
    await fs.mkdirp(dir);
    const list   = (await fs.readdir(dir)).map(f => `/uploads/images/${artist}/${f}`);
    res.json(list);
  } catch (err) {
    logger.error(`GET /image-files error: ${err.stack}`);
    res.status(500).json({ error: 'List image files failed' });
  }
});

//── AUDIO UPLOAD & LISTING ──────────────────────────────────────────────────────
app.post('/upload-audio', audioUpload.single('file'), async (req, res) => {
  try {
    const artist = req.header('X-Artist-ID') || 'default';
    const dest   = path.join(__dirname, 'uploads', 'audio', artist);
    await fs.mkdirp(dest);
    const fn = `${Date.now()}-${req.file.originalname}`;
    await fs.move(req.file.path, path.join(dest, fn));
    logger.info(`Saved audio ${fn}`);
    res.json({ url: `/uploads/audio/${artist}/${fn}` });
  } catch (err) {
    logger.error(`POST /upload-audio error: ${err.stack}`);
    res.status(500).json({ error: 'Audio upload failed' });
  }
});
app.get('/audio-files', async (req, res) => {
  try {
    const artist = req.header('X-Artist-ID') || 'default';
    const dir    = path.join(__dirname, 'uploads', 'audio', artist);
    await fs.mkdirp(dir);
    const list   = (await fs.readdir(dir)).map(f => `/uploads/audio/${artist}/${f}`);
    res.json(list);
  } catch (err) {
    logger.error(`GET /audio-files error: ${err.stack}`);
    res.status(500).json({ error: 'List audio files failed' });
  }
});

//── COMMENTS (audio) ────────────────────────────────────────────────────────────
app.get('/api/comments', async (req, res) => {
  const file = path.join(req.artistDir, 'comments.json');
  const filter = req.query.file;
  try {
    await ensureDirectoryExists(req.artistDir);
    await ensureFileExists(file, []);
    let arr = await fs.readJson(file);
    if (filter) arr = arr.filter(c => c.file === filter);
    res.json(arr);
  } catch (err) {
    logger.error(`GET /api/comments error: ${err.stack}`);
    res.status(500).json({ error: 'Failed to load comments' });
  }
});
app.post('/api/comments', async (req, res) => {
  const { file, timestamp, text } = req.body;
  if (!file || typeof timestamp !== 'number' || !text) {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  const cf = path.join(req.artistDir, 'comments.json');
  try {
    await ensureDirectoryExists(req.artistDir);
    await ensureFileExists(cf, []);
    const arr = await fs.readJson(cf);
    const entry = { file, timestamp, text };
    await fs.writeJson(cf, [...arr, entry], { spaces: 2 });
    logger.info(`Added comment`);
    res.json({ success: true, comment: entry });
  } catch (err) {
    logger.error(`POST /api/comments error: ${err.stack}`);
    res.status(500).json({ error: 'Failed to save comment' });
  }
});

//── CAPTIONS API ───────────────────────────────────────────────────────────────
app.get('/api/captions', async (req, res) => {
  const as = req.query.asset;
  if (!as) return res.status(400).json({ error: 'Missing asset query param' });
  const file = path.join(req.artistDir, `${as}-captions.json`);
  try {
    await ensureDirectoryExists(req.artistDir);
    await ensureFileExists(file, []);
    const arr = await fs.readJson(file);
    res.json(arr);
  } catch (err) {
    logger.error(`GET /api/captions error: ${err.stack}`);
    res.status(500).json({ error: 'Failed to load captions' });
  }
});
app.post('/api/captions', async (req, res) => {
  const { asset, timestamp, text } = req.body;
  if (!asset || typeof timestamp !== 'number' || !text) {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  const file = path.join(req.artistDir, `${asset}-captions.json`);
  try {
    await ensureDirectoryExists(req.artistDir);
    await ensureFileExists(file, []);
    const arr = await fs.readJson(file);
    const entry = { timestamp, text };
    await fs.writeJson(file, [...arr, entry], { spaces: 2 });
    logger.info(`Added caption`);
    res.json({ success: true, caption: entry });
  } catch (err) {
    logger.error(`POST /api/captions error: ${err.stack}`);
    res.status(500).json({ error: 'Failed to save caption' });
  }
});

//── TASKS API ──────────────────────────────────────────────────────────────────
app.get('/api/tasks', async (req, res) => {
  const file = path.join(req.artistDir, 'tasks.json');
  try {
    await ensureDirectoryExists(req.artistDir);
    await ensureFileExists(file, []);
    const arr = await fs.readJson(file);
    res.json(arr);
  } catch (err) {
    logger.error(`GET /api/tasks error: ${err.stack}`);
    res.status(500).json({ error: 'Failed to load tasks' });
  }
});
app.post('/api/tasks', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Missing task text' });
  const file = path.join(req.artistDir, 'tasks.json');
  try {
    await ensureDirectoryExists(req.artistDir);
    await ensureFileExists(file, []);
    const arr = await fs.readJson(file);
    const task = { id: Date.now().toString(), text };
    await fs.writeJson(file, [...arr, task], { spaces: 2 });
    logger.info(`Added task`);
    res.json({ success: true, task });
  } catch (err) {
    logger.error(`POST /api/tasks error: ${err.stack}`);
    res.status(500).json({ error: 'Failed to save task' });
  }
});
app.delete('/api/tasks/:id', async (req, res) => {
  const file = path.join(req.artistDir, 'tasks.json');
  try {
    await ensureDirectoryExists(req.artistDir);
    await ensureFileExists(file, []);
    let arr = await fs.readJson(file);
    arr = arr.filter(t => t.id !== req.params.id);
    await fs.writeJson(file, arr, { spaces: 2 });
    logger.info(`Deleted task ${req.params.id}`);
    res.json({ success: true });
  } catch (err) {
    logger.error(`DELETE /api/tasks error: ${err.stack}`);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

//── Export & start ─────────────────────────────────────────────────────────────
module.exports = app;
if (require.main === module) {
  const PORT = parseInt(process.env.PORT, 10) || 3000;
  app.listen(PORT, () => logger.info(`Server listening on port ${PORT}`));
}
