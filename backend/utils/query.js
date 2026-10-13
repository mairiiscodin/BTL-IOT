import { DateTime } from 'luxon';
import { config } from '../config/env.js';
import { requireValue, id } from './httpError.js';
export const present = (q, key) => q[key] != null && q[key] !== '';
export function parseTime(value) {
  requireValue(typeof value === 'string');
  const date = DateTime.fromISO(value.replace(' ', 'T'), { zone: config.zone });
  requireValue(date.isValid, 'Thời gian không hợp lệ.');
  return date.toJSDate();
}
export function filter(q, exporting = false) {
  const page = exporting ? 1 : Number(q.page ?? 1),
    limit = exporting ? 100000 : Number(q.limit ?? 20);
  requireValue(
    Number.isInteger(page) &&
      page >= 1 &&
      page <= 1000000 &&
      Number.isInteger(limit) &&
      limit >= 1 &&
      (exporting || limit <= 200),
    'Phân trang không hợp lệ.',
  );
  const clauses = [],
    args = [];
  return {
    page,
    limit,
    clauses,
    args,
    add(sql, ...values) {
      clauses.push(sql);
      args.push(...values);
    },
    where() {
      return clauses.length ? ' WHERE ' + clauses.join(' AND ') : '';
    },
  };
}
export function timeFilters(f, q, column) {
  let from, to;
  if (present(q, 'from')) {
    from = parseTime(q.from);
    f.add(column + '>=?', from);
  }
  if (present(q, 'to')) {
    to = parseTime(q.to);
    f.add(column + '<=?', to);
  }
  requireValue(!from || !to || from <= to, 'Thời gian bắt đầu phải trước kết thúc.');
  if (present(q, 'time')) {
    requireValue(
      typeof q.time === 'string' &&
        /^\d{4}-\d{2}-\d{2}([ T]\d{2}(:\d{2}(:\d{2})?)?)?$/.test(q.time),
      'Time dùng YYYY-MM-DD[ HH[:mm[:ss]]].',
    );
    const text = q.time.replace('T', ' '),
      suffix = { 10: ' 00:00:00', 13: ':00:00', 16: ':00', 19: '' }[text.length];
    const start = DateTime.fromFormat(text + suffix, 'yyyy-MM-dd HH:mm:ss', { zone: config.zone });
    requireValue(start.isValid, 'Thời gian không hợp lệ.');
    const unit = { 10: 'days', 13: 'hours', 16: 'minutes', 19: 'seconds' }[text.length];
    f.add(column + '>=?', start.toJSDate());
    f.add(column + '<?', start.plus({ [unit]: 1 }).toJSDate());
  }
}
export function actionFilters(f, q) {
  const choices = {
    action: ['ON', 'OFF'],
    status: ['loading', 'on', 'off', 'timeout', 'error'],
    source: ['manual', 'automation', 'scene'],
  };
  for (const key of ['deviceId', 'userId', 'action', 'status', 'source'])
    if (present(q, key)) {
      if (key === 'deviceId' || key === 'userId') id(q[key]);
      else requireValue(choices[key].includes(q[key]));
      const column = { deviceId: 'device_id', userId: 'user_id' }[key] || key;
      f.add('a.' + column + '=?', q[key]);
    }
  if (present(q, 'q')) {
    requireValue(typeof q.q === 'string' && q.q.length <= 100);
    const search = '%' + q.q.replace(/!/g, '!!').replace(/%/g, '!%').replace(/_/g, '!_') + '%';
    f.add(
      "(LOWER(d.name) LIKE LOWER(?) ESCAPE '!' OR LOWER(a.action) LIKE LOWER(?) ESCAPE '!' OR LOWER(a.status) LIKE LOWER(?) ESCAPE '!' OR LOWER(a.source) LIKE LOWER(?) ESCAPE '!')",
      search,
      search,
      search,
      search,
    );
  }
}
