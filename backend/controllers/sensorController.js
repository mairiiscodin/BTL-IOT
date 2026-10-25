// Controller: chỉ đọc request, gọi service và trả JSON. Nghiệp vụ nằm trong services/.
import * as sensorService from '../services/sensorService.js';
import * as queryService from '../services/queryService.js';

// GET /api/v1/sensors  -> danh sách cảm biến
export const listSensors = async (req, res) => {
  res.json({ data: await sensorService.listSensors() });
};

// GET /api/v1/sensors/latest  -> số đo mới nhất của mỗi cảm biến
export const latest = async (req, res) => {
  res.json({ data: await sensorService.latestReadings() });
};

// GET /api/v1/sensors/data?type=&valueMin=&valueMax=&time=&page=&limit=
// Trả về { data, pagination } nên không bọc thêm { data }.
export const history = async (req, res) => {
  res.json(await queryService.sensorHistory(req.query));
};

// GET /api/v1/sensors/chart  -> 30 bản ghi gần nhất của mỗi cảm biến
export const chart = async (req, res) => {
  res.json({ data: await queryService.chartData() });
};

// GET /api/v1/sensors/export?...  -> tải file CSV theo cùng bộ lọc với /data
export const exportCsv = async (req, res) => {
  const result = await queryService.sensorHistory(req.query, true);
  res.attachment('iot-logs.csv').type('text/csv').send(queryService.toCsv(result));
};
