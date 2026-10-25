// =============================================================
// Đăng nhập / đăng xuất và quản lý phiên (session) bằng token.
//
// Luồng: client POST /auth/login -> nhận `token` -> gửi kèm header
// "Authorization: Bearer <token>" cho các API khác -> verifyToken() kiểm tra.
// Phiên lưu trong RAM (Map), nên khởi động lại server là phải đăng nhập lại.
// =============================================================
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { db } from '../config/db.js';
import { config } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';
import { requireValue } from '../utils/validation.js';

// Chống dò mật khẩu: mỗi địa chỉ IP tối đa 10 lần đăng nhập sai / 1 phút.
const MAX_LOGIN_ATTEMPTS = 10;
const ATTEMPT_WINDOW_MS = 60 * 1000;

const sessions = new Map(); // token -> { userId, role, expiresAt }
const loginAttempts = new Map(); // địa chỉ IP -> { count, since }

// Thông tin hồ sơ người dùng (không bao giờ trả về password_hash).
export async function getUserProfile(userId) {
  const user = await db.one(
    'SELECT id, username, full_name, role, created_at FROM Users WHERE id=?',
    [userId],
  );
  // Mã SV và lớp chưa có trong DB nên gắn cố định ở đây để trang Profile hiển thị.
  return { ...user, studentId: 'B23DCCN111', className: 'D23CNPM06' };
}

// Đếm số lần thử của IP; vượt giới hạn thì báo lỗi 429 (Too Many Requests).
function countLoginAttempt(address) {
  const now = Date.now();
  let attempt = loginAttempts.get(address);
  // Chưa có hoặc đã qua 1 phút => bắt đầu đếm lại từ 0.
  if (!attempt || now - attempt.since >= ATTEMPT_WINDOW_MS) attempt = { count: 0, since: now };
  if (attempt.count >= MAX_LOGIN_ATTEMPTS)
    throw new HttpError(429, 'RATE_LIMITED', 'Thử lại sau 1 phút.');
  attempt.count++;
  loginAttempts.set(address, attempt);
}

// So khớp mật khẩu với hash bcrypt trong DB.
// Hash tạo bởi PHP/Spring có tiền tố '$2y$'; bcryptjs cần '$2b$' (thuật toán giống nhau).
function checkPassword(password, hash) {
  return bcrypt.compare(password, hash.replace(/^\$2y\$/, '$2b$'));
}

/**
 * Đăng nhập: kiểm tra dữ liệu, giới hạn số lần thử, so mật khẩu rồi tạo token mới.
 * @param body    { username, password }
 * @param address IP của client (req.ip)
 * @returns { token, user }
 */
export async function login(body, address) {
  const { username, password } = body ?? {};
  requireValue(typeof username === 'string' && username.length > 0 && username.length <= 100);
  // bcrypt chỉ dùng tối đa 72 byte đầu của mật khẩu.
  requireValue(
    typeof password === 'string' && password.length > 0 && Buffer.byteLength(password) <= 72,
  );

  countLoginAttempt(address);

  const rows = await db.list('SELECT * FROM Users WHERE username=?', [username]);
  const user = rows[0];
  // Sai tài khoản hay sai mật khẩu đều báo chung một câu để không lộ tài khoản nào tồn tại.
  if (!user || !(await checkPassword(password, user.passwordHash)))
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Tài khoản hoặc mật khẩu không đúng.');

  loginAttempts.delete(address); // đăng nhập đúng => xoá bộ đếm

  // Token ngẫu nhiên 32 byte, rất khó đoán. Role lưu kèm phiên để phân quyền mỗi request.
  const token = randomBytes(32).toString('base64url');
  sessions.set(token, {
    userId: user.id,
    role: user.role,
    expiresAt: Date.now() + config.sessionHours * 60 * 60 * 1000,
  });
  return { token, user: await getUserProfile(user.id) };
}

// Kiểm tra token còn hiệu lực; hợp lệ thì trả về { userId, role }, không thì ném lỗi 401.
export function verifySession(token) {
  const session = sessions.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    sessions.delete(token);
    throw new HttpError(401, 'UNAUTHORIZED', 'Phiên đăng nhập đã hết hạn.');
  }
  return { userId: session.userId, role: session.role };
}

// Như verifySession nhưng chỉ trả về userId.
export const verifyToken = (token) => verifySession(token).userId;

export function logout(token) {
  sessions.delete(token);
}

// Dọn phiên hết hạn và bộ đếm cũ để Map không phình mãi (gọi định kỳ từ socketHub).
export function cleanupExpired() {
  const now = Date.now();
  for (const [token, session] of sessions) if (session.expiresAt <= now) sessions.delete(token);
  for (const [address, attempt] of loginAttempts)
    if (now - attempt.since >= ATTEMPT_WINDOW_MS) loginAttempts.delete(address);
}
