import React, { useState } from 'react';
import { download, queryString } from '../api/client';
import { Header, Table, ErrorBox, Icon, useData, date } from '../components';
export function HistoryPage({ revision }) {
  // Quan ly tu khoa, bo loc, khoang thoi gian, phan trang va loi xuat CSV.
  const [limit, setLimit] = useState(10);
  const [q, setQuery] = useState(''),
    [page, setPage] = useState(1),
    [exportError, setExportError] = useState('');
  const [filters, setFilters] = useState({});
  const [timeRange, setTimeRange] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  // Lay nguoi dung hien tai de tao lua chon loc nguoi thuc hien.
  const { result: userResult } = useData('/auth/me');
  // Cap nhat mot bo loc, quay ve trang dau va xoa loi xuat CSV cu.
  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
    setExportError('');
  }
  // Kiem tra khoang ngay va tao moc dau/cuoi ngay theo mui gio +07:00 de loc lich su.
  function updateDateRange(from, to) {
    if (from && to && from > to) return;
    setFilters((current) => ({
      ...current,
      from: from ? `${from}T00:00:00+07:00` : '',
      to: to ? `${to}T23:59:59.999+07:00` : '',
    }));
    setPage(1);
    setExportError('');
  }
  // Tai lich su theo tu khoa, bo loc va phan trang; tai lai khi revision thay doi.
  const { result, error, loading } = useData(
    `/actions?${queryString({ q, ...filters, page, limit })}`,
    revision,
  );
  return (
    <>
      {/* Hien thi tieu de trang lich su dieu khien. */}
      <Header title="Actuator Command Logs" subtitle="View all device state changes" />
      {/* Tim kiem lenh va tai CSV theo tu khoa, bo loc hien tai. */}
      <div className="row toolbar">
        <div className="input-icon">
          <Icon name="imgSearch" group="2_348" />
          <input
            aria-label="Search commands"
            placeholder="Search commands..."
            value={q}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <button
          onClick={() =>
            download(`/actions/export?${queryString({ q, ...filters })}`).catch((error) =>
              setExportError(error.message),
            )
          }
        >
          <Icon name="imgLogOut1" group="2_348" />
          Export CSV
        </button>
      </div>
      {/* Loc theo nguoi thuc hien, lenh, trang thai va thoi gian; Reset xoa dieu kien tim kiem. */}
      <div className="card filters action-filters">
        <label>
          Người thực hiện
          <select
            aria-label="Lọc người thực hiện"
            value={filters.userId || ''}
            onChange={(event) => updateFilter('userId', event.target.value)}
          >
            <option value="">Tất cả người thực hiện</option>
            {userResult?.data && (
              <option value={userResult.data.id}>{userResult.data.fullName}</option>
            )}
          </select>
        </label>
        <label>
          Triggered Action
          <select
            aria-label="Filter action"
            value={filters.action || ''}
            onChange={(event) => updateFilter('action', event.target.value)}
          >
            <option value="">All Actions</option>
            <option value="ON">TURN ON</option>
            <option value="OFF">TURN OFF</option>
          </select>
        </label>
        <label>
          Status
          <select
            aria-label="Filter status"
            value={filters.status || ''}
            onChange={(event) => updateFilter('status', event.target.value)}
          >
            <option value="">All Statuses</option>
            {['loading', 'on', 'off', 'timeout', 'error'].map((status) => (
              <option key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Execution Time
          <select
            aria-label="Filter execution time"
            value={timeRange}
            onChange={(event) => {
              // Chon khoang ngay tuy chinh hoac tinh khoang Today/7 ngay/30 ngay theo gio Viet Nam.
              const value = event.target.value;
              setTimeRange(value);
              if (value === 'custom') {
                updateDateRange(fromDate, toDate);
                return;
              }
              const today = date(new Date()).slice(0, 10);
              const start = new Date(`${today}T00:00:00+07:00`);
              start.setTime(start.getTime() - (Number(value || 1) - 1) * 86400000);
              setFilters((current) => ({
                ...current,
                from: value ? `${date(start).slice(0, 10)}T00:00:00+07:00` : '',
                to: value ? `${today}T23:59:59.999+07:00` : '',
              }));
              setPage(1);
              setExportError('');
            }}
          >
            <option value="">All Time</option>
            <option value="1">Today</option>
            <option value="7">Last 7 Days</option>
            <option value="30">Last 30 Days</option>
            <option value="custom">Custom Date Range</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => {
            setFilters({});
            setTimeRange('');
            setFromDate('');
            setToDate('');
            setQuery('');
            setPage(1);
            setExportError('');
          }}
        >
          Reset
        </button>
        {/* Hien thi hai o ngay khi chon khoang tuy chinh va ap dung khi ngay hop le. */}
        {timeRange === 'custom' && (
          <div className="action-date-range">
            <label>
              From Date
              <input
                type="date"
                aria-label="Execution from date"
                value={fromDate}
                max={toDate || undefined}
                onChange={(event) => {
                  const value = event.target.value;
                  setFromDate(value);
                  if (event.target.validity.valid) updateDateRange(value, toDate);
                }}
              />
            </label>
            <label>
              To Date
              <input
                type="date"
                aria-label="Execution to date"
                value={toDate}
                min={fromDate || undefined}
                onChange={(event) => {
                  const value = event.target.value;
                  setToDate(value);
                  if (event.target.validity.valid) updateDateRange(fromDate, value);
                }}
              />
            </label>
          </div>
        )}
      </div>
      {/* Hien thi loi tai/xuat du lieu va bang lich su co phan trang, dinh dang trang thai va thoi gian. */}
      <ErrorBox message={error || exportError} />
      <Table
        rows={result?.data || []}
        pagination={result?.pagination}
        onPage={setPage}
        pageSize={limit}
        onPageSizeChange={(size) => {
          setLimit(size);
          setPage(1);
        }}
        loading={loading}
        columns={[
          { key: 'id', label: 'ID', render: (row) => `A${row.id}` },
          { key: 'deviceName', label: 'Actuator Name' },
          { key: 'userName', label: 'Người thực hiện' },
          { key: 'action', label: 'Triggered Action', render: (row) => `TURN ${row.action}` },
          {
            key: 'status',
            label: 'Status',
            render: (row) => (
              <span className={`badge ${row.status}`}>
                {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
              </span>
            ),
          },
          { key: 'createdAt', label: 'Execution Time', render: (row) => date(row.createdAt) },
        ]}
      />
    </>
  );
}
