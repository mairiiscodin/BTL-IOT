/**
 * Lỗi có kèm mã HTTP. Ném lỗi này ở bất kỳ đâu (service, controller...),
 * middleware errorHandler sẽ tự trả về JSON: { error: { code, message } }.
 *
 * Ví dụ: throw new HttpError(404, 'NOT_FOUND', 'Không tìm thấy dữ liệu.');
 */
export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status; // mã HTTP: 400, 401, 404, 409...
    this.code = code; // mã lỗi dạng chữ để frontend phân biệt
  }
}
