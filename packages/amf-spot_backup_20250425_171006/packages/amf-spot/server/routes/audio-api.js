function sanitizeFileName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/-+/g, '-');
}

app.get('/api/:artist/audio-files', async (req, res) => {
  const files = await getAudioFiles(req.params.artist);

  const sanitizedFiles = files.map(file => ({
    ...file,
    url: `/audio/${sanitizeFileName(file.originalName)}`
  }));

  res.json({ artist: req.params.artist, files: sanitizedFiles });
});
