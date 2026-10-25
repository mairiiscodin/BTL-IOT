// Route xác thực, gắn tại /api/v1/auth (xem app.js).
import { Router } from 'express';
import * as controller from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.post('/login', controller.login); // không cần token
router.get('/me', authenticate, controller.me); // cần token
router.post('/logout', authenticate, controller.logout); // cần token
export default router;
