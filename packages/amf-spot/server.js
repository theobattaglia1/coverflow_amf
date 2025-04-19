// packages/amf-spot/server.js
require('dotenv').config()
const express = require('express')
const path = require('path')
const fs = require('fs-extra')
const basicAuth = require('express-basic-auth')
const winston = require('winston')
const multer = require('multer')

// —— Logger setup ——
const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) =>
      `${timestamp} [${level}] ${message}`
    )
  ),
  transports: [ new winston.transports.Console() ]
})

// —— Data directory detection ——
const candidate = '/data'
const fallback = path.join(__dirname, 'data')
const dataDir = fs.existsSync(candidate) ? candidate : fallback
logger.info(`Using data path: ${dataDir}`)
fs.ensureDirSync(dataDir)

// —— Multi‑tenant middleware ——
// Expects X-Artist-ID header
const tenant = (req, res, next) => {
  const artistID = req.header('X-Artist-ID')
  if (!artistID) {
    logger.error('Missing X-Artist-ID header')
    return res.status(400).json({ error: 'Missing X-Artist-ID header' })
  }
  req.artistID = artistID
  req.artistDir = path.join(dataDir, artistID)
  fs.ensureDirSync(req.artistDir)
  req.stylesFile = path.join(req.artistDir, 'styles.json')
  req.coversFile = path.join(req.artistDir, 'covers.json')
  // Ensure defaults
  if (!fs.pathExistsSync(req.stylesFile)) {
    fs.writeJsonSync(req.stylesFile, {
      fontFamily: 'GT America',
      fontSize: 16,
      fonts: [],
      overrides: {}
    }, { spaces: 2 })
    logger.info(`Created default styles.json for ${artistID}`)
  }
  if (!fs.pathExistsSync(req.coversFile)) {
    fs.writeJsonSync(req.coversFile, [], { spaces: 2 })
    logger.info(`Created default covers.json for ${artistID}`)
  }
  next()
}

// —— Express setup ——
const app = express()
app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

// —— Basic Auth on /admin ——
app.use('/admin', basicAuth({
  users: { [process.env.ADMIN_USERNAME]: process.env.ADMIN_PASSWORD },
  challenge: true
}))

// —— Multer storage for images —— 
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'uploads', req.artistID)
    fs.ensureDirSync(dir)
    cb(null, dir)
  },
  filename: (req, file, cb) => {
    const name = `${Date.now()}-${file.originalname}`
    cb(null, name)
  }
})
const uploadImage = multer({ storage: imageStorage })

// —— Multer storage for fonts —— 
const fontStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'public', 'assets', 'fonts', req.artistID)
    fs.ensureDirSync(dir)
    cb(null, dir)
  },
  filename: (req, file, cb) => {
    const name = `${Date.now()}-${file.originalname}`
    cb(null, name)
  }
})
const uploadFont = multer({ storage: fontStorage })

// —— Routes ——
// Use tenant middleware on all /api and upload/save routes
app.use(['/api', '/save-cover', '/save-covers', '/delete-cover',
         '/upload-image', '/upload-font', '/save-style-settings',
         '/push-to-test', '/push-to-live'], tenant)

// GET /api/covers
app.get('/api/covers', async (req, res) => {
  try {
    const covers = await fs.readJson(req.coversFile)
    logger.info(`Fetched covers for ${req.artistID}`)
    res.json(covers)
  } catch (err) {
    logger.error(`Error reading covers for ${req.artistID}: ${err.message}`)
    res.status(500).json({ error: 'Could not read covers' })
  }
})

// GET /api/styles
app.get('/api/styles', async (req, res) => {
  try {
    const styles = await fs.readJson(req.stylesFile)
    logger.info(`Fetched styles for ${req.artistID}`)
    res.json(styles)
  } catch (err) {
    logger.error(`Error reading styles for ${req.artistID}: ${err.message}`)
    res.status(500).json({ error: 'Could not read styles' })
  }
})

