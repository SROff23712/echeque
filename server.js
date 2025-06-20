const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const server = http.createServer((req, res) => {
  fs.readFile(path.join(__dirname, 'index.html'), (err, data) => {
    if (err) {
      res.writeHead(500);
      res.end('Erreur serveur');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(data);
  });
});

const wss = new WebSocket.Server({ server });
let players = {};     // { w: ws, b: ws }
let profiles = {};    // { w: {}, b: {} }

function broadcastPlayers() {
  const data = JSON.stringify({
    type: 'players',
    players: {
      w: profiles.w || null,
      b: profiles.b || null
    }
  });
  wss.clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) ws.send(data);
  });
}

wss.on('connection', ws => {
  ws.on('message', message => {
    const data = JSON.parse(message);

    if (data.type === 'login') {
      const emailUsed = Object.values(profiles).some(p => p?.email === data.profile.email);
      if (emailUsed) return;

      const slot = !players.w ? 'w' : !players.b ? 'b' : null;
      if (!slot) return ws.send(JSON.stringify({ type: 'error', message: 'Partie pleine' }));

      players[slot] = ws;
      profiles[slot] = data.profile;
      ws.slot = slot;

      broadcastPlayers();

      if (players.w && players.b) {
        players.w.send(JSON.stringify({ type: 'start', color: 'w' }));
        players.b.send(JSON.stringify({ type: 'start', color: 'b' }));
      }
    }

    if (data.type === 'move') {
      const other = ws.slot === 'w' ? 'b' : 'w';
      if (players[other] && players[other].readyState === WebSocket.OPEN) {
        players[other].send(JSON.stringify({ type: 'move', move: data.move }));
      }
    }
  });

  ws.on('close', () => {
    if (ws.slot) {
      delete players[ws.slot];
      delete profiles[ws.slot];
      broadcastPlayers();
    }
  });
});

server.listen(3000, () => {
  console.log('Serveur Web + WS lancé sur http://localhost:3000');
});
