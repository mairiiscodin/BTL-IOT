import { Router } from 'express';
import * as c from '../controllers/sensorController.js';
const router = Router();
router.get('/', c.sensors);
router.get('/latest', c.realtime);
router.get('/data', c.history);
router.get('/chart', c.chart);
router.get('/export', c.exportCsv);
export default router;
