import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { db } from '../config/db.js';
import { config } from '../config/env.js';
import { HttpError, requireValue } from '../utils/httpError.js';

const sessions = new Map(),
  attempts = new Map();
export async function user(uid) {
  return {
    ...(await db.one('SELECT id,username,full_name,created_at FROM Users WHERE id=?', [uid])),
    studentId: 'B23DCCN111',
    className: 'D23CNPM06',
  };
}
export async function login(body, address) {
  requireValue(
    typeof body?.username === 'string' && body.username.length > 0 && body.username.length <= 100,
  );
  requireValue(
    typeof body.password === 'string' &&
      body.password.length > 0 &&
      Buffer.byteLength(body.password) <= 72,
  );
  const now = Date.now();
  let attempt = attempts.get(address);
  if (!attempt || now - attempt.since >= 60000) attempt = { count: 0, since: now };
  if (attempt.count >= 10) throw new HttpError(429, 'RATE_LIMITED', 'Thử lại sau 1 phút.');
  attempt.count++;
  attempts.set(address, attempt);
  const rows = await db.list('SELECT * FROM Users WHERE username=?', [body.username]);
  if (
    !rows.length ||
    !(await bcrypt.compare(body.password, rows[0].passwordHash.replace(/^\$2y\$/, '$2b$')))
  ) {
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Tài khoản hoặc mật khẩu không đúng.');
  }
  attempts.delete(address);
  const token = randomBytes(32).toString('base64url');
  sessions.set(token, { uid: rows[0].id, expires: now + config.sessionHours * 3600000 });
  return { token, user: await user(rows[0].id) };
}
export function verify(token) {
  const session = sessions.get(token);
  if (!session || session.expires <= Date.now()) {
    sessions.delete(token);
    throw new HttpError(401, 'UNAUTHORIZED', 'Phiên đăng nhập đã hết hạn.');
  }
  return session.uid;
}
export function logout(token) {
  sessions.delete(token);
}
export function cleanup() {
  for (const [key, value] of sessions) if (value.expires <= Date.now()) sessions.delete(key);
  for (const [key, value] of attempts) if (Date.now() - value.since >= 60000) attempts.delete(key);
}
