require('dotenv').config()

const express        = require('express')
const fs             = require('fs-extra')
const path           = require('path')
const winston        = require('winston')
const basicAuth      = require('express-basic-auth')
const multer         = require('multer')

// Multer for audio uploads
const audioUpload = multer({ dest: path.join(__dirname, 'tmp-uploads') })

//─── Logger ────────────────────────────────────────────────────────────────────
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(function(info) {
      return info.timestamp + ' [' + info.level + '] ' + info.message
    })
  ),
  transports: [ new winston.transports.Console() ]
})

//─── Data dir detection ──────────────────────────────────────────────────────────
let dataDir = '/data'
if (!fs.existsSync(dataDir)) {
  dataDir = path.join(__dirname, 'data')
}
logger.info('Using data path: ' + dataDir)

//─── Helpers ───────────────────────────────────────────────────────────────────
async function ensureDirectoryExists(dir) {
  if (!(await fs.pathExists(dir))) {
    await fs.mkdirp(dir)
    logger.info('Created directory: ' + dir)
  }
}

async function ensureFileExists(filePath, defaultContent) {
  if (!(await fs.pathExists(filePath))) {
    await fs.writeJson(filePath, defaultContent, { spaces: 2 })
    logger.info('Created missing file: ' + filePath)
  }
}

//─── Express setup ─────────────────────────────────────────────────────────────
const app = express()
app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))               // public SPA + admin static mount
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))  // serve audio, images, etc
app.use(
  '/admin',
  basicAuth({
    users: { [process.env.ADMIN_USERNAME]: process.env.ADMIN_PASSWORD },
    challenge: true
  }),
  express.static(path.join(__dirname, 'public', 'admin'))
)

// artistDir middleware
app.use((req, res, next) => {
  const artist = req.header('X-Artist-ID') || 'default'
  req.artistDir = path.join(dataDir, artist)
  next()
})

//─── AUDIO UPLOAD & LIST ──────────────────────────────────────────────────────
// POST /upload-audio
app.post('/upload-audio', audioUpload.single('file'), async (req, res) => {
  try {
    const artist = req.header('X-Artist-ID') || 'default'
    const destDir = path.join(__dirname, 'uploads', 'audio', artist)
    await fs.mkdirp(destDir)
    const filename = Date.now() + '-' + req.file.originalname
    await fs.move(req.file.path, path.join(destDir, filename))
    logger.info('Saved audio ' + filename + ' for ' + artist)
    res.json({ url: '/uploads/audio/' + artist + '/' + filename })
  } catch (err) {
    logger.error('POST /upload-audio error: ' + err.stack)
    res.status(500).json({ error: 'Audio upload failed' })
  }
})

// GET /audio-files
app.get('/audio-files', async (req, res) => {
  try {
    const artist = req.header('X-Artist-ID') || 'default'
    const dir = path.join(__dirname, 'uploads', 'audio', artist)
    await fs.mkdirp(dir)
    const files = (await fs.readdir(dir)).map(f => '/uploads/audio/' + artist + '/' + f)
    res.json(files)
  } catch (err) {
    logger.error('GET /audio-files error: ' + err.stack)
    res.status(500).json({ error: 'List audio files failed' })
  }
})

//─── COMMENTS API ─────────────────────────────────────────────────────────────
app.post('/api/comments', async (req, res) => {
  const dir = req.artistDir
  const commentsFile = path.join(dir, 'comments.json')
  try {
    await ensureDirectoryExists(dir)
    await ensureFileExists(commentsFile, [])
    const comments = await fs.readJson(commentsFile)
    const incoming = req.body
    comments.push(incoming)
    await fs.writeJson(commentsFile, comments, { spaces: 2 })
    logger.info('Added comment for ' + path.basename(dir))
    res.json({ success: true, comment: incoming })
  } catch (err) {
    logger.error('POST /api/comments error: ' + err.stack)
    res.status(500).json({ error: 'Failed to save comment' })
  }
})

