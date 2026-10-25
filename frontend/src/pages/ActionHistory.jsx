import React, { useState } from 'react';
import { download, queryString } from '../api/client';
import { Header, Table, ErrorBox, Icon, CopyTime } from '../components';
import { useData } from '../hooks/useData';
import { formatDateTime } from '../utils/dateTime';
import { capitalize } from '../utils/format';

const ACTION_STATUSES = ['loading', 'on', 'off', 'timeout', 'error'];

/**
 * Đổi chuỗi người dùng gõ 'dd-mm-yyyy hh:mm' sang dạng API cần 'yyyy-mm-dd hh:mm'.
 * Chưa gõ xong hoặc ngày không tồn tại (vd. 31-02-2025) => trả về '' (chưa lọc).
 */
function parseTimeInput(text) {
  const match = /^(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2})$/.exec(text);
  if (!match) return '';
  const [, dd, mm, yyyy, hh, min] = match;
  // Tạo Date rồi so lại từng phần: nếu JS phải "tràn" sang ngày khác thì ngày nhập không hợp lệ.
  const parsed = new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min));
  const valid =
    parsed.getFullYear() === Number(yyyy) &&
    parsed.getMonth() === Number(mm) - 1 &&
    parsed.getDate() === Number(dd) &&
    Number(hh) < 24 &&
    Number(min) < 60;
  return valid ? `${yyyy}-${mm}-${dd} ${hh}:${min}` : '';
}

// Cấu hình các cột của bảng lịch sử.
const COLUMNS = [
  { key: 'id', label: 'ID', render: (row) => `A${row.id}` },
  { key: 'deviceName', label: 'Actuator Name' },
  { key: 'userName', label: 'Người thực hiện' },
  { key: 'action', label: 'Triggered Action', render: (row) => `TURN ${row.action}` },
  {
    key: 'status',
    label: 'Status',
    render: (row) => <span className={`badge ${row.status}`}>{capitalize(row.status)}</span>,
  },
  {
    key: 'createdAt',
    label: 'Execution Time',
    render: (row) => {
      const time = formatDateTime(row.createdAt);
      return <CopyTime value={time}>{time}</CopyTime>;
    },
  },
];

/**
 * Trang lịch sử bật/tắt thiết bị: lọc, phân trang và xuất CSV.
 * @param revision tăng khi có sự kiện thiết bị mới => bảng tự tải lại
 */
export function HistoryPage({ revision }) {
  const [filters, setFilters] = useState({}); // { deviceId, action, status, time }
  const [timeText, setTimeText] = useState(''); // nội dung ô Time đúng như người dùng gõ
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [exportError, setExportError] = useState('');

  // Danh sách thiết bị cho ô chọn "Actuator Name".
  const { result: deviceResult } = useData('/devices');
  // Dữ liệu bảng: tự tải lại khi đổi bộ lọc/trang hoặc khi revision tăng.
  const { result, error, loading } = useData(
    `/actions?${queryString({ ...filters, page, limit })}`,
    revision,
  );

  // Đổi một bộ lọc => quay về trang 1.
  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
    setExportError('');
  }

  // Gõ ô Time: luôn cập nhật chữ hiển thị, chỉ lọc khi gõ đủ và đúng định dạng.
  function updateTime(text) {
    setTimeText(text);
    setFilters((current) => ({ ...current, time: parseTimeInput(text), from: '', to: '' }));
    setPage(1);
    setExportError('');
  }

  function resetFilters() {
    setFilters({});
    setTimeText('');
    setPage(1);
    setExportError('');
  }

  // Xuất CSV theo bộ lọc hiện tại (không kèm page/limit để lấy hết).
  function exportCsv() {
    download(`/actions/export?${queryString(filters)}`).catch((e) => setExportError(e.message));
  }

  return (
    <>
      <Header title="Actuator Command Logs" subtitle="View all device state changes" />

      <div className="row toolbar">
        <button onClick={exportCsv}>
          <Icon name="imgLogOut1" group="2_348" />
          Export CSV
        </button>
      </div>

      {/* Bộ lọc: áp dụng ngay khi gõ/chọn. */}
      <div className="card filters action-filters">
        <label>
          Time
          <input
            aria-label="Thời gian"
            placeholder="dd-mm-yyyy hh:mm"
            value={timeText}
            onChange={(event) => updateTime(event.target.value)}
          />
        </label>
        <label>
          Actuator Name
          <select
            aria-label="Lọc tên thiết bị"
            value={filters.deviceId || ''}
            onChange={(event) => updateFilter('deviceId', event.target.value)}
          >
            <option value="">All device</option>
            {(deviceResult?.data || []).map((device) => (
              <option key={device.id} value={device.id}>
                {device.name}
              </option>
            ))}
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
            {ACTION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {capitalize(status)}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={resetFilters}>
          Reset
        </button>
      </div>

      <ErrorBox message={error || exportError} />
      <Table
        rows={result?.data || []}
        columns={COLUMNS}
        pagination={result?.pagination}
        loading={loading}
        onPage={setPage}
        pageSize={limit}
        onPageSizeChange={(size) => {
          setLimit(size);
          setPage(1);
        }}
      />
    </>
  );
}
