import { isDemo } from './config';
import { connectDemoEvents } from './demoStore';
import { getToken } from './client';
export function connectEvents(onEvent, onState) {
  if (isDemo) return connectDemoEvents(onEvent, onState);
  let socket,
    retry,
    closed = false;
  const connect = () => {
    const url =
      import.meta.env.VITE_WS_URL ||
      `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
    socket = new WebSocket(url);
    socket.onopen = () => socket.send(JSON.stringify({ token: getToken() }));
    socket.onmessage = (message) => {
      try {
        const e = JSON.parse(message.data);
        if (e.event === 'connected') onState(true);
        onEvent(e);
      } catch {}
    };
    socket.onclose = () => {
      onState(false);
      if (!closed && getToken()) retry = setTimeout(connect, 2500);
    };
    socket.onerror = () => socket.close();
  };
  connect();
  return () => {
    closed = true;
    clearTimeout(retry);
    socket?.close();
  };
}
