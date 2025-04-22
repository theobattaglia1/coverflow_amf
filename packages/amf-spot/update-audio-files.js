// Updated audio files endpoint to match your actual files
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
