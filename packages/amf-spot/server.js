#!/usr/bin/env node
require('dotenv').config();

const express       = require('express');
const path          = require('path');
const fs            = require('fs-extra');
const multer        = require('multer');
const basicAuth     = require('express-basic-auth');
const cookieParser  = require('cookie-parser');
const { google }    = require('googleapis');

// ── Simple console logger ────────────────────────────────────────────────
const logger = {
  info:  console.log,
  error: console.error,
  debug: console.debug
};

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Admin UI
app.use(
  '/admin',
  basicAuth({
    users: { [process.env.ADMIN_USERNAME]: process.env.ADMIN_PASSWORD },
    challenge: true
  }),
  express.static(path.join(__dirname, 'public', 'admin'))
);

// identify artist
app.use(function(req, res, next) {
  var artist = req.header('X-Artist-ID') || 'default';
  req.artistDir = path.join(__dirname, 'data', artist);
  next();
});

// multer setup
var audioUpload = multer({ dest: path.join(__dirname, 'tmp') });
var imageUpload = multer({ dest: path.join(__dirname, 'tmp') });

// ── AUDIO ────────────────────────────────────────────────────────────────
app.post('/upload-audio', audioUpload.single('file'), async function(req, res) {
  try {
    var artist = req.header('X-Artist-ID') || 'default';
    var dest = path.join(__dirname, 'uploads', 'audio', artist);
    await fs.mkdirp(dest);
    var filename = Date.now() + '-' + req.file.originalname;
    await fs.move(req.file.path, path.join(dest, filename));
    logger.info('[POST /upload-audio] saved ' + filename + ' for ' + artist);
    res.json({ url: '/uploads/audio/' + artist + '/' + filename });
  } catch (err) {
    logger.error('[POST /upload-audio] error: ' + err.stack);
    res.status(500).json({ error: 'Audio upload failed' });
  }
});

app.get('/audio-files', async function(req, res) {
  try {
    var artist = req.header('X-Artist-ID') || 'default';
    var dir = path.join(__dirname, 'uploads', 'audio', artist);
    await fs.mkdirp(dir);
    var files = (await fs.readdir(dir)).map(function(f) {
      return '/uploads/audio/' + artist + '/' + f;
    });
    res.json(files);
  } catch (err) {
    logger.error('[GET /audio-files] error: ' + err.stack);
    res.status(500).json({ error: 'List audio failed' });
  }
});

// ── COMMENTS ─────────────────────────────────────────────────────────────
app.get('/api/comments', async function(req, res) {
  try {
    var file = path.join(req.artistDir, 'comments.json');
    await fs.ensureFile(file);
    var list = await fs.readJson(file);
    res.json(list);
  } catch (err) {
    logger.error('[GET /api/comments] error: ' + err.stack);
    res.status(500).json({ error: 'Load comments failed' });
  }
});

app.post('/api/comments', async function(req, res) {
  try {
    var body = req.body;
    var file = path.join(req.artistDir, 'comments.json');
    await fs.ensureFile(file);
    var list = await fs.readJson(file);
    list.push({ timestamp: body.timestamp, text: body.text });
    await fs.writeJson(file, list, { spaces: 2 });
    logger.info('[POST /api/comments] saved comment at ' + body.timestamp);
    res.json({ success: true });
  } catch (err) {
    logger.error('[POST /api/comments] error: ' + err.stack);
    res.status(500).json({ error: 'Save comment failed' });
  }
});

// ── CAPTIONS ─────────────────────────────────────────────────────────────
app.get('/api/captions', async function(req, res) {
  try {
    var asset = req.query.asset;
    var file  = path.join(req.artistDir, asset + '-captions.json');
    await fs.ensureFile(file);
    res.json(await fs.readJson(file));
  } catch (err) {
    logger.error('[GET /api/captions] error: ' + err.stack);
    res.status(500).json({ error: 'Load captions failed' });
  }
});

