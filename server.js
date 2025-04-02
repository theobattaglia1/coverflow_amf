const express = require('express');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');

const app = express();
const port = 3000;

app.use(bodyParser.json());

app.use(express.static(path.join(__dirname, 'public')));
app.use('/data', express.static(path.join(__dirname, 'data')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));

app.post('/save-covers', (req, res) => {
  fs.writeFileSync(path.join(__dirname, 'data/covers.json'), JSON.stringify(req.body, null, 2));
  res.json({ success: true });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

