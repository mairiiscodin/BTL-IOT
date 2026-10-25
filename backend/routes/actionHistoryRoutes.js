// Route lịch sử điều khiển, gắn tại /api/v1/actions (đã yêu cầu đăng nhập, xem app.js).
import { Router } from 'express';
import * as controller from '../controllers/actionHistoryController.js';

const router = Router();
router.get('/', controller.list);
router.get('/export', controller.exportCsv); // phải đặt trước '/:id', nếu không 'export' bị hiểu là id
router.get('/:id', controller.one);
export default router;
