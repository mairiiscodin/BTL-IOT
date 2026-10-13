import { Router } from 'express';
import * as c from '../controllers/actionHistoryController.js';
const router = Router();
router.get('/', c.list);
router.get('/export', c.exportCsv);
router.get('/:id', c.one);
export default router;
