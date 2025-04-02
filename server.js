const express = require('express');
const path = require('path');
const fs = require('fs');
const basicAuth = require('express-basic-auth');
const multer = require('multer');

const app = express();
const port = 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/data', express.static(path.join(__dirname, 'data')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// Basic auth middleware for admin
app.use('/admin', basicAuth({
  users: { 'admin': 'password' },
  challenge: true,
}));

// Multer setup
const upload = multer({ dest: 'uploads/' });

// Routes
app.post('/save-covers', (req, res) => {
  fs.writeFileSync(path.join(__dirname, 'data/covers.json'), JSON.stringify(req.body, null, 2));
  res.json({ success: true });
});

// Image Upload route
app.post('/upload-image', upload.single('coverImage'), (req, res) => {
  res.json({ url: `/uploads/${req.file.filename}` });
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

