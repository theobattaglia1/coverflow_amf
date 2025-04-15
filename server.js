import express from 'express';
import path from 'path';
import fs from 'fs';
import basicAuth from 'express-basic-auth';
import multer from 'multer';
import { Octokit } from '@octokit/rest';

const app = express();
const port = 3000;

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

// Multer configuration
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${Date.now()}${ext}`);
  }
});
const upload = multer({ storage });

// ESM replacement for __dirname
const __dirname = path.dirname(new URL(import.meta.url).pathname);

// Redirect logic
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
app.use('/data', express.static(path.join(__dirname, 'data'), {
  setHeaders: (res) => res.setHeader('Cache-Control', 'no-store')
}));
app.use('/uploads', express.static(path.resolve(__dirname, './uploads'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg');
    } else if (filePath.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    } else if (filePath.endsWith('.gif')) {
      res.setHeader('Content-Type', 'image/gif');
    } else if (filePath.endsWith('.svg')) {
      res.setHeader('Content-Type', 'image/svg+xml');
    }
    res.setHeader('Cache-Control', 'no-store');
  }
}));
app.use('/admin', basicAuth({ users: { admin: 'password' }, challenge: true }), express.static(path.join(__dirname, 'admin')));
app.use('/preview', express.static(path.join(__dirname, 'public-preview')));

app.post('/save-cover', async (req, res) => {
  const updatedCover = req.body;
  console.log("🚀 [START] Received request to save cover ID:", updatedCover.id);
  console.log("📥 Payload received:", JSON.stringify(updatedCover, null, 2));

  let covers = [];
  const coversFilePath = path.join(__dirname, 'data', 'covers.json');

  try {
    const fileData = await fs.promises.readFile(coversFilePath, 'utf-8');
    covers = JSON.parse(fileData);
    console.log("✅ Loaded existing covers from covers.json");
  } catch (err) {
    console.warn("⚠️ covers.json not found, starting fresh:", err);
  }

  const index = covers.findIndex(c => c.id.toString() === updatedCover.id.toString());
  if (index !== -1) {
    console.log(`🔄 Updating existing cover at index ${index}`);
    covers[index] = updatedCover;
  } else {
    console.log("🆕 Adding new cover");
    covers.push(updatedCover);
  }

  try {
    await fs.promises.writeFile(coversFilePath, JSON.stringify(covers, null, 2));
    console.log("✅ Cover saved locally.");

    const owner = 'theobattaglia1';
    const repo = 'coverflow_amf';
    const pathOnRepo = 'covers.json';

    const { data: existingFile } = await octokit.repos.getContent({ owner, repo, path: pathOnRepo });
    
    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: pathOnRepo,
      message: `✅ Automated push from Admin Panel (cover ID: ${updatedCover.id})`,
      content: Buffer.from(JSON.stringify(covers, null, 2)).toString('base64'),
      sha: existingFile.sha,
    });

    console.log("🚀 Successfully pushed changes to GitHub.");

    res.json({ success: true, message: "Cover saved and pushed live successfully!" });

  } catch (err) {
    console.error("❌ GitHub push failed:", err);
    return res.status(500).json({
      error: "GitHub push failed",
      details: err.message,
      githubError: err
    });
  }
});

// Full Cover List Save (Reorder)
app.post('/save-covers', async (req, res) => {
  const covers = req.body;
  if (!Array.isArray(covers)) {
    return res.status(400).json({ error: "Invalid format" });
  }

  console.log("💾 Reordering covers (preview), count:", covers.length);
  try {
    await fs.promises.writeFile(path.join(__dirname, 'data', 'covers.json'), JSON.stringify(covers, null, 2));
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Failed to save covers:", err);
    res.status(500).json({ error: "Write error" });
  }
});

// Delete Cover
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

// Save global styles
app.post('/save-style-settings', (req, res) => {
  const styleFile = path.join(__dirname, 'data', 'styles.json');
  fs.writeFileSync(styleFile, JSON.stringify(req.body, null, 2));
  res.json({ success: true });
});

// Push to Test
app.post('/push-to-test', async (req, res) => {
  try {
    const covers = await fs.promises.readFile(path.join(__dirname, 'data', 'covers.json'));
    const styles = await fs.promises.readFile(path.join(__dirname, 'data', 'styles.json'));
    await fs.promises.writeFile(path.join(__dirname, 'data', 'test-styles.json'), styles);
    console.log("🧪 Pushed covers + styles to test");
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Push to test failed:", err);
    res.status(500).json({ error: "Push failed" });
  }
});

// Push Live
app.post('/push-live', async (req, res) => {
  try {
    const coversData = await fs.promises.readFile(path.join(__dirname, 'data', 'covers.json'), 'utf-8');
    const owner = 'theobattaglia1';
    const repo = 'coverflow_amf';
    const pathOnRepo = 'covers.json';
    const { data: existingFile } = await octokit.repos.getContent({ owner, repo, path: pathOnRepo });
    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: pathOnRepo,
      message: '✅ Push live from Admin Panel',
      content: Buffer.from(coversData).toString('base64'),
      sha: existingFile.sha,
    });
    // Optionally write back to covers.json (if needed)
    await fs.promises.writeFile(path.join(__dirname, 'data', 'covers.json'), coversData);
    console.log("✅ Changes pushed live");
    res.json({ message: "✅ Changes pushed live" });
  } catch (err) {
    console.error("❌ GitHub push failed:", err);
    res.status(500).json({ error: "GitHub push failed." });
  }
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
