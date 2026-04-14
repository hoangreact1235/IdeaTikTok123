const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });
console.log(`Loaded environment from ${envPath}`);

const ideasRouter = require('./routes/ideas');
const scriptsRouter = require('./routes/scripts');
const scheduleRouter = require('./routes/schedule');

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.use('/api/ideas', ideasRouter);
app.use('/api/scripts', scriptsRouter);
app.use('/api/schedule', scheduleRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'TikTok Idea Manager API' });
});

const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'API endpoint not found.' });
    }
    return res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
}

app.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
});
