// =============================================================
// Kiểm tra database trước khi chạy backend.
// Backend KHÔNG tự tạo bảng: hãy chạy backend/database/init.sql trong MySQL trước.
//
// Dùng được theo 2 cách:
//   - server.js import checkDatabase() và gọi lúc khởi động.
//   - Chạy riêng: npm run db:check
// =============================================================
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { db, pool } from '../config/db.js';

const REQUIRED_TABLES = ['Users', 'Sensors', 'Devices', 'SensorData', 'ActionHistory'];
const HINT = 'Run backend/database/init.sql in MySQL first.';

export async function checkDatabase() {
  // Lấy tên các bảng đang có trong database hiện tại.
  const existing = await db.list(
    'SELECT table_name FROM information_schema.tables WHERE table_schema=DATABASE()',
  );
  const names = new Set(existing.map((row) => row.tableName.toLowerCase()));

  const missing = REQUIRED_TABLES.filter((table) => !names.has(table.toLowerCase()));
  if (missing.length) throw new Error('Missing tables: ' + missing.join(', ') + '. ' + HINT);

  if ((await db.count('SELECT COUNT(*) FROM Users')) === 0)
    throw new Error('No user account. ' + HINT);
}

// Chỉ chạy đoạn dưới khi file được gọi trực tiếp bằng `node scripts/checkDb.js`,
// không chạy khi được import từ server.js.
const runDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (runDirectly) {
  try {
    await checkDatabase();
    console.log('Database OK.');
  } catch (error) {
    console.error(error.code || error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
