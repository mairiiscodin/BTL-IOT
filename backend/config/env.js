// =============================================================
// Đọc biến môi trường (.env) và gom cấu hình chung của backend.
// Mọi file khác chỉ cần `import { config } from './config/env.js'`.
// =============================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

// Đường dẫn tuyệt đối tới thư mục backend/ và thư mục gốc dự án BTL/.
export const backendRoot = fileURLToPath(new URL('..', import.meta.url));
export const projectRoot = path.dirname(backendRoot);

// Danh sách file .env sẽ đọc:
// - Nếu có ENV_FILE (vd. scripts/local.mjs đặt '.runtime/local.env') thì chỉ đọc file đó.
// - Nếu không thì đọc backend/.env rồi tới BTL/.env (file nào không có thì bỏ qua).
const envFiles = process.env.ENV_FILE
  ? [path.resolve(projectRoot, process.env.ENV_FILE)]
  : [path.join(backendRoot, '.env'), path.join(projectRoot, '.env')];

for (const file of envFiles) {
  if (!fs.existsSync(file)) {
    // ENV_FILE do người dùng chỉ định mà không tồn tại => báo lỗi ngay cho dễ phát hiện.
    if (process.env.ENV_FILE) throw new Error('ENV_FILE does not exist: ' + file);
    continue;
  }
  const values = parseEnv(fs.readFileSync(file, 'utf8'));
  for (const [key, value] of Object.entries(values)) {
    // `??=`: chỉ gán khi biến chưa có => biến đặt sẵn trong terminal được ưu tiên hơn file .env.
    process.env[key] ??= value;
  }
}

// Origin mặc định được phép gọi API (Vite dev server 5173 và chính backend 8080).
const DEFAULT_ORIGINS =
  'http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:8080,http://localhost:8080';

// Cấu hình đã chuẩn hoá kiểu dữ liệu (số, mảng...) để nơi khác dùng luôn.
export const config = {
  port: Number(process.env.SERVER_PORT || 8080),
  host: process.env.SERVER_HOST || '127.0.0.1',
  // Lệnh bật/tắt chờ ACK từ ESP32 tối đa bao lâu (ms) trước khi bị đánh dấu "timeout".
  commandTimeoutMs: Number(process.env.COMMAND_TIMEOUT_MS || 10000),
  // Thiết bị không gửi gì quá khoảng này (ms) thì coi là "offline".
  deviceStaleMs: Number(process.env.SENSOR_STALE_MS || 15000),
  // Múi giờ dùng để hiểu chuỗi thời gian người dùng nhập khi lọc dữ liệu.
  timeZone: process.env.APP_TIME_ZONE || 'Asia/Ho_Chi_Minh',
  // Thời gian sống của một phiên đăng nhập (giờ).
  sessionHours: Number(process.env.SESSION_HOURS || 8),
  // Danh sách origin được phép (CORS + WebSocket), cách nhau bởi dấu phẩy.
  allowedOrigins: (process.env.ALLOWED_ORIGINS || DEFAULT_ORIGINS).split(',').map((s) => s.trim()),
};
