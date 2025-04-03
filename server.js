const express = require('express');
const path = require('path');
const fs = require('fs');
const basicAuth = require('express-basic-auth');

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/data', express.static(path.join(__dirname, 'data')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/admin', basicAuth({ users: { 'admin': 'password' }, challenge: true }), express.static(path.join(__dirname, 'admin')));

app.post('/save-cover', async (req, res) => {
  const updatedCover = req.body;
  let covers = JSON.parse(await fs.promises.readFile('./data/covers.json', 'utf-8'));

  if (updatedCover.id) {
    covers = covers.map(cover =>
      cover.id.toString() === updatedCover.id.toString() ? { ...cover, ...updatedCover } : cover
    );
  } else {
    updatedCover.id = Date.now().toString();
    covers.push(updatedCover);
  }

  await fs.promises.writeFile('./data/covers.json', JSON.stringify(covers, null, 2));
  res.json({ success: true });
});

app.post('/delete-cover', async (req, res) => {
  const { id } = req.body;
  let covers = JSON.parse(await fs.promises.readFile('./data/covers.json', 'utf-8'));
  covers = covers.filter(cover => cover.id.toString() !== id.toString());
  await fs.promises.writeFile('./data/covers.json', JSON.stringify(covers, null, 2));
  res.json({ success: true });
});

app.listen(port, () => console.log(`Server running at http://localhost:${port}`));
