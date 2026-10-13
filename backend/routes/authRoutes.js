import { Router } from 'express';
import * as controller from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
const router = Router();
router.post('/login', controller.login);
router.get('/me', authenticate, controller.me);
router.post('/logout', authenticate, controller.logout);
export default router;
