const express = require('express');
const path = require('path');
const basicAuth = require('express-basic-auth');
const fs = require('fs');
const multer = require('multer');

// Configuration
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logger middleware
const logger = (req, res, next) => {
  console.log(`[Server] ${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
};
app.use(logger);

// Setup multer for file uploads
const upload = multer({ dest: 'uploads/' });

// IMPORTANT: Public routes BEFORE admin auth middleware
// Serve static files for partner dashboard
app.use('/:artist/dashboard', express.static(path.join(__dirname, 'public/partner/dashboard')));

// Serve audio files
app.use('/audio', express.static(path.join(__dirname, 'public/audio')));

// API routes for partner dashboard (public routes)
app.get('/api/:artist/calendar-events', (req, res) => {
  const artist = req.params.artist;
  console.log(`[Server] Calendar events for artist: ${artist}`);
  
  // Return dummy data
  res.json({ 
    artist, 
    events: [
      { id: 1, title: 'Concert', date: '2023-06-15' },
      { id: 2, title: 'Recording', date: '2023-06-20' }
    ] 
  });
});

app.get('/api/:artist/tasks', (req, res) => {
  const artist = req.params.artist;
  console.log(`[Server] Tasks for artist: ${artist}`);
  
  // Return dummy data
  res.json({ 
    artist, 
    tasks: [
      { id: 1, title: 'Prepare setlist', completed: false },
      { id: 2, title: 'Confirm venue', completed: true }
    ] 
  });
});

app.get('/api/:artist/comments', (req, res) => {
  const artist = req.params.artist;
  console.log(`[Server] Comments for artist: ${artist}`);
  
  // Return dummy data
  res.json({ 
    artist, 
    comments: [
      { id: 1, text: 'Great show last night!', author: 'Manager' },
      { id: 2, text: 'New track sounds amazing', author: 'Producer' }
    ] 
  });
});

app.get('/api/:artist/audio-files', (req, res) => {
  const artist = req.params.artist;
  console.log(`[Server] Handling audio files request for artist: ${artist}`);
  
  try {
    // Return data for your actual audio files
    res.json({
      artist,
      files: [
        { id: 1, title: 'Do You Remember?', artist: 'AMF Studio', duration: '3:42', url: '/audio/do-you-remember.m4a YOU REMEMBER.m4a', playlist: 'showcase' },
        { id: 2, title: 'Get Out Of Town', artist: 'AMF Studio', duration: '4:15', url: '/audio/getoutoftown.v1.m4a', playlist: 'showcase' },
        { id: 3, title: 'linger-v1.m4a', artist: 'AMF Studio', duration: '3:28', url: '/audio/linger-v1.m4a v1.m4a', playlist: 'showcase' },
        { id: 4, title: 'Real Life', artist: 'AMF Studio', duration: '5:10', url: '/audio/real-life.wav LIFE.wav', playlist: 'showcase' },
        { id: 5, title: 'Texas', artist: 'AMF Studio', duration: '3:55', url: '/audio/texas.m4a', playlist: 'showcase' }
      ]
    });
  } catch (error) {
    console.error('[Server] Error handling audio files request:', error);
    res.status(500).json({ error: 'Failed to load audio files' });
  }
});

app.get('/api/:artist/image-files', (req, res) => {
  const artist = req.params.artist;
  console.log(`[Server] Image files for artist: ${artist}`);
  
  // Return dummy data
  res.json({ 
    artist, 
    files: [
      { id: 1, title: 'Promo Photo', url: 'https://allmyfriendsinc.com/uploads/444a59dfe2a66aa5224c7038f7539b15' },
      { id: 2, title: 'Album Cover', url: 'https://allmyfriendsinc.com/uploads/444a59dfe2a66aa5224c7038f7539b15' }
    ] 
  });
});

// API routes for track comments
app.get('/api/:artist/track-comments', (req, res) => {
  const artist = req.params.artist;
  console.log(`[Server] Handling track comments request for artist: ${artist}`);
  
  try {
    // Return placeholder comment data
    res.json({
      artist,
      comments: [
        {
          id: 1,
          trackId: 1,
          author: 'Producer',
          date: '2025-04-10T14:22:00Z',
          text: 'Great melody, but we might need to adjust the bass levels a bit.',
          timestamp: 45.5
        },
        {
          id: 2,
          trackId: 1,
          author: 'Marketing',
          date: '2025-04-12T10:15:00Z',
          text: 'Love the transition here, this would be perfect for the video intro!',
          timestamp: 92.3
        },
        {
          id: 3,
          trackId: 2,
          author: 'Producer',
          date: '2025-04-15T16:30:00Z',
          text: 'The synth progression here is amazing!'
        }
      ]
    });
  } catch (error) {
    console.error('[Server] Error handling track comments request:', error);
    res.status(500).json({ error: 'Failed to load track comments' });
  }
});

app.post('/api/:artist/track-comments', (req, res) => {
  const artist = req.params.artist;
  console.log(`[Server] Handling save comments request for artist: ${artist}`);
  
  try {
    // Log the received comments data
    console.log('[Server] Received comments data:', req.body);
    res.json({ success: true });
  } catch (error) {
    console.error('[Server] Error handling save comments request:', error);
    res.status(500).json({ error: 'Failed to save comments' });
  }
});

// Admin auth middleware - AFTER the public routes
const adminAuth = basicAuth({
  users: { 'admin': 'password' },
  challenge: true,
  realm: 'AMF Admin Area'
});

// Apply basic auth only to admin routes
app.use('/admin', adminAuth);

// Admin routes - protected by basic auth
app.use('/admin/:artist/dashboard', express.static(path.join(__dirname, 'public/admin/dashboard')));

// Catch-all for undefined routes
app.use((req, res) => {
  console.log(`[Server] 404 - Route not found: ${req.url}`);
  res.status(404).send('Not Found');
});

// Error handler
app.use((err, req, res, next) => {
  console.error(`[Server] Error: ${err.stack}`);
  res.status(500).send('Something broke!');
});

// Start the server
app.listen(PORT, () => {
  console.log(`[Server] Server running on port ${PORT}`);
});
