// Bộ định dạng ngày giờ theo giờ Việt Nam, 24h. Tạo một lần rồi dùng lại cho nhanh.
const formatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

/**
 * Chuỗi ISO từ API -> 'YYYY-MM-DD HH:mm:ss' (giờ Việt Nam).
 * Ví dụ: '2025-01-31T01:00:00.000Z' -> '2025-01-31 08:00:00'.
 */
export function formatDateTime(value) {
  if (!value) return 'Chưa có dữ liệu';
  // formatToParts trả về mảng [{ type: 'year', value: '2025' }, ...] => đổi thành object.
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date(value)).map(({ type, value: part }) => [type, part]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

// Chỉ lấy giờ:phút theo giờ máy người dùng, dùng cho trục thời gian biểu đồ.
export function formatHourMinute(timestamp) {
  return new Date(timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}
