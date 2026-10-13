import * as service from '../services/deviceService.js';
import { id } from '../utils/httpError.js';
export const list = async (req, res) => res.json({ data: await service.devices() });
export const execute = async (req, res) =>
  res
    .status(202)
    .json({ data: await service.execute(req.userId, id(req.params.id), req.body?.action) });
