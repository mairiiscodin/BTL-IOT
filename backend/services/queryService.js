// =============================================================
// Truy vấn danh sách có lọc + phân trang: số đo cảm biến, lịch sử điều khiển,
// dữ liệu biểu đồ và chuyển kết quả sang CSV.
// =============================================================
import { db } from '../config/db.js';
import { CHART_LIMIT, SENSOR_TYPES, MAX_EXPORT_ROWS } from '../config/constants.js';
import { createFilter, addTimeFilters, addActionFilters, hasParam } from '../utils/query.js';
import { requireValue } from '../utils/validation.js';

/**
 * Chạy 2 câu SQL: đếm tổng số bản ghi và lấy đúng một trang dữ liệu.
 * @param filter  bộ lọc từ createFilter()
 * @param columns phần sau SELECT
 * @param from    phần FROM ... JOIN ...
 * @param orderBy phần sau ORDER BY
 * @returns { data: [...], pagination: { page, limit, total, totalPages } }
 */
async function paginate(filter, { columns, from, orderBy }) {
  const where = filter.where();
  const total = await db.count('SELECT COUNT(*)' + from + where, filter.args);
  const offset = (filter.page - 1) * filter.limit;
  const rows = await db.list(
    `SELECT ${columns}${from}${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    [...filter.args, filter.limit, offset],
  );
  return {
    data: rows,
    pagination: {
      page: filter.page,
      limit: filter.limit,
      total,
      totalPages: Math.ceil(total / filter.limit),
    },
  };
}

/**
 * Lịch sử số đo cảm biến. Hỗ trợ lọc: type, valueMin, valueMax, from, to, time.
 */
export async function sensorHistory(query, exporting = false) {
  const filter = createFilter(query, exporting);

  // Lọc theo loại cảm biến.
  if (hasParam(query, 'type')) {
    requireValue(SENSOR_TYPES.includes(query.type));
    filter.add('s.type=?', query.type);
  }

  // Lọc theo khoảng giá trị [valueMin, valueMax].
  if (hasParam(query, 'valueMin')) {
    const min = Number(query.valueMin);
    requireValue(Number.isFinite(min));
    filter.add('d.value>=?', min);
  }
  if (hasParam(query, 'valueMax')) {
    const max = Number(query.valueMax);
    requireValue(Number.isFinite(max));
    filter.add('d.value<=?', max);
  }
  requireValue(
    !hasParam(query, 'valueMin') ||
      !hasParam(query, 'valueMax') ||
      Number(query.valueMin) <= Number(query.valueMax),
  );

  addTimeFilters(filter, query, 'd.measured_at');

  return paginate(filter, {
    columns:
      'd.id, d.sensor_id, s.type AS sensor_type, s.unit, d.value, d.measured_at AS timestamp',
    from: ' FROM SensorData d JOIN Sensors s ON s.id = d.sensor_id',
    orderBy: 'd.measured_at DESC, d.id DESC', // mới nhất lên đầu
  });
}

/**
 * Lịch sử bật/tắt thiết bị của một người dùng.
 */
export async function actionHistory(userId, query, exporting = false) {
  const filter = createFilter(query, exporting);
  filter.add('a.user_id=?', userId); // mỗi người chỉ xem được lịch sử của mình
  addActionFilters(filter, query);
  addTimeFilters(filter, query, 'a.created_at');

  return paginate(filter, {
    columns: 'a.*, d.name AS device_name, u.full_name AS user_name',
    from:
      ' FROM ActionHistory a' +
      ' JOIN Devices d ON d.id = a.device_id' +
      ' JOIN Users u ON u.id = a.user_id',
    orderBy: 'a.created_at DESC, a.id DESC',
  });
}

// Lấy chi tiết một lệnh (chỉ khi lệnh đó thuộc về người dùng đang đăng nhập).
export function actionById(userId, actionId) {
  return db.one('SELECT * FROM ActionHistory WHERE id=? AND user_id=?', [actionId, userId]);
}

/**
 * Dữ liệu biểu đồ: CHART_LIMIT bản ghi gần nhất của mỗi loại cảm biến,
 * trả về theo thứ tự thời gian tăng dần.
 */
export async function chartData() {
  const perType = await Promise.all(
    SENSOR_TYPES.map((type) =>
      db.list(
        `SELECT s.type AS sensor_type, s.unit, d.value, d.measured_at AS timestamp
         FROM SensorData d JOIN Sensors s ON s.id = d.sensor_id
         WHERE s.type = ?
         ORDER BY d.measured_at DESC, d.id DESC
         LIMIT ${CHART_LIMIT}`,
        [type],
      ),
    ),
  );
  return perType
    .flat()
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

// Bọc một giá trị thành ô CSV an toàn.
function csvCell(value) {
  let text = value == null ? '' : String(value);
  // Chống "CSV injection": Excel coi ô bắt đầu bằng = + @ - là công thức => thêm dấu ' phía trước.
  if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
  // Đặt trong ngoặc kép, dấu " bên trong nhân đôi theo chuẩn CSV.
  return '"' + text.replace(/"/g, '""') + '"';
}

const csvLine = (values) => values.map(csvCell).join(',') + '\r\n';

/**
 * Chuyển kết quả paginate() thành nội dung file CSV.
 * Dòng đầu là tên cột; thêm BOM '﻿' để Excel hiển thị đúng tiếng Việt.
 */
export function toCsv(result) {
  requireValue(
    result.pagination.total <= MAX_EXPORT_ROWS,
    'Hãy thu hẹp khoảng thời gian xuống tối đa 100.000 bản ghi.',
  );
  if (!result.data.length) return '﻿';
  const header = csvLine(Object.keys(result.data[0]));
  const body = result.data.map((row) => csvLine(Object.values(row))).join('');
  return '﻿' + header + body;
}