// POST /save-cover
app.post('/save-cover', async (req, res) => {
  try {
    const cover = req.body
    const covers = await fs.readJson(req.coversFile)
    covers.push(cover)
    await fs.writeJson(req.coversFile, covers, { spaces: 2 })
    logger.info(`Saved one cover for ${req.artistID}`)
    res.json({ success: true })
  } catch (err) {
    logger.error(`Error saving cover for ${req.artistID}: ${err.message}`)
    res.status(500).json({ error: 'Could not save cover' })
  }
})

// POST /save-covers
app.post('/save-covers', async (req, res) => {
  try {
    const covers = req.body
    await fs.writeJson(req.coversFile, covers, { spaces: 2 })
    logger.info(`Replaced covers list for ${req.artistID}`)
    res.json({ success: true })
  } catch (err) {
    logger.error(`Error saving covers for ${req.artistID}: ${err.message}`)
    res.status(500).json({ error: 'Could not save covers' })
  }
})

// POST /delete-cover
app.post('/delete-cover', async (req, res) => {
  try {
    const { coverID } = req.body
    let covers = await fs.readJson(req.coversFile)
    covers = covers.filter(c => c.id !== coverID)
    await fs.writeJson(req.coversFile, covers, { spaces: 2 })
    logger.info(`Deleted cover ${coverID} for ${req.artistID}`)
    res.json({ success: true })
  } catch (err) {
    logger.error(`Error deleting cover for ${req.artistID}: ${err.message}`)
    res.status(500).json({ error: 'Could not delete cover' })
  }
})

// POST /upload-image
app.post('/upload-image', uploadImage.single('file'), (req, res) => {
  try {
    const url = `/uploads/${req.artistID}/${req.file.filename}`
    logger.info(`Uploaded image for ${req.artistID}: ${url}`)
    res.json({ url })
  } catch (err) {
    logger.error(`Error uploading image for ${req.artistID}: ${err.message}`)
    res.status(500).json({ error: 'Image upload failed' })
  }
})

// POST /upload-font
app.post('/upload-font', uploadFont.single('file'), async (req, res) => {
  try {
    const fontUrl = `/assets/fonts/${req.artistID}/${req.file.filename}`
    const styles = await fs.readJson(req.stylesFile)
    styles.fonts.push({ name: req.file.originalname, url: fontUrl })
    await fs.writeJson(req.stylesFile, styles, { spaces: 2 })
    logger.info(`Uploaded font for ${req.artistID}: ${fontUrl}`)
    res.json({ url: fontUrl })
  } catch (err) {
    logger.error(`Error uploading font for ${req.artistID}: ${err.message}`)
    res.status(500).json({ error: 'Font upload failed' })
  }
})

// POST /save-style-settings
app.post('/save-style-settings', async (req, res) => {
  try {
    const settings = req.body
    await fs.writeJson(req.stylesFile, settings, { spaces: 2 })
    logger.info(`Saved style settings for ${req.artistID}`)
    res.json({ success: true })
  } catch (err) {
    logger.error(`Error saving styles for ${req.artistID}: ${err.message}`)
    res.status(500).json({ error: 'Could not save styles' })
  }
})

// POST /push-to-test
app.post('/push-to-test', async (req, res) => {
  try {
    // TODO: integrate with CI/CD API
    logger.info(`Triggered push-to-test for ${req.artistID}`)
    res.json({ success: true })
  } catch (err) {
    logger.error(`Error push-to-test for ${req.artistID}: ${err.message}`)
    res.status(500).json({ error: 'Push to test failed' })
  }
})

// POST /push-to-live
app.post('/push-to-live', async (req, res) => {
  try {
    // TODO: integrate with CI/CD API
    logger.info(`Triggered push-to-live for ${req.artistID}`)
    res.json({ success: true })
  } catch (err) {
    logger.error(`Error push-to-live for ${req.artistID}: ${err.message}`)
    res.status(500).json({ error: 'Push to live failed' })
  }
})

// — Start server only when run directly —
if (require.main === module) {
  const port = process.env.PORT || 3000
  app.listen(port, () => {
    logger.info(`Server listening on port ${port}`)
  })
}

module.exports = app
