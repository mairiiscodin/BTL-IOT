import * as auth from '../services/authService.js';
export const login = async (req, res) => res.json({ data: await auth.login(req.body, req.ip) });
export const me = async (req, res) => res.json({ data: await auth.user(req.userId) });
export const logout = (req, res) => {
  auth.logout(req.token);
  res.json({ data: { loggedOut: true } });
};
