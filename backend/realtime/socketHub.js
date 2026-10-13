import { WebSocketServer, WebSocket } from 'ws';
import { verify, cleanup } from '../services/authService.js';
import { config } from '../config/env.js';

let hub;
const send = (socket, event, data) => {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ event, data }));
};
export function emit(event, data, uid = null) {
  for (const socket of hub?.clients || []) {
    if (!socket.token) continue;
    try {
      const user = verify(socket.token);
      if (uid === null || uid === user) send(socket, event, data);
    } catch {
      socket.close(1008);
    }
  }
}
export function attachSocketHub(server) {
  hub = new WebSocketServer({
    server,
    path: '/ws',
    maxPayload: 4096,
    verifyClient: ({ origin }) => !origin || config.origins.includes(origin),
  });
  hub.on('connection', (socket) => {
    socket.opened = Date.now();
    socket.on('error', () => {});
    socket.on('message', (bytes) => {
      try {
        const { token } = JSON.parse(bytes.toString());
        verify(token);
        socket.token = token;
        send(socket, 'connected', { authenticated: true });
      } catch {
        socket.close(1008);
      }
    });
  });
  const timer = setInterval(() => {
    cleanup();
    for (const socket of hub.clients) {
      try {
        if (!socket.token) {
          if (Date.now() - socket.opened >= 10000) socket.close(1008);
        } else {
          verify(socket.token);
          send(socket, 'heartbeat', {});
        }
      } catch {
        socket.close(1008);
      }
    }
  }, 10000);
  timer.unref();
  return () => {
    clearInterval(timer);
    for (const socket of hub.clients) socket.terminate();
    hub.close();
  };
}
