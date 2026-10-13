export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  let status = error.status || 500;
  if (
    [
      'ER_DUP_ENTRY',
      'ER_NO_REFERENCED_ROW_2',
      'ER_CHECK_CONSTRAINT_VIOLATED',
      'ER_DATA_TOO_LONG',
    ].includes(error.code)
  )
    status = 400;
  if (status >= 500) console.error('Request failed:', error.code || error.name);
  res.status(status).json({
    error: {
      code: status === 500 ? 'INTERNAL_ERROR' : error.code || 'VALIDATION_ERROR',
      message: status === 500 ? 'Lỗi xử lý máy chủ.' : error.message,
    },
  });
}
