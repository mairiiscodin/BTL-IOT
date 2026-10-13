import { verify } from '../services/authService.js';
export function authenticate(req, res, next) {
  req.token = req.get('Authorization')?.replace(/^Bearer /, '');
  try {
    req.userId = verify(req.token);
    next();
  } catch (error) {
    next(error);
  }
}
