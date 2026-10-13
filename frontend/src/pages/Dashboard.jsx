import { isDemo } from '../api/config';
import React, { useState, useEffect } from 'react';
import { request } from '../api/client';
import { Header, Icon, Toggle, date, asset } from '../components';
import { HistoryChart } from '../components/HistoryChart';
// Cau hinh mau, icon va anh trang tri cho tung loai cam bien.
const visuals = {
  temperature: ['red', 'imgThermometer', 'imgSparkline'],
  humidity: ['blue', 'imgDroplet', 'imgSparkline1'],
  light: ['amber', 'imgSun', 'imgSparkline2'],
};
// Nhan du lieu va cac ham xu ly tu App de hien thi man hinh giam sat.
export function Dashboard({ latest, devices, connected, system, revision, refreshCore, setToast }) {
  // Quan ly trang thai gui lenh va cap nhat dong ho de kiem tra do moi cua so do.
  const [sending, setSending] = useState({});
  const [clock, setClock] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  // Kiem tra du lieu thieu cam bien, thieu thoi gian do hoac da qua 15 giay.
  const stale =
    latest.length !== 3 ||
    latest.some((s) => !s.timestamp || clock - Date.parse(s.timestamp) > 15000);
  // Dieu khien thiet bi: khoa cong tac, gui lenh bat/tat, tai lai du lieu va bao loi neu co.
  async function control(device) {
    setSending((s) => ({ ...s, [device.id]: true }));
    try {
      await request(`/devices/${device.id}/actions`, {
        method: 'POST',
        body: { action: device.currentStatus === 'on' ? 'OFF' : 'ON' },
      });
      await refreshCore();
    } catch (error) {
      setToast(error.message);
    } finally {
      setSending((s) => ({ ...s, [device.id]: false }));
    }
  }
  return (
    <>
      {/* Hien thi tieu de man hinh. */}
      <Header
        title="IoT Live Monitoring"
        subtitle="Real-time environmental performance & actuators"
      />
      {/* Canh bao mat ket noi may chu, MQTT hoac du lieu cu trong che do API. */}
      {!isDemo && (!connected || !system.mqttConnected || stale) && (
        <div className="connection-banner">
          {!connected
            ? 'Mất kết nối máy chủ.'
            : !system.mqttConnected
              ? 'MQTT chưa kết nối.'
              : 'Đang hiển thị số đo gần nhất; chờ dữ liệu mới.'}
        </div>
      )}
      {/* Hien thi bieu do lich su 24 gio, tai lai khi revision thay doi. */}
      <HistoryChart range="24H" revision={revision} />
      <div className="dashboard-bottom">
        {/* Hien thi cac cam bien: ten, so do, don vi, chenh lech va thoi gian cap nhat. */}
        <section className="card sensors-panel" aria-labelledby="sensors-panel-title">
          <div className="devices-panel-header">
            <h2 id="sensors-panel-title">Live Sensor Readings</h2>
            <span className="devices-count">{latest.length} sensors</span>
          </div>
          <div className="metrics">
            {latest.map((sensor) => {
              const [color, icon, spark] = visuals[sensor.sensorType];
              const delta =
                sensor.previousValue == null
                  ? null
                  : Number((sensor.value - sensor.previousValue).toFixed(2));
              return (
                <section className="metric" key={sensor.sensorId}>
                  <div className="row">
                    <h3>{sensor.name}</h3>
                    <span className={`metric-icon ${color}`}>
                      <Icon name={icon} />
                    </span>
                  </div>
                  <div className="row value-row">
                    <div>
                      <div className="value">
                        {sensor.value ?? '—'}
                        <span>{sensor.unit}</span>
                      </div>
                      {delta != null && (
                        <div className={`trend ${delta < 0 ? 'negative' : ''}`}>
                          <Icon name={delta < 0 ? 'imgTrendingDown' : 'imgTrendingUp'} />
                          {delta >= 0 ? '+' : ''}
                          {delta}
                          {sensor.unit}
                        </div>
                      )}
                    </div>
                    <span className="sparkline">
                      <img src={asset(spark)} alt="" />
                    </span>
                  </div>
                  <footer>
                    Last updated:{' '}
                    {isDemo
                      ? 'Sample data'
                      : sensor.timestamp && clock - Date.parse(sensor.timestamp) < 15000
                        ? 'Just now'
                        : date(sensor.timestamp)}
                  </footer>
                </section>
              );
            })}
            {!latest.length && <p className="empty">Đang tải số đo cảm biến…</p>}
          </div>
        </section>
        {/* Hien thi thiet bi, trang thai va cong tac; khoa thao tac khi dang gui hoac cho lenh. */}
        <section className="card devices-panel" aria-labelledby="devices-panel-title">
          <div className="devices-panel-header">
            <h2 id="devices-panel-title">Actuators Control Panel</h2>
            <span className="devices-count">{devices.length} devices</span>
          </div>
          <div className="devices-list" role="region" aria-label="Device list" tabIndex={0}>
            {devices.map((device) => (
              <div
                key={device.id}
                className={`device ${device.currentStatus === 'on' ? 'active' : ''}`}
              >
                <span className={`device-icon ${device.currentStatus === 'on' ? 'on' : ''}`}>
                  <Icon name={device.id === 1 ? 'imgCpu1' : 'imgSun1'} />
                </span>
                <div className="device-info">
                  <h3>
                    Device {device.id} ({device.name})
                  </h3>
                  <p>
                    {device.id === 1
                      ? 'Automatic heat extraction system'
                      : 'Backup emergency lux generator'}
                  </p>
                  <span
                    className={`device-status ${device.pendingActionId ? 'loading' : device.currentStatus}`}
                  >
                    <i />
                    {device.pendingActionId
                      ? 'LOADING'
                      : device.connectionStatus === 'offline'
                        ? 'OFFLINE'
                        : device.currentStatus === 'on'
                          ? 'ACTIVE'
                          : 'OFF'}
                  </span>
                </div>
                <Toggle
                  label={`Device ${device.id} (${device.name})`}
                  value={device.currentStatus === 'on'}
                  disabled={sending[device.id] || !!device.pendingActionId}
                  onChange={() => control(device)}
                />
              </div>
            ))}
            {!devices.length && <p className="empty">Chưa có thiết bị.</p>}
          </div>
        </section>
      </div>
    </>
  );
}
