// SUNSET DEAD - Basit Online Relay Sunucusu
// Görevi: oyuncuları "oda" (room) bazında eşleştirip
// birinin state mesajını odadaki diğer oyunculara iletmek.

const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

let nextId = 1;
// room adı -> Set<ws>
const rooms = new Map();

function getRoom(name) {
  if (!rooms.has(name)) rooms.set(name, new Set());
  return rooms.get(name);
}

wss.on('connection', (ws) => {
  ws.id = nextId++;
  ws.room = null;

  ws.on('message', (raw) => {
    let data;
    try { data = JSON.parse(raw); } catch (e) { return; }

    if (data.type === 'join') {
      const roomName = String(data.room || 'sunset');
      ws.room = roomName;
      getRoom(roomName).add(ws);
      ws.send(JSON.stringify({ type: 'welcome', id: ws.id }));
      return;
    }

    if (data.type === 'state' && ws.room) {
      const peers = getRoom(ws.room);
      const payload = JSON.stringify({ type: 'peerState', id: ws.id, state: data.state });
      for (const peer of peers) {
        if (peer !== ws && peer.readyState === WebSocket.OPEN) {
          peer.send(payload);
        }
      }
    }
  });

  ws.on('close', () => {
    if (ws.room && rooms.has(ws.room)) {
      rooms.get(ws.room).delete(ws);
      if (rooms.get(ws.room).size === 0) rooms.delete(ws.room);
    }
  });
});

console.log('SUNSET DEAD relay sunucusu ' + PORT + ' portunda çalışıyor.');
