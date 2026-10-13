export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
export function requireValue(condition, message = 'Dữ liệu không hợp lệ.') {
  if (!condition) throw new HttpError(400, 'VALIDATION_ERROR', message);
}
export function id(value) {
  const n = Number(String(value).replace(/^A/, ''));
  requireValue(Number.isSafeInteger(n) && n > 0, 'ID không hợp lệ.');
  return n;
}
