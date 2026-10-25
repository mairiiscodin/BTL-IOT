// Controller: chỉ đọc request, gọi service và trả JSON. Nghiệp vụ nằm trong services/.
import * as deviceService from '../services/deviceService.js';
import { parseId } from '../utils/validation.js';

// GET /api/v1/devices  -> danh sách thiết bị và trạng thái hiện tại
export const list = async (req, res) => {
  res.json({ data: await deviceService.listDevices() });
};

// POST /api/v1/devices/:id/actions  body: { action: 'ON' | 'OFF' }
// Trả 202 Accepted: lệnh đã được nhận nhưng chưa có kết quả (chờ ESP32 ACK).
export const execute = async (req, res) => {
  const deviceId = parseId(req.params.id);
  const command = await deviceService.executeCommand(req.userId, deviceId, req.body?.action);
  res.status(202).json({ data: command });
};