app.post('/api/captions', async function(req, res) {
  try {
    var body = req.body;
    var file = path.join(req.artistDir, body.asset + '-captions.json');
    await fs.ensureFile(file);
    var arr = await fs.readJson(file);
    arr.push({ timestamp: body.timestamp, text: body.text });
    await fs.writeJson(file, arr, { spaces: 2 });
    logger.info('[POST /api/captions] added for ' + body.asset);
    res.json({ success: true });
  } catch (err) {
    logger.error('[POST /api/captions] error: ' + err.stack);
    res.status(500).json({ error: 'Save caption failed' });
  }
});

// ── TASKS ────────────────────────────────────────────────────────────────
app.get('/api/tasks', async function(req, res) {
  try {
    var file = path.join(req.artistDir, 'tasks.json');
    await fs.ensureFile(file);
    res.json(await fs.readJson(file));
  } catch (err) {
    logger.error('[GET /api/tasks] error: ' + err.stack);
    res.status(500).json({ error: 'Fetch tasks failed' });
  }
});

app.post('/api/tasks', async function(req, res) {
  try {
    var body = req.body;
    var file = path.join(req.artistDir, 'tasks.json');
    await fs.ensureFile(file);
    var arr  = await fs.readJson(file);
    arr.push({ id: body.id, text: body.text });
    await fs.writeJson(file, arr, { spaces: 2 });
    logger.info('[POST /api/tasks] created ' + body.id);
    res.json({ success: true });
  } catch (err) {
    logger.error('[POST /api/tasks] error: ' + err.stack);
    res.status(500).json({ error: 'Create task failed' });
  }
});

app.delete('/api/tasks/:id', async function(req, res) {
  try {
    var file = path.join(req.artistDir, 'tasks.json');
    await fs.ensureFile(file);
    var arr  = await fs.readJson(file);
    arr = arr.filter(function(t) { return t.id !== req.params.id; });
    await fs.writeJson(file, arr, { spaces: 2 });
    logger.info('[DELETE /api/tasks] removed ' + req.params.id);
    res.json({ success: true });
  } catch (err) {
    logger.error('[DELETE /api/tasks] error: ' + err.stack);
    res.status(500).json({ error: 'Delete task failed' });
  }
});

// ── GOOGLE CALENDAR ──────────────────────────────────────────────────────
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

app.get('/auth/google', function(req, res) {
  logger.info('[auth/google] redirecting');
  var url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt:      'consent',
    scope:       ['https://www.googleapis.com/auth/calendar.readonly']
  });
  res.redirect(url);
});

app.get('/oauth2callback', async function(req, res) {
  try {
    var code   = req.query.code;
    var tokens = (await oauth2Client.getToken(code)).tokens;
    res.cookie('google_tokens', tokens, { httpOnly: true });
    logger.info('[oauth2callback] tokens saved');
    res.redirect('/admin/calendar/index.html');
  } catch (err) {
    logger.error('[oauth2callback] error: ' + err.stack);
    res.status(500).send('Authentication failed');
  }
});

app.get('/api/calendar-events', async function(req, res) {
  try {
    var tokens = req.cookies.google_tokens;
    if (!tokens) {
      res.status(401).json({ error: 'Not authorized' });
      return;
    }
    oauth2Client.setCredentials(tokens);
    var calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    var result   = await calendar.events.list({
      calendarId:  'primary',
      timeMin:      (new Date()).toISOString(),
      maxResults:   10,
      singleEvents: true,
      orderBy:      'startTime'
    });
    var items = result.data.items || [];
    logger.debug('[GET /api/calendar-events] count=' + items.length);
    res.json(items);
  } catch (err) {
    logger.error('[GET /api/calendar-events] error: ' + err.stack);
    res.status(500).json({ error: 'Fetch events failed' });
  }
});

// ── EXPORT & LISTEN ────────────────────────────────────────────────────────
module.exports = app;
if (require.main === module) {
  var PORT = parseInt(process.env.PORT, 10) || 3000;
  app.listen(PORT, function() {
    logger.info('Server listening on port ' + PORT);
  });
}
