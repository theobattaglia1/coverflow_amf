// Add this line after your existing static file middleware
// This will serve audio files from the public/audio directory
app.use('/audio', express.static(path.join(__dirname, 'public/audio')));

// And make sure your audio-files endpoint returns your actual files
app.get('/api/:artist/audio-files', (req, res) => {
  const artist = req.params.artist;
  console.log(`[Server] Handling audio files request for artist: ${artist}`);
  
  try {
    // Return data for your actual audio files
    res.json({
      artist,
      files: [
        { id: 1, title: 'Do You Remember?', artist: 'AMF Studio', duration: '3:42', url: '/audio/DO YOU REMEMBER?.m4a', playlist: 'showcase' },
        { id: 2, title: 'Get Out Of Town', artist: 'AMF Studio', duration: '4:15', url: '/audio/GetOutOfTown.V1.m4a', playlist: 'showcase' },
        { id: 3, title: 'Linger', artist: 'AMF Studio', duration: '3:28', url: '/audio/Linger v1.m4a', playlist: 'showcase' },
        { id: 4, title: 'Real Life', artist: 'AMF Studio', duration: '5:10', url: '/audio/REAL LIFE.wav', playlist: 'showcase' },
        { id: 5, title: 'Texas', artist: 'AMF Studio', duration: '3:55', url: '/audio/TEXAS.m4a', playlist: 'showcase' }
      ]
    });
  } catch (error) {
    console.error('[Server] Error handling audio files request:', error);
    res.status(500).json({ error: 'Failed to load audio files' });
  }
});
