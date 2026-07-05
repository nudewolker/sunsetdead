// SUNSET DEAD v36 SHARED WORLD SERVER
// Render.com compatible. WebSocket endpoint: wss://YOUR-APP.onrender.com
const http = require('http');
const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('SUNSET DEAD v36 shared world server is running. Use wss://YOUR-APP.onrender.com in the game.\n');
});
const wss = new WebSocket.Server({ server });
const rooms = new Map();
let nextId = 1;

function getRoom(name) {
  name = String(name || 'sunset').slice(0, 40);
  if (!rooms.has(name)) rooms.set(name, { clients: new Set(), hostId: null, lastWorld: null });
  return rooms.get(name);
}
function send(ws, obj) { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj)); }
function broadcast(room, obj, except=null) { for (const c of room.clients) if (c !== except) send(c, obj); }
function chooseHost(room) {
  const old = room.hostId;
  if (!room.hostId || ![...room.clients].some(c => c.id === room.hostId)) {
    const first = [...room.clients][0];
    room.hostId = first ? first.id : null;
  }
  if (room.hostId && room.hostId !== old) broadcast(room, { type:'hostChanged', hostId: room.hostId });
}
function findHost(room) { return [...room.clients].find(c => c.id === room.hostId); }

wss.on('connection', ws => {
  ws.id = nextId++;
  ws.roomName = null;
  send(ws, { type:'hello', id: ws.id });

  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    if (msg.type === 'join') {
      if (ws.roomName) getRoom(ws.roomName).clients.delete(ws);
      ws.roomName = String(msg.room || 'sunset').slice(0, 40);
      const room = getRoom(ws.roomName);
      room.clients.add(ws);
      chooseHost(room);
      send(ws, { type:'welcome', id: ws.id, room: ws.roomName, host: room.hostId === ws.id, hostId: room.hostId });
      broadcast(room, { type:'hostChanged', hostId: room.hostId });
      if (room.lastWorld) send(ws, { type:'worldState', world: room.lastWorld });
      console.log('join', ws.id, 'room', ws.roomName, 'host', room.hostId, 'players', room.clients.size);
      return;
    }

    if (!ws.roomName) return;
    const room = getRoom(ws.roomName);

    if (msg.type === 'state') {
      broadcast(room, { type:'peerState', id: ws.id, state: msg.state || {} }, ws);
      return;
    }

    if (msg.type === 'worldState') {
      if (room.hostId !== ws.id) return;
      room.lastWorld = msg.world || null;
      broadcast(room, { type:'worldState', world: room.lastWorld }, ws);
      return;
    }

    if (msg.type === 'hitZombie') {
      const host = findHost(room);
      if (host && host !== ws) send(host, { type:'hitZombie', id: msg.id, damage: msg.damage, source: msg.source, hitX: msg.hitX, hitZ: msg.hitZ, from: ws.id });
      return;
    }

    if (msg.type === 'worldAction') {
      const host = findHost(room);
      if (host && host !== ws) send(host, { type:'worldAction', from: ws.id, action: msg.action || {} });
      else if (host === ws) send(ws, { type:'worldAction', from: ws.id, action: msg.action || {} });
      return;
    }
  });

  ws.on('close', () => {
    if (!ws.roomName) return;
    const room = getRoom(ws.roomName);
    room.clients.delete(ws);
    if (room.clients.size === 0) { rooms.delete(ws.roomName); return; }
    chooseHost(room);
  });
});

server.listen(PORT, () => console.log('SUNSET DEAD v36 shared world server listening on port ' + PORT));
