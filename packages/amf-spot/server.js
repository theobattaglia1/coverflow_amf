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

// — artist slugs
const slugify     = n=>n.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'');
const artistNames = (process.env.ARTISTS||'').split(',').map(s=>s.trim()).filter(Boolean);
const artists     = artistNames.map(slugify);

// — logging & parsers
app.use((req,res,next)=>{ logger.info(`→ ${req.method} ${req.url}`); next(); });
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended:false }));
app.use(cookieParser());

// — protect only the ADMIN dashboard
app.use('/admin', basicAuth({
  users: { [process.env.ADMIN_USER||'admin']: process.env.ADMIN_PASS||'password' },
  challenge: true
}));

// — ADMIN (editable) dashboard
app.get('/admin/:artist/dashboard', (req,res)=>{
  const a = req.params.artist;
  if (!artists.includes(a)) return res.status(404).send('Not found');
  res.sendFile(path.join(__dirname,'public','admin','dashboard','index.html'));
});
app.use('/admin/:artist/dashboard', (req,res,next)=>{
  const a = req.params.artist;
  if (!artists.includes(a)) return next();
  express.static(path.join(__dirname,'public','admin','dashboard'))(req,res,next);
});

// — PARTNER (read‑only) dashboard
app.get('/:artist/dashboard', (req,res)=>{
  const a = req.params.artist;
  if (!artists.includes(a)) return res.status(404).send('Not found');
  res.sendFile(path.join(__dirname,'public','partner','dashboard','index.html'));
});
app.use('/:artist/dashboard', (req,res,next)=>{
  const a = req.params.artist;
  if (!artists.includes(a)) return next();
  express.static(path.join(__dirname,'public','partner','dashboard'))(req,res,next);
});

// — uploads
fs.mkdirSync(path.join(__dirname,'uploads','audio'),  { recursive:true });
fs.mkdirSync(path.join(__dirname,'uploads','images'), { recursive:true });
app.use('/uploads', express.static(path.join(__dirname,'uploads')));

// — in‑memory stores
const tasksByArtist       = {};
const nextTaskIdByArtist = {};
const commentsByArtist   = {};

// — Tasks API
app.get('/api/:artist/tasks',      (req,res)=>{ const a=req.params.artist; if(!artists.includes(a))return res.status(404).json({error:'Artist not found'}); res.json(tasksByArtist[a]||[]); });
app.post('/api/:artist/tasks',     (req,res)=>{ const a=req.params.artist; if(!artists.includes(a))return res.status(404).json({error:'Artist not found'}); nextTaskIdByArtist[a]=nextTaskIdByArtist[a]||1; const t={ id:nextTaskIdByArtist[a]++, title:req.body.title||'', date:req.body.date||new Date().toISOString() }; tasksByArtist[a]=tasksByArtist[a]||[]; tasksByArtist[a].push(t); res.status(201).json(t); });
app.delete('/api/:artist/tasks/:id',(req,res)=>{ const a=req.params.artist, id=+req.params.id; if(!artists.includes(a))return res.status(404).json({error:'Artist not found'}); tasksByArtist[a]=(tasksByArtist[a]||[]).filter(x=>x.id!==id); res.status(204).send(); });

// — Comments API
app.get ('/api/:artist/comments', (req,res)=>{ const a=req.params.artist; if(!artists.includes(a))return res.status(404).json({error:'Artist not found'}); res.json(commentsByArtist[a]||[]); });
app.post('/api/:artist/comments', (req,res)=>{ const a=req.params.artist; if(!artists.includes(a))return res.status(404).json({error:'Artist not found'}); commentsByArtist[a]=commentsByArtist[a]||[]; commentsByArtist[a].push(req.body); res.status(201).json(req.body); });

// — Calendar (Google OAuth2)
const oauth2Client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);
const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];
app.get('/auth/google', (req,res)=>{ res.redirect(oauth2Client.generateAuthUrl({ access_type:'offline', scope:SCOPES })); });
app.get('/oauth2callback', async (req,res)=>{ const { tokens } = await oauth2Client.getToken(req.query.code); res.cookie('google_tokens', JSON.stringify(tokens), { httpOnly:true }); res.redirect(`/admin/${artists[0]}/dashboard`); });
app.get('/api/:artist/calendar-events', async (req,res)=>{
  const a = req.params.artist;
  if (!artists.includes(a)) return res.status(404).json({error:'Artist not found'});
  const raw = req.cookies.google_tokens;
  if (!raw) return res.status(401).json({error:'Unauthorized'});
  oauth2Client.setCredentials(JSON.parse(raw));
  try {
    const cal  = google.calendar({version:'v3',auth:oauth2Client});
    const resp = await cal.events.list({ calendarId:'primary', timeMin:new Date().toISOString(), maxResults:10, singleEvents:true, orderBy:'startTime' });
    const items = resp.data.items||[];
    res.json(items.map(e=>({ summary:e.summary, start:e.start.dateTime||e.start.date, end:e.end.dateTime||e.end.date })));
  } catch(_) {
    res.status(500).json({error:'Failed to fetch events'});
  }
});

// — File uploads
const audioUpload = multer({ dest:path.join(__dirname,'uploads','audio') });
app.post('/api/:artist/upload-audio', audioUpload.single('file'), (req,res)=>{ if(!req.file) return res.status(400).json({error:'No file'}); res.status(201).json({ filename:req.file.filename, original:req.file.originalname }); });
const imgUpload = multer({ dest:path.join(__dirname,'uploads','images') });
app.post('/api/:artist/upload-image', imgUpload.single('file'), (req,res)=>{ if(!req.file) return res.status(400).json({error:'No file'}); res.status(201).json({ filename:req.file.filename, original:req.file.originalname }); });

// — List uploaded files
app.get('/api/:artist/audio-files', (req,res)=>{ const a=req.params.artist; if(!artists.includes(a)) return res.status(404).json({error:'Artist not found'}); fs.readdir(path.join(__dirname,'uploads','audio',a),(e,f)=>res.json(e?[]:f)); });
app.get('/api/:artist/image-files',(req,res)=>{ const a=req.params.artist; if(!artists.includes(a)) return res.status(404).json({error:'Artist not found'}); fs.readdir(path.join(__dirname,'uploads','images',a),(e,f)=>res.json(e?[]:f)); });

// — Coverflow API
app.get('/api/coverflow',(req,res)=>{ const p=path.join(__dirname,'data','coverflow.json'); if(!fs.existsSync(p)) fs.writeFileSync(p,'[]'); res.json(JSON.parse(fs.readFileSync(p))); });
app.post('/api/coverflow', express.json(), (req,res)=>{ const p=path.join(__dirname,'data','coverflow.json'); fs.writeFileSync(p, JSON.stringify(req.body,null,2)); res.json({status:'ok'}); });

// — 404 & error
app.use((req,res)=>res.status(404).send('Not found'));
app.use((err,req,res,next)=>{ console.error(err.stack); res.status(500).send('Server error'); });

// — start
app.listen(PORT,()=>logger.info(`Server listening on port ${PORT}`));
