// Controller: chỉ đọc request, gọi service và trả JSON. Nghiệp vụ nằm trong services/.
import * as queryService from '../services/queryService.js';
import { parseId } from '../utils/validation.js';

// GET /api/v1/actions?deviceId=&action=&status=&time=&page=&limit=
export const list = async (req, res) => {
  res.json(await queryService.actionHistory(req.userId, req.query));
};

// GET /api/v1/actions/:id  (id dạng 15 hoặc A15)
export const one = async (req, res) => {
  res.json({ data: await queryService.actionById(req.userId, parseId(req.params.id)) });
};

// GET /api/v1/actions/export?...  -> tải file CSV theo cùng bộ lọc với danh sách
export const exportCsv = async (req, res) => {
  const result = await queryService.actionHistory(req.userId, req.query, true);
  res.attachment('iot-logs.csv').type('text/csv').send(queryService.toCsv(result));
};
