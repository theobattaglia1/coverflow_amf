require('dotenv').config();
const express      = require('express');
const path         = require('path');
const bodyParser   = require('body-parser');
const cookieParser = require('cookie-parser');
const basicAuth    = require('express-basic-auth');
const multer       = require('multer');
const fs           = require('fs');
const { google }   = require('googleapis');
const logger       = require('./utils/logger');

const app  = express();
const PORT = process.env.PORT || 3000;

// Logging + parsers + Basic‑Auth
app.use(function(req, res, next) {
  logger.info(req.method + ' ' + req.url);
  next();
});
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(
  ['/admin', '/admin/*'],
  basicAuth({
    users: { [process.env.ADMIN_USERNAME]: process.env.ADMIN_PASSWORD },
    challenge: true,
    unauthorizedResponse: function(req) {
      logger.error('Unauthorized attempt to ' + req.url);
      return 'Authentication required';
    }
  })
);

// Static + Admin UI
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/admin', express.static(path.join(__dirname, 'public', 'admin')));

// In‑memory Tasks API
let tasks = [];
let nextTaskId = 1;
app.get('/api/tasks', function(req, res) {
  logger.info('GET /api/tasks');
  res.json(tasks);
});
app.post('/api/tasks', (req, res) => {
  logger.info('POST /api/tasks');
  const data = req.body || {};
  const t = { id: nextTaskId++, title: data.title || data.text || '', date: data.date || new Date().toISOString(), status: 'all' };
  tasks.push(t);
  res.status(201).json(t);
});
app.delete('/api/tasks/:id', function(req, res) {
  const id = parseInt(req.params.id, 10);
  logger.info('DELETE /api/tasks/' + id);
  tasks = tasks.filter(x => x.id !== id);
  res.status(204).send();
});

// Comments & Captions
app.get('/api/comments', function(req, res) {
  logger.info('GET /api/comments');
  res.json([]);
});
app.post('/api/comments', function(req, res) {
  logger.info('POST /api/comments');
  res.status(201).json(req.body);
});
app.get('/api/captions', function(req, res) {
  logger.info('GET /api/captions');
  res.json([]);
});
app.post('/api/captions', function(req, res) {
  logger.info('POST /api/captions');
  res.status(201).json(req.body);
});

// Health check
app.get('/ping', function(req, res) {
  logger.info('GET /ping -> 200');
  res.send('pong');
});

// Google OAuth2 & Calendar
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);
const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

app.get('/auth/google', function(req, res) {
  logger.info('GET /auth/google → redirect to consent');
  const url = oauth2Client.generateAuthUrl({ access_type: 'offline', scope: SCOPES });
  res.redirect(url);
});
app.get('/oauth2callback', async function(req, res) {
  logger.info('GET /oauth2callback → exchanging code');
  try {
    const { tokens } = await oauth2Client.getToken(req.query.code);
    res.cookie('google_tokens', JSON.stringify(tokens), { httpOnly: true });
    logger.info('Tokens stored; redirect to /admin/calendar');
    res.redirect('/admin/calendar');
  } catch (err) {
    logger.error('OAuth2 error', err);
    res.status(500).send('OAuth2 error');
  }
});
app.get('/api/calendar-events', async function(req, res) {
  logger.info('GET /api/calendar-events');
  const raw = req.cookies.google_tokens;
  if (!raw) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const tokens = JSON.parse(raw);
    oauth2Client.setCredentials(tokens);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const resp = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      maxResults: 10,
      singleEvents: true,
      orderBy: 'startTime'
    });
    const items = resp.data.items || [];
    const events = items.map(e => ({
      summary: e.summary,
      start: e.start.dateTime || e.start.date,
      end:   e.end.dateTime   || e.end.date
    }));
    res.json(events);
  } catch (err) {
    logger.error('Calendar fetch error', err);
    res.status(500).json({ error: 'Calendar fetch failed' });
  }
});

// Audio endpoints
fs.mkdirSync(path.join(__dirname,'uploads','audio'),{ recursive:true });
const audioUpload = multer({ dest: path.join(__dirname,'uploads','audio') });
app.post('/upload-audio', audioUpload.single('file'), function(req, res) {
  logger.info('POST /upload-audio');
  if (!req.file) return res.status(400).json({ error: 'No file' });
  res.status(201).json({ filename: req.file.filename, original: req.file.originalname });
});
app.get('/audio-files', function(req, res) {
  logger.info('GET /audio-files');
  fs.readdir(path.join(__dirname,'uploads','audio'), (err, files) => {
    if (err) return res.status(500).json([]);
    res.json(files);
  });
});

// Image endpoints
fs.mkdirSync(path.join(__dirname,'uploads','images'),{ recursive:true });
const imgUpload = multer({ dest: path.join(__dirname,'uploads','images') });
app.post('/upload-image', imgUpload.single('file'), function(req, res) {
  logger.info('POST /upload-image');
  if (!req.file) return res.status(400).json({ error: 'No file' });
  res.status(201).json({ filename: req.file.filename, original: req.file.originalname });
});
app.get('/image-files', function(req, res) {
  logger.info('GET /image-files');
  fs.readdir(path.join(__dirname,'uploads','images'), (err, files) => {
    if (err) return res.status(500).json([]);
    res.json(files);
  });
});

// 404 & error handlers
app.use(function(req, res) {
  logger.info('404 ' + req.method + ' ' + req.url);
  res.status(404).send('Not found');
});
app.use(function(err, req, res, next) {
  logger.error('ERROR ' + req.method + ' ' + req.url + ' - ' + err.stack);
  res.status(500).send('Server error');
});

// Start
app.listen(PORT, function() {
  logger.info('Server listening on port ' + PORT);
});
