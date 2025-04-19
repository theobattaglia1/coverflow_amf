require('dotenv').config();

const express       = require('express');
const fs            = require('fs-extra');
const path          = require('path');
const winston       = require('winston');
const basicAuth     = require('express-basic-auth');
const multer        = require('multer');

//─── Multer setup ─────────────────────────────────────────────────────────────
// temp upload location
const upload = multer({ dest: path.join(__dirname, 'tmp-uploads') });

//─── Logger ───────────────────────────────────────────────────────────────────
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

//─── Data dir detection ──────────────────────────────────────────────────────────
let dataDir = '/data';
if (!fs.existsSync(dataDir)) dataDir = path.join(__dirname, 'data');
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

// Admin UI (protected)
app.use(
  '/admin',
  basicAuth({
    users: { [process.env.ADMIN_USERNAME]: process.env.ADMIN_PASSWORD },
    challenge: true
  }),
  express.static(path.join(__dirname, 'public', 'admin'))
);

// Serve uploads (audio, images, etc.)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Artist scoping
app.use((req, res, next) => {
  const artist = req.header('X-Artist-ID') || 'default';
  req.artistDir = path.join(dataDir, artist);
  next();
});

//─── AUDIO UPLOAD & LISTING ────────────────────────────────────────────────────
app.post('/upload-audio', upload.single('file'), async (req, res) => {
  try {
    const artist = req.header('X-Artist-ID') || 'default';
    const destDir = path.join(__dirname, 'uploads', 'audio', artist);
    await fs.mkdirp(destDir);
    const filename = `${Date.now()}-${req.file.originalname}`;
    await fs.move(req.file.path, path.join(destDir, filename));
    logger.info(`Saved audio ${filename} for ${artist}`);
    res.json({ url: `/uploads/audio/${artist}/${filename}` });
  } catch (err) {
    logger.error(`POST /upload-audio error: ${err.stack}`);
    res.status(500).json({ error: 'Audio upload failed' });
  }
});
app.get('/audio-files', async (req, res) => {
  try {
    const artist = req.header('X-Artist-ID') || 'default';
    const dir = path.join(__dirname, 'uploads', 'audio', artist);
    await fs.mkdirp(dir);
    const files = (await fs.readdir(dir)).map(f => `/uploads/audio/${artist}/${f}`);
    res.json(files);
  } catch (err) {
    logger.error(`GET /audio-files error: ${err.stack}`);
    res.status(500).json({ error: 'List audio files failed' });
  }
});

//─── IMAGE UPLOAD & LISTING ────────────────────────────────────────────────────
app.post('/upload-image', upload.single('file'), async (req, res) => {
  try {
    const artist = req.header('X-Artist-ID') || 'default';
    const destDir = path.join(__dirname, 'uploads', 'images', artist);
    await fs.mkdirp(destDir);
    const filename = `${Date.now()}-${req.file.originalname}`;
    await fs.move(req.file.path, path.join(destDir, filename));
    logger.info(`Saved image ${filename} for ${artist}`);
    res.json({ url: `/uploads/images/${artist}/${filename}` });
  } catch (err) {
    logger.error(`POST /upload-image error: ${err.stack}`);
    res.status(500).json({ error: 'Image upload failed' });
  }
});
app.get('/image-files', async (req, res) => {
  try {
    const artist = req.header('X-Artist-ID') || 'default';
    const dir = path.join(__dirname, 'uploads', 'images', artist);
    await fs.mkdirp(dir);
    const files = (await fs.readdir(dir)).map(f => `/uploads/images/${artist}/${f}`);
    res.json(files);
  } catch (err) {
    logger.error(`GET /image-files error: ${err.stack}`);
    res.status(500).json({ error: 'List image files failed' });
  }
});

//─── COMMENTS (audio) ──────────────────────────────────────────────────────────
// (your existing /api/comments, with POST & GET)

//─── STYLES & COVERS & PUSH ENDPOINTS ─────────────────────────────────────────
// (leave all your existing /api/styles, /api/covers, /save-cover, /save-covers,
//  /delete-cover, /push-to-test, /push-to-live exactly as is)

//─── Export & listen ──────────────────────────────────────────────────────────
module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => logger.info(`Server listening on port ${PORT}`));
}
