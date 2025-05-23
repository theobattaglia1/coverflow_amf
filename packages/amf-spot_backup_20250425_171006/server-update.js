// 1. REPLACE your current audio-files route with this enhanced version:
app.get('/api/:artist/audio-files', (req, res) => {
  const artist = req.params.artist;
  console.log(`[Server] Handling audio files request for artist: ${artist}`);
  
  try {
    // In a real implementation, you'd fetch this from a database
    // For now, we'll return placeholder data
    res.json({
      artist,
      files: [
        { id: 1, title: 'Twilight Horizon', artist: 'AMF Studio', duration: '3:42', url: '/audio/track1.mp3', playlist: 'showcase' },
        { id: 2, title: 'Neon Dreams', artist: 'AMF Studio', duration: '4:15', url: '/audio/track2.mp3', playlist: 'showcase' },
        { id: 3, title: 'Midnight Echo', artist: 'AMF Studio', duration: '3:28', url: '/audio/track3.mp3', playlist: 'showcase' },
        { id: 4, title: 'Electric Soul', artist: 'AMF Studio', duration: '5:10', url: '/audio/track4.mp3', playlist: 'showcase' },
        { id: 5, title: 'Summer Nights', artist: 'AMF Studio', duration: '3:55', url: '/audio/track5.mp3', playlist: 'archive' },
        { id: 6, title: 'Urban Flow', artist: 'AMF Studio', duration: '4:22', url: '/audio/track6.mp3', playlist: 'archive' },
        { id: 7, title: 'Crystal Clear', artist: 'AMF Studio', duration: '3:18', url: '/audio/track7.mp3', playlist: 'singles' },
        { id: 8, title: 'Future Waves', artist: 'AMF Studio', duration: '4:02', url: '/audio/track8.mp3', playlist: 'singles' }
      ]
    });
  } catch (error) {
    console.error('[Server] Error handling audio files request:', error);
    res.status(500).json({ error: 'Failed to load audio files' });
  }
});

// 2. ADD these new track-comments routes after your image-files endpoint 
// and before the admin auth middleware:

app.get('/api/:artist/track-comments', (req, res) => {
  const artist = req.params.artist;
  console.log(`[Server] Handling track comments request for artist: ${artist}`);
  
  try {
    // In a real implementation, you'd fetch this from a database
    // For now, we'll return placeholder data
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
    // In a real implementation, you'd save this to a database
    // For now, we'll just return success
    console.log('[Server] Received comments data:', req.body);
    res.json({ success: true });
  } catch (error) {
    console.error('[Server] Error handling save comments request:', error);
    res.status(500).json({ error: 'Failed to save comments' });
  }
});
