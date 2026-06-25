const path = require('path');
const fs = require('fs');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { initGameManager } = require('./gameManager');

const app = express();
const isProduction = process.env.NODE_ENV === 'production'
  || fs.existsSync(path.join(__dirname, '../frontend/dist/index.html'));
const clientOrigin = process.env.CLIENT_ORIGIN || (isProduction ? false : '*');

app.use(cors({
  origin: clientOrigin,
}));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: clientOrigin || true,
    methods: ['GET', 'POST'],
  },
});

initGameManager(io);

const distPath = path.join(__dirname, '../frontend/dist');

if (isProduction) {
  app.use(express.static(distPath));

  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/socket.io')) {
      next();
      return;
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send('Grid Tactics API. Запусти frontend отдельно.');
  });
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Сервер слушает порт ${PORT}`);
});
