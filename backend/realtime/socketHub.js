// =============================================================
// WebSocket hub (đường dẫn /ws): đẩy sự kiện realtime từ server xuống trình duyệt.
//
// Giao thức:
//   1. Trình duyệt mở kết nối rồi gửi ngay { "token": "<token đăng nhập>" }.
//   2. Token hợp lệ -> server trả { event: 'connected' } và bắt đầu gửi sự kiện.
//   3. Mọi tin server gửi đều có dạng { event: '<tên>', data: {...} }.
// Sau 10 giây chưa gửi token, hoặc token hết hạn => server đóng kết nối (mã 1008).
// =============================================================
import { WebSocketServer, WebSocket } from 'ws';
import { verifyToken, cleanupExpired } from '../services/authService.js';
import { config } from '../config/env.js';

const AUTH_TIMEOUT_MS = 10000; // thời gian tối đa để client gửi token
const HEARTBEAT_MS = 10000; // chu kỳ gửi 'heartbeat' giữ kết nối
const POLICY_VIOLATION = 1008; // mã đóng WebSocket: vi phạm chính sách (chưa/không xác thực)

let hub; // WebSocketServer, tạo trong attachSocketHub()

// Gửi một sự kiện cho một socket (chỉ khi socket còn mở).
function send(socket, event, data) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ event, data }));
}

/**
 * Gửi sự kiện cho mọi client đã đăng nhập. Các service gọi hàm này,
 * vd. emit('sensor.updated', readings).
 * @param userId nếu truyền vào thì chỉ gửi cho người dùng đó; null = gửi tất cả.
 */
export function emit(event, data, userId = null) {
  for (const socket of hub?.clients || []) {
    if (!socket.token) continue; // chưa xác thực => không nhận sự kiện
    try {
      const socketUserId = verifyToken(socket.token);
      if (userId === null || userId === socketUserId) send(socket, event, data);
    } catch {
      socket.close(POLICY_VIOLATION); // token đã hết hạn
    }
  }
}

// Tin đầu tiên client gửi phải là { token }; hợp lệ thì đánh dấu socket đã xác thực.
function handleAuthMessage(socket, bytes) {
  try {
    const { token } = JSON.parse(bytes.toString());
    verifyToken(token);
    socket.token = token;
    send(socket, 'connected', { authenticated: true });
  } catch {
    socket.close(POLICY_VIOLATION);
  }
}

// Chạy định kỳ: dọn phiên hết hạn, đóng socket không hợp lệ, gửi heartbeat cho socket hợp lệ.
function checkClients() {
  cleanupExpired();
  for (const socket of hub.clients) {
    try {
      if (!socket.token) {
        if (Date.now() - socket.openedAt >= AUTH_TIMEOUT_MS) socket.close(POLICY_VIOLATION);
      } else {
        verifyToken(socket.token);
        send(socket, 'heartbeat', {});
      }
    } catch {
      socket.close(POLICY_VIOLATION);
    }
  }
}

/**
 * Gắn WebSocket vào HTTP server (dùng chung cổng với Express).
 * @returns hàm đóng toàn bộ kết nối, gọi khi tắt server.
 */
export function attachSocketHub(server) {
  hub = new WebSocketServer({
    server,
    path: '/ws',
    maxPayload: 4096,
    // Chỉ cho phép trang web thuộc ALLOWED_ORIGINS kết nối (không có origin = công cụ ngoài trình duyệt).
    verifyClient: ({ origin }) => !origin || config.allowedOrigins.includes(origin),
  });

  hub.on('connection', (socket) => {
    socket.openedAt = Date.now();
    socket.on('error', () => {}); // tránh lỗi mạng của 1 client làm sập server
    socket.on('message', (bytes) => handleAuthMessage(socket, bytes));
  });

  const timer = setInterval(checkClients, HEARTBEAT_MS);
  timer.unref(); // không giữ tiến trình Node sống chỉ vì timer này

  return () => {
    clearInterval(timer);
    for (const socket of hub.clients) socket.terminate();
    hub.close();
  };
}
