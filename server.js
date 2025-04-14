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
  auth: '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' // explicitly replace with your generated GitHub PAT
});

// ✅ Redirect logic placed at the top
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
app.use(
  '/data',
  express.static(path.join(__dirname, 'data'), {
    setHeaders: (res, filePath) => {
      // Ensure no caching for files in /data
      res.setHeader('Cache-Control', 'no-store');
    }
  })
);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(
  '/admin',
  basicAuth({ users: { admin: 'password' }, challenge: true }),
  express.static(path.join(__dirname, 'admin'))
);
// Optional: Serve the public-preview folder at /preview
app.use('/preview', express.static(path.join(__dirname, 'public-preview')));

// Save a single cover
app.post('/save-cover', async (req, res) => {
  const updatedCover = req.body;
  console.log("🚀 Saving individual cover:", updatedCover.id);

  let covers = [];
  try {
    covers = JSON.parse(await fs.promises.readFile(path.join(__dirname, 'data', 'covers.json'), 'utf-8'));
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
    await fs.promises.writeFile(path.join(__dirname, 'data', 'covers.json'), JSON.stringify(covers, null, 2));
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
    await fs.promises.writeFile(path.join(__dirname, 'data', 'covers.json'), JSON.stringify(covers, null, 2));
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
    const covers = JSON.parse(await fs.promises.readFile(path.join(__dirname, 'data', 'covers.json'), 'utf-8'));
    const filtered = covers.filter(c => c.id.toString() !== id.toString());
    await fs.promises.writeFile(path.join(__dirname, 'data', 'covers.json'), JSON.stringify(filtered, null, 2));
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

  const stylesPath = path.join(__dirname, 'data', 'styles.json');
  const styles = JSON.parse(fs.readFileSync(stylesPath, 'utf-8'));
  if (!styles.fonts.includes(fontName)) styles.fonts.push(fontName);
  fs.writeFileSync(stylesPath, JSON.stringify(styles, null, 2));

  res.json({ success: true, fontName, fontPath });
});

// Save global style settings
app.post('/save-style-settings', (req, res) => {
  const styleFile = path.join(__dirname, 'data', 'styles.json');
  fs.writeFileSync(styleFile, JSON.stringify(req.body, null, 2));
  console.log("💾 Global styles saved.");
  res.json({ success: true });
});

// Push to test
app.post('/push-to-test', async (req, res) => {
  try {
    const covers = await fs.promises.readFile(path.join(__dirname, 'data', 'covers.json'));
    const styles = await fs.promises.readFile(path.join(__dirname, 'data', 'styles.json'));
    await fs.promises.writeFile(path.join(__dirname, 'data', 'covers-preview.json'), covers);
    await fs.promises.writeFile(path.join(__dirname, 'data', 'test-styles.json'), styles);
    console.log("🧪 Pushed covers + styles to test");
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Push failed:", err);
    res.status(500).json({ error: "Push failed" });
  }
});

// Save covers privately for preview
app.post('/save-preview-covers', async (req, res) => {
  const coversPreview = req.body;
  await fs.promises.writeFile(path.join(__dirname, 'data', 'covers-preview.json'), JSON.stringify(coversPreview, null, 2));
  res.json({ message: "✅ Preview covers saved." });
});

// Push live: update GitHub and local live file
app.post('/push-live', async (req, res) => {
  console.log("🔼 Received push-live request."); // Immediately at the top

  try {
    // Read preview data using an absolute path
    const previewData = await fs.promises.readFile(
      path.join(__dirname, 'data', 'covers-preview.json'),
      'utf-8'
    );
    console.log("✅ Preview data:", previewData); // After previewData is defined

    const owner = 'theobattaglia1';
    const repo = 'coverflow-data';
    const remoteFilePath = 'covers.json'; // Use a different variable name so it doesn't shadow the 'path' module

    // Retrieve the existing GitHub file to get its SHA
    const { data: existingFile } = await octokit.repos.getContent({
      owner,
      repo,
      path: remoteFilePath,
    });

    // Update the remote file on GitHub
    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: remoteFilePath,
      message: '✅ Push live update from Admin Panel',
      content: Buffer.from(previewData).toString('base64'),
      sha: existingFile.sha,
    });
    console.log("✅ Remote covers.json updated on GitHub."); // After GitHub update

    // Update the local covers.json file so the live site reads the new order
    await fs.promises.writeFile(
      path.join(__dirname, 'data', 'covers.json'),
      previewData
    );
    console.log("✅ Local covers.json updated with:", previewData); // After local file update

    return res.json({ message: "✅ Changes pushed live via GitHub and updated locally." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "❌ GitHub push failed.", details: err.message });
  }
});


// Fetch covers
app.get('/covers', async (req, res) => {
  try {
    const data = await fs.promises.readFile(path.join(__dirname, 'data', 'covers.json'), 'utf-8');
    res.json(JSON.parse(data));
  } catch (err) {
    console.error("❌ Failed to fetch covers:", err);
    res.status(500).json({ error: "Failed to fetch" });
  }
});

// Fetch styles
app.get('/styles', async (req, res) => {
  try {
    const data = await fs.promises.readFile(path.join(__dirname, 'data', 'styles.json'), 'utf-8');
    res.json(JSON.parse(data));
  } catch (err) {
    console.error("❌ Failed to fetch styles:", err);
    res.status(500).json({ error: "Failed to fetch" });
  }
});

// Fetch preview covers
app.get('/covers-preview', async (req, res) => {
  try {
    const data = await fs.promises.readFile(path.join(__dirname, 'data', 'covers-preview.json'), 'utf-8');
    res.json(JSON.parse(data));
  } catch (err) {
    console.error("❌ Failed to fetch preview covers:", err);
    res.status(500).json({ error: "Failed to fetch" });
  }
});

// Fetch fonts
app.get('/fonts', async (req, res) => {
  try {
    const data = await fs.promises.readFile(path.join(__dirname, 'data', 'styles.json'), 'utf-8');
    res.json(JSON.parse(data).fonts);
  } catch (err) {
    console.error("❌ Failed to fetch fonts:", err);
    res.status(500).json({ error: "Failed to fetch" });
  }
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
