// =============================================================
// Các hàm kiểm tra dữ liệu đầu vào. Sai => ném HttpError 400.
// =============================================================
import { HttpError } from './httpError.js';
import { DEVICE_ACTIONS } from '../config/constants.js';

// Nếu điều kiện sai thì dừng xử lý và trả lỗi 400 cho client.
export function requireValue(condition, message = 'Dữ liệu không hợp lệ.') {
  if (!condition) throw new HttpError(400, 'VALIDATION_ERROR', message);
}

// Đọc ID số nguyên dương từ URL. Chấp nhận cả dạng có tiền tố 'A' (vd. 'A15' -> 15).
export function parseId(value) {
  const n = Number(String(value).replace(/^A/, ''));
  requireValue(Number.isSafeInteger(n) && n > 0, 'ID không hợp lệ.');
  return n;
}

// Lệnh điều khiển thiết bị chỉ được là 'ON' hoặc 'OFF'.
export function validateAction(value) {
  requireValue(DEVICE_ACTIONS.includes(value), 'Chỉ hỗ trợ ON/OFF.');
}
