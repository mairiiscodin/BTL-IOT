// =============================================================
// Nghiệp vụ cảm biến: đọc số đo mới nhất và lưu số đo nhận từ MQTT.
// =============================================================
import { db, transaction } from '../config/db.js';
import { emit } from '../realtime/socketHub.js';

// Danh sách cảm biến (cấu hình cố định trong bảng Sensors).
export const listSensors = () => db.list('SELECT * FROM Sensors ORDER BY id');

/**
 * Số đo mới nhất của từng cảm biến đang hoạt động, kèm số đo ngay trước đó
 * (`previous_value`) để Dashboard tính mức tăng/giảm.
 */
export const latestReadings = () =>
  db.list(
    `SELECT s.id AS sensor_id, s.name, s.type AS sensor_type, s.unit,
            d.id, d.value, d.measured_at AS timestamp,
            -- số đo thứ 2 tính từ mới nhất (OFFSET 1)
            (SELECT x.value FROM SensorData x WHERE x.sensor_id = s.id
             ORDER BY x.measured_at DESC, x.id DESC LIMIT 1 OFFSET 1) AS previous_value
     FROM Sensors s
     -- ghép với đúng 1 dòng: số đo mới nhất của cảm biến
     LEFT JOIN SensorData d ON d.id = (
       SELECT x.id FROM SensorData x WHERE x.sensor_id = s.id
       ORDER BY x.measured_at DESC, x.id DESC LIMIT 1)
     WHERE s.is_active = TRUE
     ORDER BY s.id`,
  );

// Khoảng giá trị hợp lệ của từng loại cảm biến (theo datasheet DHT11/cảm biến ánh sáng).
const VALID_RANGES = {
  temperature: { min: -40, max: 125 },
  humidity: { min: 0, max: 100 },
  light: { min: 0, max: 1000000 },
};

// Kiểm tra một số đo có hợp lệ không, để loại bỏ dữ liệu lỗi trước khi lưu DB.
export function isValidReading(type, value, unit = 'lux') {
  if (typeof value !== 'number' || !Number.isFinite(value)) return false;
  const range = VALID_RANGES[type];
  if (!range) return false;
  if (type === 'light' && unit !== 'lux') return false; // chỉ chấp nhận ánh sáng đơn vị lux
  return value >= range.min && value <= range.max;
}

/**
 * Xử lý gói tin MQTT 'iot/sensors/data', ví dụ:
 *   { "temperature": 28.5, "humidity": 65, "light": 500, "lightUnit": "lux" }
 * Lưu các số đo hợp lệ rồi đẩy số đo mới nhất cho trình duyệt qua WebSocket.
 * @param retained true nếu là tin "retained" cũ do broker giữ lại => bỏ qua.
 */
export async function ingestReadings(body, retained) {
  if (retained || !body || typeof body !== 'object' || Array.isArray(body)) return;

  // Mỗi cảm biến lấy giá trị ở key trùng với `type` của nó (temperature/humidity/light).
  const now = new Date();
  const sensors = await db.list('SELECT * FROM Sensors WHERE is_active=TRUE');
  const rows = sensors
    .filter((sensor) => isValidReading(sensor.type, body[sensor.type], body.lightUnit ?? 'lux'))
    .map((sensor) => [sensor.id, body[sensor.type], now]);
  if (!rows.length) return;

  // Lưu tất cả trong 1 transaction: hoặc lưu đủ, hoặc không lưu gì.
  await transaction(async (sql) => {
    for (const row of rows)
      await sql.insert(
        'INSERT INTO SensorData(sensor_id, value, measured_at) VALUES(?, ?, ?)',
        row,
      );
  });

  emit('sensor.updated', await latestReadings());
}
