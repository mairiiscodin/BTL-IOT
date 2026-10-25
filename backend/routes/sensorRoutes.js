// Route cảm biến, gắn tại /api/v1/sensors (đã yêu cầu đăng nhập, xem app.js).
import { Router } from 'express';
import * as controller from '../controllers/sensorController.js';

const router = Router();
router.get('/', controller.listSensors);
router.get('/latest', controller.latest);
router.get('/data', controller.history);
router.get('/chart', controller.chart);
router.get('/export', controller.exportCsv);
export default router;
