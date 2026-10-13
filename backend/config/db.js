import './env.js';
import mysql from 'mysql2/promise';
import { HttpError } from '../utils/httpError.js';

export const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'smartroom',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'smart_room',
  timezone: 'Z',
  decimalNumbers: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
});
// DATETIME defaults and UNIX_TIMESTAMP must use the same UTC session as the client.
pool.pool.on('connection', (connection) => connection.query("SET time_zone = '+00:00'"));
const camel = (key) => key.toLowerCase().replace(/_([a-z])/g, (_, c) => c.toUpperCase());
export function database(connection) {
  return {
    async query(sql, args = []) {
      const [rows] = await connection.query(sql, args);
      return rows;
    },
    async list(sql, args = []) {
      const [rows] = await connection.query(sql, args);
      return rows.map((row) =>
        Object.fromEntries(
          Object.entries(row).map(([k, v]) => [camel(k), v instanceof Date ? v.toISOString() : v]),
        ),
      );
    },
    async one(sql, args = []) {
      const rows = await this.list(sql, args);
      if (!rows.length) throw new HttpError(404, 'NOT_FOUND', 'Không tìm thấy dữ liệu.');
      return rows[0];
    },
    async count(sql, args = []) {
      const [rows] = await connection.query(sql, args);
      return Number(Object.values(rows[0])[0]);
    },
    async insert(sql, args = []) {
      return (await this.query(sql, args)).insertId;
    },
  };
}
export const db = database(pool);
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
    connection.release();
  }
}
