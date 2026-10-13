import { Router } from 'express';
import * as c from '../controllers/deviceController.js';
const router = Router();
router.get('/', c.list);
router.post('/:id/actions', c.execute);
export default router;
