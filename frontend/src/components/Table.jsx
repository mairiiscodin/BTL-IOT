import React from 'react';

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100];

/**
 * Chọn các số trang sẽ hiện trên thanh phân trang:
 * trang đầu, trang cuối, trang hiện tại và 2 trang kề bên.
 * Ví dụ: current = 5, total = 10 -> [1, 4, 5, 6, 10]  (hiển thị: 1 … 4 5 6 … 10)
 */
function getVisiblePages(current, total) {
  const pages = new Set([1, total, current - 1, current, current + 1]);
  // Ở gần đầu/cuối thì hiện thêm vài trang để thanh phân trang không bị quá ngắn.
  if (current <= 2) [2, 3].forEach((p) => pages.add(p));
  if (current >= total - 1) [total - 2, total - 1].forEach((p) => pages.add(p));
  return [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
}

/**
 * Bảng dữ liệu dùng chung (Data Sensor, Action History).
 * @param rows        mảng dữ liệu, mỗi dòng cần có `id`
 * @param columns     [{ key, label, render?(row) }] - render dùng khi cần tuỳ biến ô
 * @param pagination  { page, limit, total, totalPages } từ API
 * @param onPage      gọi với số trang mới
 * @param pageSize / onPageSizeChange  chọn số dòng mỗi trang (tuỳ chọn)
 */
export function Table({ rows, columns, pagination, onPage, loading, pageSize, onPageSizeChange }) {
  const totalPages = Math.max(1, pagination?.totalPages || 1);
  const currentPage = pagination?.page || 1;
  const visiblePages = getVisiblePages(currentPage, totalPages);

  return (
    <section className="card table-card">
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key}>{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                {columns.map((column) => (
                  <td key={column.key}>{column.render ? column.render(row) : row[column.key]}</td>
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
          <PageSummary pagination={pagination} />
          <div>
            {onPageSizeChange && (
              <label className="page-size-control">
                Số dòng / trang:
                <select
                  value={pageSize}
                  onChange={(event) => onPageSizeChange(Number(event.target.value))}
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
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
              disabled={loading || currentPage <= 1}
              onClick={() => onPage(currentPage - 1)}
            >
              ‹
            </button>

            {visiblePages.map((page, index) => (
              <React.Fragment key={page}>
                {/* Hai số trang không liền nhau => chèn dấu "…" ở giữa. */}
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
              disabled={loading || currentPage >= pagination.totalPages}
              onClick={() => onPage(currentPage + 1)}
            >
              ›
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

// Dòng "Hiển thị 11–20 trong 57 bản ghi".
function PageSummary({ pagination }) {
  const { page, limit, total } = pagination;
  const first = total ? (page - 1) * limit + 1 : 0;
  const last = Math.min(page * limit, total);
  return (
    <p>
      Hiển thị {first}–{last} trong {total} bản ghi
    </p>
  );
}
