// Controller: chỉ đọc request, gọi service và trả JSON. Nghiệp vụ nằm trong services/.
import * as authService from '../services/authService.js';

// POST /api/v1/auth/login  body: { username, password }
export const login = async (req, res) => {
  res.json({ data: await authService.login(req.body, req.ip) });
};

// GET /api/v1/auth/me  -> thông tin người dùng đang đăng nhập
export const me = async (req, res) => {
  res.json({ data: await authService.getUserProfile(req.userId) });
};

// POST /api/v1/auth/logout  -> huỷ token hiện tại
export const logout = (req, res) => {
  authService.logout(req.token);
  res.json({ data: { loggedOut: true } });
};
