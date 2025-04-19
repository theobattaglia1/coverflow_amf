// packages/amf-spot/server.js
require('dotenv').config();
const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const winston = require('winston');
const basicAuth = require('express-basic-auth');

//─── Logger (ES5 function, no template literals) ─────────────────────────────
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(function(log) {
      return log.timestamp + ' [' + log.level + '] ' + log.message;
    })
  ),
  transports: [
    new winston.transports.Console()
  ]
});

//─── Data directory detection ──────────────────────────────────────────────────
var dataDir = '/data';
if (!fs.existsSync(dataDir)) {
  dataDir = path.join(__dirname, 'data');
}
logger.info('Using data path: ' + dataDir);

//─── Helpers ───────────────────────────────────────────────────────────────────
async function ensureDirectoryExists(dir) {
  if (!await fs.pathExists(dir)) {
    await fs.mkdirp(dir);
    logger.info('Created directory: ' + dir);
  }
}

async function ensureFileExists(filePath, defaultContent) {
  if (!await fs.pathExists(filePath)) {
    await fs.writeJson(filePath, defaultContent, { spaces: 2 });
    logger.info('Created missing file: ' + filePath);
  }
}

//─── Express setup ─────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Protect /admin if needed
app.use('/admin', basicAuth({
  users: { [process.env.ADMIN_USERNAME]: process.env.ADMIN_PASSWORD },
  challenge: true
}));

// Multi‑tenant middleware (X-Artist-ID header)
app.use(function(req, res, next) {
  var artist = req.header('X-Artist-ID') || 'default';
  req.artistDir = path.join(dataDir, artist);
  next();
});

//─── GET /api/styles ──────────────────────────────────────────────────────────
app.get('/api/styles', async function(req, res) {
  var styleFile = path.join(req.artistDir, 'styles.json');
  try {
    await ensureDirectoryExists(req.artistDir);
    await ensureFileExists(styleFile, {
      fontFamily: 'GT America',
      fontSize: 16,
      fonts: [],
      overrides: {}
    });
    var styles = await fs.readJson(styleFile);
    logger.info('Fetched styles for ' + path.basename(req.artistDir));
    res.json(styles);
  } catch (err) {
    logger.error('GET /api/styles error: ' + err.stack);
    res.status(500).json({ error: 'Failed to load styles' });
  }
});

//─── GET /api/covers ──────────────────────────────────────────────────────────
app.get('/api/covers', async function(req, res) {
  var coversFile = path.join(req.artistDir, 'covers.json');
  try {
    await ensureDirectoryExists(req.artistDir);
    await ensureFileExists(coversFile, []);
    var covers = await fs.readJson(coversFile);
    logger.info('Fetched covers for ' + path.basename(req.artistDir));
    res.json(covers);
  } catch (err) {
    logger.error('GET /api/covers error: ' + err.stack);
    res.status(500).json({ error: 'Failed to load covers' });
  }
});

//─── POST /save-cover ─────────────────────────────────────────────────────────
app.post('/save-cover', async function(req, res) {
  var coversFile = path.join(req.artistDir, 'covers.json');
  try {
    await ensureDirectoryExists(req.artistDir);
    await ensureFileExists(coversFile, []);
    var covers = await fs.readJson(coversFile);
    var incoming = req.body;
    var idx = covers.findIndex(function(c) { return c.id === incoming.id; });
    if (idx >= 0) covers[idx] = incoming;
    else covers.push(incoming);
    await fs.writeJson(coversFile, covers, { spaces: 2 });
    logger.info('Saved one cover for ' + path.basename(req.artistDir));
    res.json({ success: true });
  } catch (err) {
    logger.error('POST /save-cover error: ' + err.stack);
    res.status(500).json({ error: 'Failed to save cover' });
  }
});

//─── POST /save-covers ────────────────────────────────────────────────────────
app.post('/save-covers', async function(req, res) {
  var coversFile = path.join(req.artistDir, 'covers.json');
  try {
    await ensureDirectoryExists(req.artistDir);
    var coversArray = req.body;
    if (!Array.isArray(coversArray)) {
      return res.status(400).json({ error: 'Invalid format' });
    }
    await fs.writeJson(coversFile, coversArray, { spaces: 2 });
    logger.info('Replaced covers list for ' + path.basename(req.artistDir));
    res.json({ success: true });
  } catch (err) {
    logger.error('POST /save-covers error: ' + err.stack);
    res.status(500).json({ error: 'Failed to save covers' });
  }
});

//─── POST /delete-cover ───────────────────────────────────────────────────────
app.post('/delete-cover', async function(req, res) {
  var coversFile = path.join(req.artistDir, 'covers.json');
  try {
    await ensureDirectoryExists(req.artistDir);
    await ensureFileExists(coversFile, []);
    var covers = await fs.readJson(coversFile);
    var coverID = req.body.coverID || req.body.id;
    if (!coverID) {
      return res.status(400).json({ error: 'Missing cover ID' });
    }
    var filtered = covers.filter(function(c) { return c.id !== coverID; });
    await fs.writeJson(coversFile, filtered, { spaces: 2 });
    logger.info('Deleted cover ' + coverID + ' for ' + path.basename(req.artistDir));
    res.json({ success: true });
  } catch (err) {
    logger.error('POST /delete-cover error: ' + err.stack);
    res.status(500).json({ error: 'Failed to delete cover' });
  }
});

//─── Export for tests ─────────────────────────────────────────────────────────
module.exports = app;

//─── Start server if run directly ────────────────────────────────────────────
if (require.main === module) {
  var PORT = process.env.PORT || 3000;
  app.listen(PORT, function() {
    logger.info('Server listening on port ' + PORT);
  });
}
