// =============================================================
// Kết nối WebSocket tới backend để nhận sự kiện realtime.
// Mất kết nối thì tự kết nối lại sau 2,5 giây (khi còn đăng nhập).
// =============================================================
import { getToken } from './client';

const RETRY_MS = 2500;

// Địa chỉ WebSocket: mặc định cùng host với trang web, đường dẫn /ws.
function socketUrl() {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${location.host}/ws`;
}

/**
 * Mở kết nối realtime.
 * @param onEvent  gọi với mỗi sự kiện { event, data } server gửi xuống
 * @param onState  gọi với true khi đã xác thực xong, false khi mất kết nối
 * @returns hàm đóng kết nối (gọi khi đăng xuất / component unmount)
 */
export function connectEvents(onEvent, onState) {
  let socket;
  let retryTimer;
  let closed = false; // true khi chủ động đóng => không kết nối lại

  function connect() {
    socket = new WebSocket(socketUrl());

    // Việc đầu tiên sau khi mở: gửi token để server xác thực.
    socket.onopen = () => socket.send(JSON.stringify({ token: getToken() }));

    socket.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data);
        if (event.event === 'connected') onState(true);
        onEvent(event);
      } catch {
        // bỏ qua tin không phải JSON
      }
    };

    socket.onclose = () => {
      onState(false);
      if (!closed && getToken()) retryTimer = setTimeout(connect, RETRY_MS);
    };

    socket.onerror = () => socket.close(); // lỗi => đóng, onclose sẽ lo việc kết nối lại
  }

  connect();

  return () => {
    closed = true;
    clearTimeout(retryTimer);
    socket?.close();
  };
}
