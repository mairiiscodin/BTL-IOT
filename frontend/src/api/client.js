// =============================================================
// Gọi REST API của backend. Tự gắn token đăng nhập và xử lý lỗi chung.
// =============================================================

// Địa chỉ API: mặc định '/api/v1' (Vite proxy chuyển tiếp sang backend, xem vite.config.js).
export const API = import.meta.env.VITE_API_URL || '/api/v1';

// Token lưu trong sessionStorage: tải lại trang vẫn còn, đóng tab là mất.
const TOKEN_KEY = 'iot-token';
let token = sessionStorage.getItem(TOKEN_KEY);

export function getToken() {
  return token;
}

// Lưu token mới (đăng nhập) hoặc xoá token (truyền null khi đăng xuất / hết hạn).
export function setToken(value) {
  token = value;
  if (value) sessionStorage.setItem(TOKEN_KEY, value);
  else sessionStorage.removeItem(TOKEN_KEY);
}

/**
 * Gửi request tới API.
 * @param path    vd. '/devices'
 * @param method  'GET' | 'POST' ...
 * @param body    object sẽ được gửi dạng JSON
 * @param signal  AbortSignal để huỷ request (khi component unmount)
 * @param raw     true => trả về Response gốc (dùng để tải file), false => trả về JSON
 * @throws Error với message lấy từ backend nếu request thất bại
 */
export async function request(path, { method = 'GET', body, signal, raw = false } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(API + path, {
    method,
    signal,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // 401 = token hết hạn => xoá token và báo cho App (App lắng nghe sự kiện 'auth-expired').
  if (response.status === 401 && path !== '/auth/login') {
    setToken(null);
    window.dispatchEvent(new Event('auth-expired'));
  }

  if (!response.ok) {
    // Backend trả lỗi dạng { error: { code, message } }.
    let message;
    try {
      message = (await response.json()).error?.message;
    } catch {
      // body không phải JSON => dùng thông báo mặc định bên dưới
    }
    throw new Error(message || `Request failed (${response.status})`);
  }

  return raw ? response : response.json();
}

// Tải file CSV: lấy dữ liệu dạng Blob rồi tạo thẻ <a download> ảo và bấm vào nó.
export async function download(path) {
  const response = await request(path, { raw: true });
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = 'iot-logs.csv';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000); // giải phóng bộ nhớ sau khi tải
}

// { page: 1, type: '', limit: 10 } -> 'page=1&limit=10' (bỏ các giá trị rỗng).
export function queryString(values) {
  const filled = Object.entries(values).filter(
    ([, value]) => value !== '' && value !== undefined && value !== null,
  );
  return new URLSearchParams(filled).toString();
}
