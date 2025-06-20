const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const HOST = '25.22.67.100';
const PORT = 3000;
const server = http.createServer((req,res) => {
  fs.readFile(path.join(__dirname,'index.html'), (e,d) => {
    if (e) return res.writeHead(500).end('Erreur serveur');
    res.writeHead(200, { 'Content-Type':'text/html' });
    res.end(d);
  });
});

const wss = new WebSocket.Server({ server });
let players = {}; // { w: ws, b: ws }
let profiles = {};

function broadcastPlayers() {
  wss.clients.forEach(ws => {
    ws.send(JSON.stringify({ type:'players', players:{
      w: profiles.w, b: profiles.b
    }}));
  });
}

wss.on('connection', ws => {
  ws.on('message', msg => {
    const data = JSON.parse(msg);
    if (data.type === 'login') {
      if (Object.values(profiles).some(p=>p.email === data.profile.email)) return;
      const slot = !profiles.w ? 'w' : !profiles.b ? 'b' : null;
      if (!slot) return ws.close();
      profiles[slot] = data.profile;
      players[slot] = ws;
      ws.slot = slot;
      broadcastPlayers();
      if (profiles.w && profiles.b) {
        players.w.send(JSON.stringify({ type:'start', color:'w' }));
        players.b.send(JSON.stringify({ type:'start', color:'b' }));
      }
    }
    if (data.type === 'move' && ws.slot && players) {
      const other = ws.slot === 'w' ? 'b' : 'w';
      if (players[other]?.readyState === WebSocket.OPEN)
        players[other].send(JSON.stringify({ type:'move', move:data.move }));
    }
  });

  ws.on('close', () => {
    if (ws.slot) {
      delete profiles[ws.slot];
      delete players[ws.slot];
      broadcastPlayers();
    }
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Serveur lancé sur http://${HOST}:${PORT}`);
});
