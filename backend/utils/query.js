// =============================================================
// Bộ dựng câu WHERE cho các API danh sách (lọc + phân trang).
//
// Cách dùng (xem services/queryService.js):
//   const filter = createFilter(req.query);
//   filter.add('s.type=?', 'humidity');   // thêm điều kiện
//   filter.where()  -> ' WHERE s.type=?'
//   filter.args     -> ['humidity']
// =============================================================
import { DateTime } from 'luxon';
import { config } from '../config/env.js';
import {
  DEVICE_ACTIONS,
  ACTION_STATUSES,
  ACTION_SOURCES,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MAX_EXPORT_ROWS,
} from '../config/constants.js';
import { requireValue, parseId } from './validation.js';

// Tham số query có giá trị hay không (bỏ qua undefined, null và chuỗi rỗng).
export const hasParam = (query, key) => query[key] != null && query[key] !== '';

// Đọc chuỗi thời gian ISO ('2025-01-31 08:00' hoặc '2025-01-31T08:00') theo múi giờ ứng dụng.
export function parseTime(value) {
  requireValue(typeof value === 'string');
  const date = DateTime.fromISO(value.replace(' ', 'T'), { zone: config.timeZone });
  requireValue(date.isValid, 'Thời gian không hợp lệ.');
  return date.toJSDate();
}

/**
 * Tạo bộ lọc rỗng kèm thông tin phân trang.
 * @param query     req.query (page, limit, ...)
 * @param exporting true khi xuất CSV: lấy hết (tối đa MAX_EXPORT_ROWS) trên 1 trang.
 */
export function createFilter(query, exporting = false) {
  const page = exporting ? 1 : Number(query.page ?? 1);
  const limit = exporting ? MAX_EXPORT_ROWS : Number(query.limit ?? DEFAULT_PAGE_SIZE);
  requireValue(
    Number.isInteger(page) &&
      page >= 1 &&
      page <= 1000000 &&
      Number.isInteger(limit) &&
      limit >= 1 &&
      (exporting || limit <= MAX_PAGE_SIZE),
    'Phân trang không hợp lệ.',
  );

  const clauses = []; // các điều kiện, sẽ nối bằng AND
  const args = []; // giá trị cho các dấu `?` theo đúng thứ tự
  return {
    page,
    limit,
    args,
    // Thêm một điều kiện SQL và các giá trị cho dấu `?` của nó.
    add(sql, ...values) {
      clauses.push(sql);
      args.push(...values);
    },
    // Trả về ' WHERE a AND b ...' hoặc '' nếu không có điều kiện nào.
    where() {
      return clauses.length ? ' WHERE ' + clauses.join(' AND ') : '';
    },
  };
}

// Độ dài chuỗi 'time' => phần cần bổ sung cho đủ giây, và đơn vị của khoảng tìm kiếm.
// Ví dụ '2025-01-31' (10 ký tự) => cả ngày; '2025-01-31 08' (13 ký tự) => cả giờ 08.
const TIME_PRECISION = {
  10: { suffix: ' 00:00:00', unit: 'days' },
  13: { suffix: ':00:00', unit: 'hours' },
  16: { suffix: ':00', unit: 'minutes' },
  19: { suffix: '', unit: 'seconds' },
};
const TIME_PATTERN = /^\d{4}-\d{2}-\d{2}([ T]\d{2}(:\d{2}(:\d{2})?)?)?$/;

/**
 * Thêm bộ lọc thời gian vào `filter` cho cột `column`:
 * - from / to : khoảng thời gian [from, to].
 * - time      : một mốc thời gian, độ chính xác tuỳ độ dài chuỗi (ngày/giờ/phút/giây).
 */
export function addTimeFilters(filter, query, column) {
  let from, to;
  if (hasParam(query, 'from')) {
    from = parseTime(query.from);
    filter.add(column + '>=?', from);
  }
  if (hasParam(query, 'to')) {
    to = parseTime(query.to);
    filter.add(column + '<=?', to);
  }
  requireValue(!from || !to || from <= to, 'Thời gian bắt đầu phải trước kết thúc.');

  if (hasParam(query, 'time')) {
    requireValue(
      typeof query.time === 'string' && TIME_PATTERN.test(query.time),
      'Time dùng YYYY-MM-DD[ HH[:mm[:ss]]].',
    );
    const text = query.time.replace('T', ' ');
    const { suffix, unit } = TIME_PRECISION[text.length];
    const start = DateTime.fromFormat(text + suffix, 'yyyy-MM-dd HH:mm:ss', {
      zone: config.timeZone,
    });
    requireValue(start.isValid, 'Thời gian không hợp lệ.');
    // Lấy mọi bản ghi trong [start, start + 1 đơn vị).
    filter.add(column + '>=?', start.toJSDate());
    filter.add(column + '<?', start.plus({ [unit]: 1 }).toJSDate());
  }
}

// Escape ký tự đặc biệt của LIKE (% và _) để người dùng tìm đúng chữ đã gõ.
const escapeLike = (text) => text.replace(/!/g, '!!').replace(/%/g, '!%').replace(/_/g, '!_');

/**
 * Thêm các bộ lọc riêng của lịch sử điều khiển (bảng ActionHistory `a`, Devices `d`).
 */
export function addActionFilters(filter, query) {
  // Lọc theo ID thiết bị / người dùng.
  if (hasParam(query, 'deviceId')) filter.add('a.device_id=?', parseId(query.deviceId));
  if (hasParam(query, 'userId')) filter.add('a.user_id=?', parseId(query.userId));

  // Lọc theo các cột chỉ nhận một số giá trị cố định.
  const choices = { action: DEVICE_ACTIONS, status: ACTION_STATUSES, source: ACTION_SOURCES };
  for (const [key, allowed] of Object.entries(choices)) {
    if (!hasParam(query, key)) continue;
    requireValue(allowed.includes(query[key]));
    filter.add('a.' + key + '=?', query[key]);
  }

  // Ô tìm kiếm tự do `q`: khớp tên thiết bị, action, status hoặc source (không phân biệt hoa thường).
  if (hasParam(query, 'q')) {
    requireValue(typeof query.q === 'string' && query.q.length <= 100);
    const search = '%' + escapeLike(query.q) + '%';
    const columns = ['d.name', 'a.action', 'a.status', 'a.source'];
    const conditions = columns.map((col) => `LOWER(${col}) LIKE LOWER(?) ESCAPE '!'`);
    filter.add('(' + conditions.join(' OR ') + ')', ...columns.map(() => search));
  }
}
