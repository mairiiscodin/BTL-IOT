// =============================================================
// Điểm khởi động backend (npm run backend):
//   1. Kiểm tra database đã có bảng + tài khoản.
//   2. Tạo HTTP server (Express) và gắn WebSocket /ws.
//   3. Kết nối MQTT broker.
//   4. Mỗi giây quét lệnh quá hạn / thiết bị offline.
//   5. Ctrl+C => đóng mọi kết nối gọn gàng.
// =============================================================
import { createServer } from 'node:http';
import { app } from './app.js';
import { config } from './config/env.js';
import { pool } from './config/db.js';
import { checkDatabase } from './scripts/checkDb.js';
import { attachSocketHub } from './realtime/socketHub.js';
import { startMqtt, stopMqtt } from './services/mqttService.js';
import { expireStale } from './services/deviceService.js';

const EXPIRY_INTERVAL_MS = 1000;

let server;
let closeSockets;
let expiryTimer;
let stopping = false;

// Chạy expireStale() mỗi giây. Cờ `running` đảm bảo lần trước chưa xong thì bỏ qua lần này.
function startExpiryLoop() {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await expireStale();
    } catch (error) {
      console.error('Command expiry:', error.code || error.name);
    } finally {
      running = false;
    }
  }, EXPIRY_INTERVAL_MS);
  timer.unref();
  return timer;
}

// Tắt server: dừng timer, đóng WebSocket, HTTP, MQTT rồi tới MySQL (chỉ chạy 1 lần).
async function shutdown() {
  if (stopping) return;
  stopping = true;
  clearInterval(expiryTimer);
  closeSockets?.();
  server?.close();
  await stopMqtt();
  await pool.end();
}

try {
  await checkDatabase();

  server = createServer(app);
  closeSockets = attachSocketHub(server);
  startMqtt();
  expiryTimer = startExpiryLoop();

  server.listen(config.port, config.host, () => {
    console.log('Smart Room Node API: http://' + config.host + ':' + config.port);
  });
  // Ví dụ lỗi EADDRINUSE: cổng đã bị chương trình khác chiếm.
  server.on('error', async (error) => {
    console.error('HTTP server:', error.code);
    await shutdown();
    process.exitCode = 1;
  });

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () =>
      shutdown().catch(() => {
        process.exitCode = 1;
      }),
    );
  }
} catch (error) {
  console.error('Startup failed:', error.message || error.code);
  await shutdown();
  process.exitCode = 1;
}
