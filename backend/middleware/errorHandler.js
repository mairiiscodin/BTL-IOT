// Lỗi ràng buộc của MySQL do dữ liệu client gửi sai => trả 400 thay vì 500.
const MYSQL_CLIENT_ERRORS = [
  'ER_DUP_ENTRY', // trùng khoá UNIQUE
  'ER_NO_REFERENCED_ROW_2', // khoá ngoại trỏ tới dòng không tồn tại
  'ER_CHECK_CONSTRAINT_VIOLATED', // vi phạm CHECK
  'ER_DATA_TOO_LONG', // chuỗi dài quá cột
];

/**
 * Middleware xử lý lỗi cuối cùng của Express (4 tham số).
 * Mọi lỗi ném ra trong route/service đều về đây và được trả về dạng:
 *   { error: { code, message } }
 * Lỗi 500 không lộ chi tiết cho client, chỉ ghi log ở server.
 */
export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  let status = error.status || 500;
  if (MYSQL_CLIENT_ERRORS.includes(error.code)) status = 400;

  if (status >= 500) console.error('Request failed:', error.code || error.name);

  const isServerError = status === 500;
  res.status(status).json({
    error: {
      code: isServerError ? 'INTERNAL_ERROR' : error.code || 'VALIDATION_ERROR',
      message: isServerError ? 'Lỗi xử lý máy chủ.' : error.message,
    },
  });
}
