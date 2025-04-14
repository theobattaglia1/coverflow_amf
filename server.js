const express = require('express');
const path = require('path');
const fs = require('fs');
const basicAuth = require('express-basic-auth');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

const app = express();
const port = 3000;

const { Octokit } = require("@octokit/rest");

const octokit = new Octokit({
  auth: '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' // Replace with secure token
});

// Redirect logic placed at the top
app.get('/', (req, res, next) => {
  const host = req.hostname;
  if (host.startsWith('admin.')) {
    return res.redirect(302, '/admin/dashboard.html');
  }
  next();
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/data', express.static(path.join(__dirname, 'public/data')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(
  '/admin',
  basicAuth({ users: { admin: 'password' }, challenge: true }),
  express.static(path.join(__dirname, 'admin'))
);

// Save a single cover
app.post('/save-cover', async (req, res) => {
  const updatedCover = req.body;
  console.log("🚀 Saving individual cover:", updatedCover.id);

  let covers = [];
  try {
    covers = JSON.parse(await fs.promises.readFile('./public/data/covers.json', 'utf-8'));
  } catch {
    console.warn("⚠️ Starting fresh (covers.json not found)");
  }

  const index = covers.findIndex(c => c.id.toString() === updatedCover.id.toString());
  if (index !== -1) {
    covers[index] = updatedCover;
  } else {
    covers.push(updatedCover);
  }

  try {
    await fs.promises.writeFile('./public/data/covers.json', JSON.stringify(covers, null, 2));
    console.log("✅ Cover saved.");
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Error saving cover:", err);
    res.status(500).json({ error: "Failed to save" });
  }
});

// Save full cover list (reorder)
app.post('/save-covers', async (req, res) => {
  const covers = req.body;
  if (!Array.isArray(covers)) return res.status(400).json({ error: "Invalid format" });

  console.log("💾 Reordering covers, count:", covers.length);
  try {
    await fs.promises.writeFile('./public/data/covers.json', JSON.stringify(covers, null, 2));
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Failed to save covers:", err);
    res.status(500).json({ error: "Write error" });
  }
});

// Delete cover
app.post('/delete-cover', async (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: "Missing cover ID" });

  try {
    const covers = JSON.parse(await fs.promises.readFile('./public/data/covers.json', 'utf-8'));
    const filtered = covers.filter(c => c.id.toString() !== id.toString());
    await fs.promises.writeFile('./public/data/covers.json', JSON.stringify(filtered, null, 2));
    console.log(`🗑️ Deleted cover ${id}`);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Failed to delete cover:", err);
    res.status(500).json({ error: "Delete error" });
  }
});

// Upload image
app.post('/upload-image', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
  const imageUrl = `/uploads/${req.file.filename}`;
  console.log("📸 Uploaded image:", imageUrl);
  res.json({ url: imageUrl });
});

// Upload font
app.post('/upload-font', upload.single('font'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No font uploaded' });

  const fontFileName = req.file.originalname;
  const fontName = path.parse(fontFileName).name.replace(/\s+/g, '-');
  const ext = path.extname(fontFileName).replace('.', '');
  const format = ext === 'woff2' ? 'woff2' : 'opentype';

  const fontPath = `/assets/fonts/${fontFileName}`;
  const fontDir = path.join(__dirname, 'public/assets/fonts');
  const target = path.join(fontDir, fontFileName);

  fs.mkdirSync(fontDir, { recursive: true });
  fs.renameSync(req.file.path, target);

  const cssRule = `
@font-face {
  font-family: '${fontName}';
  src: url('${fontPath}') format('${format}');
  font-weight: 400;
  font-style: normal;
}
`;
  fs.appendFileSync(path.join(__dirname, 'public/fonts.css'), cssRule);

  res.json({ success: true, fontName, fontPath });
});

// GitHub Push Live
app.post('/push-live', async (req, res) => {
  try {
    const previewData = await fs.promises.readFile('./public/data/covers-preview.json', 'utf-8');
    const owner = 'theobattaglia1';
    const repo = 'coverflow-data';
    const path = 'covers.json';

    const { data: existingFile } = await octokit.repos.getContent({ owner, repo, path });

    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message: '✅ Push live update from Admin Panel',
      content: Buffer.from(previewData).toString('base64'),
      sha: existingFile.sha,
    });

    res.json({ message: "✅ Changes pushed live via GitHub." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "❌ GitHub push failed.", details: err.message });
  }
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
