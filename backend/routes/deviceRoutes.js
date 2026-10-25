// Route thiết bị, gắn tại /api/v1/devices (đã yêu cầu đăng nhập, xem app.js).
import { Router } from 'express';
import * as controller from '../controllers/deviceController.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();
router.get('/', controller.list); // admin và viewer đều xem được
router.post('/:id/actions', requireRole('admin'), controller.execute); // chỉ admin bật/tắt
export default router;
