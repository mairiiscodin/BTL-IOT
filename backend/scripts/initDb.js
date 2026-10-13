import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { pool, database } from '../config/db.js';
const tables = ['Users', 'Sensors', 'Devices', 'SensorData', 'ActionHistory'];
export async function initialize() {
  const connection = await pool.getConnection();
  const sql = database(connection);
  let locked = false;
  try {
    locked = (await sql.count("SELECT GET_LOCK(CONCAT(DATABASE(),':smart-room-init'),30)")) === 1;
    if (!locked) throw new Error('Database initialization busy');
    const existing = await sql.list(
      'SELECT table_name FROM information_schema.tables WHERE table_schema=DATABASE()',
    );
    const names = new Set(existing.map((r) => r.tableName.toLowerCase()));
    const count = tables.filter((t) => names.has(t.toLowerCase())).length;
    if (count === 0) {
      const source = await fs.readFile(new URL('../database/schema.sql', import.meta.url), 'utf8');
      for (const statement of source
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean))
        await sql.query(statement);
    } else if (count !== tables.length)
      throw new Error(
        'Incomplete schema. Back up and inspect database; refusing to overwrite existing tables.',
      );
    // Existing Spring/Flyway databases are adopted without modifying schema or history.
    await connection.beginTransaction();
    if ((await sql.count('SELECT COUNT(*) FROM Users')) === 0) {
      const password = process.env.ADMIN_PASSWORD || '';
      if (password.length < 8 || Buffer.byteLength(password) > 72)
        throw new Error('Set ADMIN_PASSWORD (8–72 bytes) on first setup.');
      await sql.insert('INSERT INTO Users(username,password_hash,full_name) VALUES(?,?,?)', [
        process.env.ADMIN_USERNAME || 'admin@iot.com',
        await bcrypt.hash(password, 12),
        'Lê Xuân Cường',
      ]);
    }
    await connection.commit();
  } catch (e) {
    await connection.rollback();
    throw e;
  } finally {
    if (locked) await sql.query("SELECT RELEASE_LOCK(CONCAT(DATABASE(),':smart-room-init'))");
    connection.release();
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  try {
    await initialize();
    console.log('Database ready; existing data preserved.');
  } catch (e) {
    console.error(e.code || e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
