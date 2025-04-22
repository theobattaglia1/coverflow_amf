const path = require('path');
const multer = require('multer');

function sanitizeFileName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/-+/g, '-');
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/audio');
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext);
    const clean = sanitizeFileName(base) + ext.toLowerCase();
    cb(null, clean);
  }
});

const upload = multer({ storage });

module.exports = function (app) {
  app.post('/upload/audio', upload.single('audio'), (req, res) => {
    res.json({ uploaded: true, file: req.file.filename });
  });
};
