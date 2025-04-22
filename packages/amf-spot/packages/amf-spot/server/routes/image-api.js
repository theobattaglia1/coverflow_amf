function sanitizeFileName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/-+/g, '-');
}

app.get('/api/:artist/image-files', async (req, res) => {
  const files = await getImageFiles(req.params.artist);

  const sanitizedFiles = files.map(file => sanitizeFileName(file));
  res.json({ artist: req.params.artist, files: sanitizedFiles });
});
