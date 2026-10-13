const vietnamTime = (value) =>
  new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value));
const parseDate = (value) =>
  new Date(
    /(Z|[+-]\d{2}:\d{2})$/.test(value)
      ? value
      : value.replace(' ', 'T') + (value.length === 10 ? 'T00:00:00' : '') + '+07:00',
  ).getTime();
export function filterRows(rows, query, kind) {
  const dateKey = kind === 'sensor' ? 'timestamp' : 'createdAt';
  return rows
    .filter((row) => {
      if (query.type && row.sensorType !== query.type) return false;
      if (query.valueMin && row.value < Number(query.valueMin)) return false;
      if (query.valueMax && row.value > Number(query.valueMax)) return false;
      for (const key of ['deviceId', 'userId', 'action', 'status', 'source'])
        if (query[key] && String(row[key]) !== query[key]) return false;
      if (
        query.q &&
        ![row.deviceName, row.action, row.status, row.source]
          .join(' ')
          .toLowerCase()
          .includes(query.q.toLowerCase())
      )
        return false;
      const time = new Date(row[dateKey]).getTime();
      if (query.from && time < parseDate(query.from)) return false;
      if (query.to && time > parseDate(query.to)) return false;
      if (query.time && !vietnamTime(row[dateKey]).startsWith(query.time.replace('T', ' ')))
        return false;
      return true;
    })
    .sort((a, b) => b[dateKey].localeCompare(a[dateKey]) || b.id - a.id);
}
export function paginate(rows, query) {
  const page = Math.max(1, Number(query.page) || 1),
    limit = Math.max(1, Number(query.limit) || 20);
  return {
    data: rows.slice((page - 1) * limit, page * limit),
    pagination: { page, limit, total: rows.length, totalPages: Math.ceil(rows.length / limit) },
  };
}
export function csvResponse(rows) {
  const cell = (value) => {
    let text = value == null ? '' : String(value);
    if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  const keys = rows.length ? Object.keys(rows[0]) : [];
  const text =
    '\ufeff' +
    [keys, ...rows.map((row) => keys.map((key) => row[key]))]
      .map((row) => row.map(cell).join(','))
      .join('\r\n');
  return new Response(text, { headers: { 'Content-Type': 'text/csv;charset=utf-8' } });
}
