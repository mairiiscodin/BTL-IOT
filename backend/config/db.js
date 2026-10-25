// =============================================================
// Kết nối MySQL: tạo connection pool và vài hàm tiện ích để truy vấn.
// =============================================================
import './env.js'; // đảm bảo .env đã được nạp trước khi đọc process.env.DB_*
import mysql from 'mysql2/promise';
import { HttpError } from '../utils/httpError.js';

// Pool = nhóm kết nối dùng lại, tránh mở/đóng kết nối cho mỗi request.
export const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'smartroom',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'smart_room',
  timezone: 'Z', // đọc/ghi DATETIME theo UTC
  decimalNumbers: true, // cột DECIMAL trả về kiểu number thay vì string
  connectionLimit: 10,
  charset: 'utf8mb4',
});

// Mỗi kết nối mới đặt phiên UTC, để DEFAULT CURRENT_TIMESTAMP và UNIX_TIMESTAMP
// trong MySQL khớp với thời gian mà Node.js gửi lên.
pool.pool.on('connection', (connection) => connection.query("SET time_zone = '+00:00'"));

// 'pending_action_id' -> 'pendingActionId' (tên cột SQL -> tên thuộc tính JS).
const toCamelCase = (key) => key.toLowerCase().replace(/_([a-z])/g, (_, c) => c.toUpperCase());

// Chuyển một dòng kết quả SQL thành object JS: key camelCase, Date -> chuỗi ISO.
function mapRow(row) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      toCamelCase(key),
      value instanceof Date ? value.toISOString() : value,
    ]),
  );
}

/**
 * Bọc một connection (pool hoặc connection trong transaction) thành các hàm dễ dùng.
 * Mọi hàm đều dùng dấu `?` + mảng `args` để chống SQL injection.
 */
export function database(connection) {
  return {
    // Chạy câu SQL bất kỳ, trả kết quả thô (dùng cho UPDATE/INSERT...).
    async query(sql, args = []) {
      const [rows] = await connection.query(sql, args);
      return rows;
    },
    // SELECT nhiều dòng, trả về mảng object đã camelCase.
    async list(sql, args = []) {
      const [rows] = await connection.query(sql, args);
      return rows.map(mapRow);
    },
    // SELECT đúng 1 dòng; không có thì báo lỗi 404.
    async one(sql, args = []) {
      const rows = await this.list(sql, args);
      if (!rows.length) throw new HttpError(404, 'NOT_FOUND', 'Không tìm thấy dữ liệu.');
      return rows[0];
    },
    // SELECT COUNT(*)... trả về một con số.
    async count(sql, args = []) {
      const [rows] = await connection.query(sql, args);
      return Number(Object.values(rows[0])[0]);
    },
    // INSERT và trả về id vừa tạo.
    async insert(sql, args = []) {
      return (await this.query(sql, args)).insertId;
    },
  };
}

// Đối tượng dùng cho các truy vấn thông thường (không cần transaction).
export const db = database(pool);

/**
 * Chạy `fn` trong một transaction: thành công thì COMMIT, có lỗi thì ROLLBACK.
 * Ví dụ: await transaction(async (sql) => { await sql.insert(...); await sql.query(...); });
 */
export async function transaction(fn) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await fn(database(connection));
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release(); // trả kết nối về pool
  }
}
