const express   = require('express');
const path      = require('path');
const fs        = require('fs');
const multer    = require('multer');
const basicAuth = require('express-basic-auth');

const app  = express();
const PORT = process.env.PORT || 3000;

/* ───── Middleware ───── */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, _res, next) => {
  console.log(`[Server] ${new Date().toISOString()} – ${req.method} ${req.url}`);
  next();
});

/* ───── FS prep ───── */
const ensure = p => (!fs.existsSync(p) && fs.mkdirSync(p, { recursive: true }));
ensure(path.join(__dirname, 'uploads'));
ensure(path.join(__dirname, 'data'));
ensure(path.join(__dirname, 'public', 'audio'));

/* ───── Multer (uploads) ───── */
const upload = multer({ dest: 'uploads/' });

/* ───── Partner dashboard (Coverflow) ───── */
app.get('/:artist/dashboard', (req, _res, next) => {
  const css = path.join(__dirname, 'public/partner/dashboard/coverflow.css');
  const html = path.join(__dirname, 'public/partner/dashboard/index.html');

  if (!fs.existsSync(css)) {
    ensure(path.dirname(css));
    fs.writeFileSync(css, '/* TODO: coverflow styles */');
  }
  if (fs.existsSync(html)) {
    let h = fs.readFileSync(html, 'utf8');
    if (!h.includes('coverflow.css')) h = h.replace('</head>', '<link rel="stylesheet" href="coverflow.css">\n</head>');
    if (!h.includes('coverflow.js')) h = h.replace('</body>', '<script src="coverflow.js"></script>\n</body>');
    fs.writeFileSync(html, h);
  }
  next();
});
app.use('/:artist/dashboard', express.static(path.join(__dirname, 'public/partner/dashboard')));

/* ───── Artist‑scoped stubs ───── */
['calendar-events','tasks','comments','image-files','covers'].forEach(route => {
  app.get(`/api/:artist/${route}`, (req, res) =>
    res.json({ artist: req.params.artist, [route.replace(/-/g,'')]: [] })
  );
});

/* ───── Dynamic audio list per artist ───── */
const AUDIO_DIR = path.join(__dirname, 'public', 'audio');
app.use('/audio', express.static(AUDIO_DIR));

app.get('/api/:artist/audio-files', (req, res) => {
  const files = fs.readdirSync(AUDIO_DIR)
    .filter(f => f.match(/\.(mp3|wav|ogg)$/i))
    .map((f, i) => ({ id: i + 1, title: f, url: `/audio/${f}` }));
  res.json({ artist: req.params.artist, files });
});

/* ───── Global playlist JSON + comments ───── */
const AUDIO_DATA = path.join(__dirname, 'data', 'audios.json');
app.get('/api/audio', (_q, res) => {
  if (!fs.existsSync(AUDIO_DATA)) fs.writeFileSync(AUDIO_DATA, '[]');
  res.sendFile(AUDIO_DATA);
});
app.post('/api/audio/:trackId/comments', (req, res) => {
  const { trackId } = req.params;
  const { author, text, time } = req.body;
  if (!author || !text || typeof time !== 'number') return res.status(400).json({ error: 'Bad payload' });

  const data  = JSON.parse(fs.readFileSync(AUDIO_DATA));
  const track = data.find(t => t.id === trackId);
  if (!track) return res.status(404).json({ error: 'Track not found' });

  track.comments ??= [];
  track.comments.push({ author, text, time, createdAt: Date.now() });
  fs.writeFileSync(AUDIO_DATA, JSON.stringify(data, null, 2));
  res.json({ ok: true });
});

/* ───── Admin area ───── */
const adminAuth = basicAuth({ users: { admin: 'password' }, challenge: true, realm: 'AMF Admin' });
app.use('/admin', adminAuth);
app.use('/admin/:artist/dashboard', express.static(path.join(__dirname, 'public/admin/dashboard')));

['covers','styles'].forEach(type => {
  app.get(`/api/${type}`, (_q, res) => {
    const p = path.join(__dirname, `data/${type}.json`);
    res.json(fs.existsSync(p) ? JSON.parse(fs.readFileSync(p)) : (type==='covers'?[]:{}));
  });
});

/* ───── Fallbacks & errors ───── */
app.use((req, res) => { console.log(`[Server] 404 – ${req.url}`); res.status(404).send('Not found'); });
app.use((err, _q, res, _n) => { console.error('[Server] ERROR', err); res.status(500).send('Server error'); });

app.listen(PORT, () => console.log(`[Server] Listening on ${PORT}`));
