import { db } from '../config/db.js';
import { filter, timeFilters, actionFilters, present } from '../utils/query.js';
import { requireValue } from '../utils/httpError.js';
import { ranges } from '../utils/validation.js';
async function result(f, columns, joins, order) {
  const total = await db.count('SELECT COUNT(*)' + joins + f.where(), f.args);
  const rows = await db.list(
    'SELECT ' + columns + joins + f.where() + ' ORDER BY ' + order + ' LIMIT ? OFFSET ?',
    [...f.args, f.limit, (f.page - 1) * f.limit],
  );
  return {
    data: rows,
    pagination: { page: f.page, limit: f.limit, total, totalPages: Math.ceil(total / f.limit) },
  };
}
export async function sensors(q, exporting = false) {
  const f = filter(q, exporting);
  if (present(q, 'type')) {
    requireValue(['temperature', 'humidity', 'light'].includes(q.type));
    f.add('s.type=?', q.type);
  }
  for (const key of ['valueMin', 'valueMax'])
    if (present(q, key)) {
      const n = Number(q[key]);
      requireValue(Number.isFinite(n));
      f.add('d.value' + (key === 'valueMin' ? '>=' : '<=') + '?', n);
    }
  requireValue(
    !present(q, 'valueMin') || !present(q, 'valueMax') || Number(q.valueMin) <= Number(q.valueMax),
  );
  timeFilters(f, q, 'd.measured_at');
  return result(
    f,
    'd.id,d.sensor_id,s.type AS sensor_type,s.unit,d.value,d.measured_at AS timestamp',
    ' FROM SensorData d JOIN Sensors s ON s.id=d.sensor_id',
    'd.measured_at DESC,d.id DESC',
  );
}
export async function actions(user, q, exporting = false) {
  const f = filter(q, exporting);
  f.add('a.user_id=?', user);
  actionFilters(f, q);
  timeFilters(f, q, 'a.created_at');
  return result(
    f,
    'a.*,d.name AS device_name,u.full_name AS user_name',
    ' FROM ActionHistory a JOIN Devices d ON d.id=a.device_id JOIN Users u ON u.id=a.user_id',
    'a.created_at DESC,a.id DESC',
  );
}
export async function chart(range = '24H') {
  requireValue(Object.hasOwn(ranges, range), 'Khoảng biểu đồ không hợp lệ.');
  const seconds = ranges[range];
  return db.list(
    'SELECT s.type AS sensor_type,s.unit,AVG(d.value) AS value,MIN(d.measured_at) AS timestamp FROM SensorData d JOIN Sensors s ON s.id=d.sensor_id WHERE d.measured_at>=? GROUP BY s.type,s.unit,FLOOR(UNIX_TIMESTAMP(d.measured_at)/?) ORDER BY timestamp',
    [new Date(Date.now() - seconds * 1000), Math.max(1, seconds / 240)],
  );
}
export function csv(result) {
  requireValue(
    result.pagination.total <= 100000,
    'Hãy thu hẹp khoảng thời gian xuống tối đa 100.000 bản ghi.',
  );
  const line = (values) =>
    values
      .map((value) => {
        let s = value == null ? '' : String(value);
        if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
        return '"' + s.replace(/"/g, '""') + '"';
      })
      .join(',') + '\r\n';
  return (
    '\ufeff' +
    (result.data.length
      ? line(Object.keys(result.data[0])) +
        result.data.map((row) => line(Object.values(row))).join('')
      : '')
  );
}
