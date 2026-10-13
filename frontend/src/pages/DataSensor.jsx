import React, { useState } from 'react';
import { queryString } from '../api/client';
import { Header, Table, ErrorBox, Icon, useData, sensorLabels, date } from '../components';
// Cau hinh icon tuong ung voi tung loai cam bien.
const icons = { temperature: 'imgThermometer', humidity: 'imgDroplet', light: 'imgSun' };
export function SensorPage() {
  // Quan ly bo loc, khoang ngay, trang hien tai va so dong moi trang.
  const [limit, setLimit] = useState(10);
  const [filter, setFilter] = useState({}),
    [page, setPage] = useState(1);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  // Tai so do theo bo loc va phan trang; useData quan ly ket qua, loi va trang thai tai.
  const { result, error, loading } = useData(
    `/sensors/data?${queryString({ ...filter, page, limit })}`,
  );
  // Kiem tra form, doi khoang ngay sang mui gio +07:00 va ap dung bo loc tu trang dau.
  function applyFilters(form) {
    if (!form.checkValidity()) return;
    const { fromDate: from, toDate: to, ...values } = Object.fromEntries(new FormData(form));
    if (from && to && from > to) return;
    setPage(1);
    setFilter({
      ...values,
      from: from ? `${from}T00:00:00+07:00` : '',
      to: to ? `${to}T23:59:59.999+07:00` : '',
    });
  }
  return (
    <>
      {/* Hien thi tieu de trang tra cuu so do. */}
      <Header
        title="Sensor Query & Logs"
        subtitle="Search historical log files and export environmental metrics"
      />
      {/* Loc theo ngay, loai cam bien va gia tri toi da; thay doi form de loc, Reset de xoa bo loc. */}
      <form
        className="card filters sensor-filters"
        onChange={(event) => applyFilters(event.currentTarget)}
        onSubmit={(event) => {
          event.preventDefault();
          applyFilters(event.currentTarget);
        }}
        onReset={() => {
          setFromDate('');
          setToDate('');
          setFilter({});
          setPage(1);
        }}
      >
        <label>
          From Date
          <div className="input-icon">
            <input
              name="fromDate"
              type="date"
              aria-label="From Date"
              value={fromDate}
              max={toDate || undefined}
              onChange={(event) => setFromDate(event.target.value)}
            />
          </div>
        </label>
        <label>
          To Date
          <div className="input-icon">
            <input
              name="toDate"
              type="date"
              aria-label="To Date"
              value={toDate}
              min={fromDate || undefined}
              onChange={(event) => setToDate(event.target.value)}
            />
          </div>
        </label>
        <label>
          Sensor Type
          <div className="input-icon">
            <Icon name="imgThermometer" group="2_208" />
            <select name="type">
              <option value="">All Sensors</option>
              {Object.entries(sensorLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </label>
        <label>
          Value Limit
          <div className="input-icon">
            <Icon name="imgChartColumn1" group="2_208" />
            <input
              name="valueMax"
              type="number"
              step="any"
              placeholder="No limits"
              aria-label="Maximum sensor value"
            />
          </div>
        </label>
        <button className="primary">
          <Icon name="imgSearch" group="2_208" />
          Search
        </button>
        <button type="reset">Reset</button>
      </form>
      {/* Hien thi loi va bang so do; ho tro chuyen trang, doi so dong va dinh dang cac cot. */}
      <ErrorBox message={error} />
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
          { key: 'id', label: 'ID', render: (row) => `S${row.id}` },
          {
            key: 'sensorType',
            label: 'Sensor Type',
            render: (row) => (
              <span className="sensor-cell">
                <Icon name={icons[row.sensorType]} group="2_208" />
                {sensorLabels[row.sensorType]}
              </span>
            ),
          },
          { key: 'value', label: 'Value', render: (row) => <strong>{row.value}</strong> },
          { key: 'unit', label: 'Unit' },
          { key: 'timestamp', label: 'Timestamp', render: (row) => date(row.timestamp) },
        ]}
      />
    </>
  );
}
