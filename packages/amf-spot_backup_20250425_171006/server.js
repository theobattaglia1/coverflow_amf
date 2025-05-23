const express = require('express');
const path = require('path');
const basicAuth = require('express-basic-auth');
const fs = require('fs');
const multer = require('multer');

// Configuration
const app = express();
require('./server/upload-audio')(app);
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logger
app.use((req, res, next) => {
  console.log(`[Server] ${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// File uploads
const upload = multer({ dest: 'uploads/' });

// Static routes BEFORE auth
app.use('/:artist/dashboard', express.static(path.join(__dirname, 'public/partner/dashboard')));
app.use('/audio', express.static(path.join(__dirname, 'public/audio')));

// Audio API
app.get('/api/:artist/audio-files', (req, res) => {
  const artist = req.params.artist;
  console.log(`[Server] Handling audio files request for artist: ${artist}`);
  res.json({
    artist,
    files: [
      { id: 1, title: 'Do You Remember?', artist: 'AMF Studio', duration: '3:42', url: '/audio/do-you-remember.m4a' },
      { id: 2, title: 'Get Out Of Town', artist: 'AMF Studio', duration: '4:15', url: '/audio/getoutoftown.v1.m4a' },
      { id: 3, title: 'linger-v1.m4a', artist: 'AMF Studio', duration: '3:28', url: '/audio/linger-v1.m4a' },
      { id: 4, title: 'Real Life', artist: 'AMF Studio', duration: '5:10', url: '/audio/real-life.wav' },
      { id: 5, title: 'Texas', artist: 'AMF Studio', duration: '3:55', url: '/audio/texas.m4a' }
    ]
  });
});

// Comments API
app.get('/api/:artist/track-comments', (req, res) => {
  res.json({
    artist: req.params.artist,
    comments: []
  });
});

app.post('/api/:artist/track-comments', (req, res) => {
  console.log('[Server] Received comments:', req.body);
  res.json({ success: true });
});

// Showcase fallback
app.get('/api/:artist/showcase', (req, res) => {
  console.log(`[Server] Serving fallback showcase for ${req.params.artist}`);
  res.json({
    artist: req.params.artist,
    media: [
      {
        type: 'image',
        title: 'Fallback Image',
        src: 'https://allmyfriendsinc.com/uploads/444a59dfe2a66aa5224c7038f7539b15'
      },
      {
        type: 'video',
        title: 'Fallback Video',
        src: 'https://www.youtube.com/watch?v=Qb9ljnyTxoM'
      },
      {
        type: 'image',
        title: 'Artwork A',
        src: 'https://allmyfriendsinc.com/uploads/444a59dfe2a66aa5224c7038f7539b15'
      }
    ]
  });
});

// Admin auth + route
const adminAuth = basicAuth({
  users: { admin: 'password' },
  challenge: true,
  realm: 'AMF Admin Area'
});

app.use('/admin', adminAuth);
app.use('/admin/:artist/dashboard', express.static(path.join(__dirname, 'public/admin/dashboard')));

// Catch-all
app.use((req, res) => {
  console.log(`[Server] 404 - Route not found: ${req.url}`);
  res.status(404).send('Not Found');
});

// Start server
app.listen(PORT, () => {
  console.log(`[Server] Server running on port ${PORT}`);
});
