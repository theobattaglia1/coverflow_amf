const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const basicAuth = require('express-basic-auth');

const app = express();
const port = 3000;

app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/data', express.static(path.join(__dirname, 'data')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));

app.use('/admin', basicAuth({
  users: { 'admin': 'your_secure_password' },
  challenge: true
}));

const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

app.post('/upload', upload.single('image'), (req, res) => {
  res.json({ path: `/uploads/${req.file.filename}` });
});

app.post('/save-covers', (req, res) => {
  fs.writeFileSync(path.join(__dirname, 'data/covers.json'), JSON.stringify(req.body, null, 2));
  res.json({ success: true });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

