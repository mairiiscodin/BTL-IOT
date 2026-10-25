import { verifySession } from '../services/authService.js';
import { HttpError } from '../utils/httpError.js';

/**
 * Middleware bắt buộc đăng nhập.
 * Đọc header "Authorization: Bearer <token>", kiểm tra token và gắn vào request:
 *   req.token  - token thô (dùng khi logout)
 *   req.userId - id người dùng đang đăng nhập
 *   req.role   - quyền của người dùng: 'admin' | 'viewer'
 * Token sai/hết hạn => chuyển lỗi 401 cho errorHandler.
 */
export function authenticate(req, res, next) {
  req.token = req.get('Authorization')?.replace(/^Bearer /, '');
  try {
    ({ userId: req.userId, role: req.role } = verifySession(req.token));
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware phân quyền, đặt sau authenticate.
 * Ví dụ: router.post('/x', requireRole('admin'), handler) => viewer gọi sẽ nhận 403.
 */
export const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (roles.includes(req.role)) next();
    else next(new HttpError(403, 'FORBIDDEN', 'Tài khoản không có quyền thực hiện thao tác này.'));
  };
