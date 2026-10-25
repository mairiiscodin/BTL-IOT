import React, { useState } from 'react';
import { queryString } from '../api/client';
import { Header, Table, ErrorBox, Icon, CopyTime } from '../components';
import { useData } from '../hooks/useData';
import { formatDateTime } from '../utils/dateTime';
import { SENSORS } from '../data/sensors';

// Định dạng mốc thời gian hợp lệ: 'YYYY-MM-DD', thêm ' HH', ':mm', ':ss' tuỳ độ chính xác muốn tìm.
const TIME_PATTERN = /^\d{4}-\d{2}-\d{2}(?: \d{2}(?::\d{2}(?::\d{2})?)?)?$/;

// Cấu hình các cột của bảng số đo.
const COLUMNS = [
  { key: 'id', label: 'ID', render: (row) => `S${row.id}` },
  {
    key: 'sensorType',
    label: 'Sensor Type',
    render: (row) => (
      <span className="sensor-cell">
        <Icon name={SENSORS[row.sensorType]?.icon} group="2_208" />
        {SENSORS[row.sensorType]?.label}
      </span>
    ),
  },
  { key: 'value', label: 'Value', render: (row) => <strong>{row.value}</strong> },
  { key: 'unit', label: 'Unit' },
  {
    key: 'timestamp',
    label: 'Timestamp',
    render: (row) => {
      const time = formatDateTime(row.timestamp);
      return <CopyTime value={time}>{time}</CopyTime>;
    },
  },
];

/**
 * Trang tra cứu số đo cảm biến.
 * Ô "Filter by" chọn loại cảm biến (lọc theo giá trị tối đa) hoặc "Time" (lọc theo mốc thời gian).
 */
export function SensorPage() {
  const [filter, setFilter] = useState({}); // bộ lọc đang áp dụng, gửi lên API
  const [filterBy, setFilterBy] = useState(''); // '' | 'temperature' | 'humidity' | 'light' | 'time'
  const [timeQuery, setTimeQuery] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const { result, error, loading } = useData(
    `/sensors/data?${queryString({ ...filter, page, limit })}`,
  );

  const isTime = filterBy === 'time';

  // Đọc toàn bộ form và áp dụng bộ lọc mới (gọi mỗi khi người dùng gõ/chọn).
  function applyFilters(form) {
    if (!form.checkValidity()) return; // vd. ô số đang chứa chữ
    const {
      filterBy: selected,
      timeQuery: time,
      ...values
    } = Object.fromEntries(new FormData(form));
    // Đang gõ dở mốc thời gian => chờ gõ xong mới lọc.
    if (selected === 'time' && time && !TIME_PATTERN.test(time)) return;
    setPage(1);
    setFilter({
      ...values, // valueMax (khi lọc theo cảm biến)
      type: selected === 'time' ? '' : selected,
      time: selected === 'time' ? time : '',
    });
  }

  function resetFilters() {
    setTimeQuery('');
    setFilterBy('');
    setFilter({});
    setPage(1);
  }

  return (
    <>
      <Header
        title="Sensor Query & Logs"
        subtitle="Search historical log files and export environmental metrics"
      />

      {/* onChange đặt ở <form> => mọi ô bên trong thay đổi đều gọi applyFilters. */}
      <form
        className="card filters sensor-filters"
        onChange={(event) => applyFilters(event.currentTarget)}
        onSubmit={(event) => {
          event.preventDefault();
          applyFilters(event.currentTarget);
        }}
        onReset={resetFilters}
      >
        <label>
          Filter by
          <div className="input-icon">
            <Icon name="imgThermometer" group="2_208" />
            <select
              name="filterBy"
              value={filterBy}
              onChange={(event) => setFilterBy(event.target.value)}
            >
              <option value="">All data</option>
              {Object.entries(SENSORS).map(([key, sensor]) => (
                <option key={key} value={key}>
                  {sensor.label}
                </option>
              ))}
              <option value="time">Time</option>
            </select>
          </div>
        </label>

        {/* Ô thứ hai đổi vai trò theo "Filter by": nhập mốc thời gian hoặc giá trị tối đa. */}
        <label>
          {isTime ? 'Time' : 'Value'}
          <div className="input-icon">
            <Icon
              name={isTime ? 'imgSearch' : 'imgChartColumn1'}
              group={isTime ? '2_348' : '2_208'}
            />
            {isTime ? (
              <input
                key="time"
                name="timeQuery"
                type="text"
                placeholder="YYYY-MM-DD HH:mm:ss"
                aria-label="Search sensor time"
                value={timeQuery}
                onChange={(event) => setTimeQuery(event.target.value)}
              />
            ) : (
              <input
                key="value"
                name="valueMax"
                type="number"
                step="any"
                placeholder="Any value"
                aria-label="Maximum sensor value"
              />
            )}
          </div>
        </label>

        <button type="reset">Reset</button>
      </form>

      <ErrorBox message={error} />
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
