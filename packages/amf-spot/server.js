// packages/amf-spot/server.js
require('dotenv').config();

const express        = require('express');
const fs             = require('fs-extra');
const path           = require('path');
const winston        = require('winston');
const basicAuth      = require('express-basic-auth');
const multer         = require('multer');

// Multer setup: store uploads under ./uploads/<filename>
const upload = multer({ dest: path.join(__dirname, 'uploads/') });

//─── Logger ────────────────────────────────────────────────────────────────────
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(function(log) {
      return `${log.timestamp} [${log.level}] ${log.message}`;
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
app.use(express.static(path.join(__dirname, 'public')));
app.use('/admin', basicAuth({
  users: { [process.env.ADMIN_USERNAME]: process.env.ADMIN_PASSWORD },
  challenge: true
}));
app.use((req, res, next) => {
  const artist = req.header('X-Artist-ID') || 'default';
  req.artistDir = path.join(dataDir, artist);
  next();
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

//─── POST /save-cover ─────────────────────────────────────────────────────────
app.post('/save-cover', async (req, res) => {
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
    logger.error(`POST /save-cover error: ${err.stack}`);
    res.status(500).json({ error: 'Failed to save cover' });
  }
});

//─── POST /save-covers ────────────────────────────────────────────────────────
app.post('/save-covers', async (req, res) => {
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
    logger.error(`POST /save-covers error: ${err.stack}`);
    res.status(500).json({ error: 'Failed to save covers' });
  }
});

//─── POST /delete-cover ───────────────────────────────────────────────────────
app.post('/delete-cover', async (req, res) => {
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
    logger.error(`POST /delete-cover error: ${err.stack}`);
    res.status(500).json({ error: 'Failed to delete cover' });
  }
});

//─── POST /admin/upload-cover ─────────────────────────────────────────────────
app.post(
  '/admin/upload-cover',
  upload.single('cover'),
  async (req, res) => {
    try {
      // You can move/rename req.file here if desired, e.g.:
      // const newName = `${req.header('X-Artist-ID')}-${Date.now()}-${req.file.originalname}`;
      // await fs.move(req.file.path, path.join(__dirname,'uploads',newName));
      logger.info(`Admin uploaded cover ${req.file.filename}`);
      res.json({ success: true, file: req.file.filename });
    } catch (err) {
      logger.error(`POST /admin/upload-cover error: ${err.stack}`);
      res.status(500).json({ error: 'Upload failed' });
    }
  }
);

//─── POST /push-to-test ────────────────────────────────────────────────────────
app.post('/push-to-test', async (req, res) => {
  const dir         = req.artistDir;
  const coversFile  = path.join(dir, 'covers.json');
  const stylesFile  = path.join(dir, 'styles.json');
  const testCovers  = path.join(dir, 'test-covers.json');
  const testStyles  = path.join(dir, 'test-styles.json');
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

//─── POST /push-to-live ───────────────────────────────────────────────────────
app.post('/push-to-live', async (req, res) => {
  const dir         = req.artistDir;
  const coversFile  = path.join(dir, 'covers.json');
  const stylesFile  = path.join(dir, 'styles.json');
  const testCovers  = path.join(dir, 'test-covers.json');
  const testStyles  = path.join(dir, 'test-styles.json');
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

//─── Export for tests & start server ──────────────────────────────────────────
module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    logger.info(`Server listening on port ${PORT}`);
  });
}