app.get('/api/comments', async (req, res) => {
  const dir = req.artistDir
  const commentsFile = path.join(dir, 'comments.json')
  try {
    await ensureDirectoryExists(dir)
    await ensureFileExists(commentsFile, [])
    const all = await fs.readJson(commentsFile)
    const file = req.query.file
    const filtered = file ? all.filter(c => c.file === file) : all
    res.json(filtered)
  } catch (err) {
    logger.error('GET /api/comments error: ' + err.stack)
    res.status(500).json({ error: 'Failed to load comments' })
  }
})

//─── STYLES & COVERS & PUSH ENDPOINTS (unchanged) ────────────────────────────

// GET /api/styles
app.get('/api/styles', async (req, res) => {
  const styleFile = path.join(req.artistDir, 'styles.json')
  try {
    await ensureDirectoryExists(req.artistDir)
    await ensureFileExists(styleFile, {
      fontFamily: 'GT America',
      fontSize: 16,
      fonts: [],
      overrides: {}
    })
    const styles = await fs.readJson(styleFile)
    logger.info('Fetched styles for ' + path.basename(req.artistDir))
    res.json(styles)
  } catch (err) {
    logger.error('GET /api/styles error: ' + err.stack)
    res.status(500).json({ error: 'Failed to load styles' })
  }
})

// GET /api/covers
app.get('/api/covers', async (req, res) => {
  const coversFile = path.join(req.artistDir, 'covers.json')
  try {
    await ensureDirectoryExists(req.artistDir)
    await ensureFileExists(coversFile, [])
    const covers = await fs.readJson(coversFile)
    logger.info('Fetched covers for ' + path.basename(req.artistDir))
    res.json(covers)
  } catch (err) {
    logger.error('GET /api/covers error: ' + err.stack)
    res.status(500).json({ error: 'Failed to load covers' })
  }
})

// POST /save-cover
app.post('/save-cover', async (req, res) => {
  const coversFile = path.join(req.artistDir, 'covers.json')
  try {
    await ensureDirectoryExists(req.artistDir)
    await ensureFileExists(coversFile, [])
    const covers = await fs.readJson(coversFile)
    const incoming = req.body
    const idx = covers.findIndex(c => c.id === incoming.id)
    if (idx >= 0) covers[idx] = incoming
    else covers.push(incoming)
    await fs.writeJson(coversFile, covers, { spaces: 2 })
    logger.info('Saved one cover for ' + path.basename(req.artistDir))
    res.json({ success: true })
  } catch (err) {
    logger.error('POST /save-cover error: ' + err.stack)
    res.status(500).json({ error: 'Failed to save cover' })
  }
})

// POST /save-covers
app.post('/save-covers', async (req, res) => {
  const coversFile = path.join(req.artistDir, 'covers.json')
  try {
    await ensureDirectoryExists(req.artistDir)
    const arr = req.body
    if (!Array.isArray(arr)) return res.status(400).json({ error: 'Invalid format' })
    await fs.writeJson(coversFile, arr, { spaces: 2 })
    logger.info('Replaced covers list for ' + path.basename(req.artistDir))
    res.json({ success: true })
  } catch (err) {
    logger.error('POST /save-covers error: ' + err.stack)
    res.status(500).json({ error: 'Failed to save covers' })
  }
})

// POST /delete-cover
app.post('/delete-cover', async (req, res) => {
  const coversFile = path.join(req.artistDir, 'covers.json')
  try {
    await ensureDirectoryExists(req.artistDir)
    await ensureFileExists(coversFile, [])
    const covers = await fs.readJson(coversFile)
    const id = req.body.coverID || req.body.id
    if (!id) return res.status(400).json({ error: 'Missing cover ID' })
    const filtered = covers.filter(c => c.id !== id)
    await fs.writeJson(coversFile, filtered, { spaces: 2 })
    logger.info('Deleted cover ' + id + ' for ' + path.basename(req.artistDir))
    res.json({ success: true })
  } catch (err) {
    logger.error('POST /delete-cover error: ' + err.stack)
    res.status(500).json({ error: 'Failed to delete cover' })
  }
})

// POST /push-to-test & /push-to-live as before...
// …copy your existing push-to-test/live blocks here…

//─── Export & listen ──────────────────────────────────────────────────────────
module.exports = app
if (require.main === module) {
  const PORT = process.env.PORT || 3000
  app.listen(PORT, () => logger.info('Server listening on port ' + PORT))
}
