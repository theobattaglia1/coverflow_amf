// Script to update server.js with proper audio endpoint
const fs = require('fs');
const path = require('path');

// Define server.js path
const serverPath = path.join('/Users/theobattaglia/Sites/coverflow_amf/packages/amf-spot/server.js');

// Check if server file exists
if (!fs.existsSync(serverPath)) {
  console.error('Server file not found:', serverPath);
  process.exit(1);
}

// Read server content
let serverContent = fs.readFileSync(serverPath, 'utf8');

// Check if audio-files endpoint is already properly defined
if (!serverContent.includes('app.get(\'/api/:artist/audio-files\'')) {
  console.log('Adding audio-files endpoint to server.js');
  
  // Find a place to insert the endpoint - after another API endpoint
  const insertPoint = serverContent.indexOf('app.get(\'/api/:artist/');
  if (insertPoint !== -1) {
    const endPoint = serverContent.indexOf('});', insertPoint) + 3;
    
    const audioEndpoint = `

app.get('/api/:artist/audio-files', (req, res) => {
  const artist = req.params.artist;
  console.log(\`[Server] Handling audio files for artist: \${artist}\`);
  
  // Return audio data
  res.json({
    artist,
    files: [
      { id: 1, title: 'Demo Track 1', url: '/audio/track1.mp3', duration: '3:45', artist: 'Artist Name' },
      { id: 2, title: 'Demo Track 2', url: '/audio/track2.mp3', duration: '2:58', artist: 'Artist Name' },
      { id: 3, title: 'Demo Track 3', url: '/audio/track3.mp3', duration: '4:12', artist: 'Artist Name' },
      { id: 4, title: 'Demo Track 4', url: '/audio/track4.mp3', duration: '3:24', artist: 'Artist Name' }
    ]
  });
});`;
    
    // Insert at the identified location
    serverContent = serverContent.slice(0, endPoint) + audioEndpoint + serverContent.slice(endPoint);
    
    // Save updated server.js
    fs.writeFileSync(serverPath, serverContent);
    console.log('Audio-files endpoint added successfully!');
  } else {
    console.error('Could not find appropriate insert location in server.js');
  }
} else {
  console.log('Audio-files endpoint already exists in server.js');
}

console.log('Server update complete!');
