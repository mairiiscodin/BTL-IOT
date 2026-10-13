import React from 'react';
export function Table({ rows, columns, pagination, onPage, loading, pageSize, onPageSizeChange }) {
  const totalPages = Math.max(1, pagination?.totalPages || 1);
  const currentPage = pagination?.page || 1;
  const visiblePages = [
    ...new Set([
      1,
      totalPages,
      currentPage - 1,
      currentPage,
      currentPage + 1,
      ...(currentPage <= 2 ? [2, 3] : []),
      ...(currentPage >= totalPages - 1 ? [totalPages - 2, totalPages - 1] : []),
    ]),
  ]
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);
  return (
    <section className="card table-card">
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                {columns.map((c) => (
                  <td key={c.key}>{c.render ? c.render(row) : row[c.key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <p className="empty">
            {loading ? 'Đang tải dữ liệu…' : 'Không tìm thấy dữ liệu phù hợp.'}
          </p>
        )}
      </div>
      {pagination && (
        <div className="pagination">
          <p>
            Hiển thị {pagination.total ? (pagination.page - 1) * pagination.limit + 1 : 0}–
            {Math.min(pagination.page * pagination.limit, pagination.total)} trong{' '}
            {pagination.total} bản ghi
          </p>
          <div>
            {onPageSizeChange && (
              <label className="page-size-control">
                Số dòng / trang:
                <select
                  value={pageSize}
                  onChange={(event) => onPageSizeChange(Number(event.target.value))}
                >
                  {[5, 10, 20, 50, 100].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button
              type="button"
              aria-label="Trang trước"
              disabled={loading || pagination.page <= 1}
              onClick={() => onPage(pagination.page - 1)}
            >
              ‹
            </button>
            {visiblePages.map((page, index) => (
              <React.Fragment key={page}>
                {index > 0 && page - visiblePages[index - 1] > 1 && (
                  <span className="pagination-ellipsis">…</span>
                )}
                <button
                  type="button"
                  className={page === currentPage ? 'primary' : undefined}
                  aria-current={page === currentPage ? 'page' : undefined}
                  aria-label={`Trang ${page}`}
                  disabled={loading}
                  onClick={() => onPage(page)}
                >
                  {page}
                </button>
              </React.Fragment>
            ))}
            <button
              type="button"
              aria-label="Trang sau"
              disabled={loading || pagination.page >= pagination.totalPages}
              onClick={() => onPage(pagination.page + 1)}
            >
              ›
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
