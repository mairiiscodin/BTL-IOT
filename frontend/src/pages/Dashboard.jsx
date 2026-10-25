import React, { useState, useEffect } from 'react';
import { request } from '../api/client';
import { Header, Icon, Toggle, HistoryChart, asset } from '../components';
import { SENSORS } from '../data/sensors';
import { formatDateTime } from '../utils/dateTime';

// Số đo cũ hơn 15 giây bị coi là "không còn mới" (ESP32 gửi mỗi 3 giây).
const FRESH_MS = 15000;
const SENSOR_COUNT = 3;

// Mô tả ngắn cho từng thiết bị theo id.
const DEVICE_DESCRIPTIONS = {
  1: 'Primary room lighting system',
  2: 'Backup emergency lux generator',
};

const isFresh = (timestamp, now) => Boolean(timestamp) && now - Date.parse(timestamp) < FRESH_MS;

/**
 * Màn hình giám sát chính. Dữ liệu (latest, devices, system...) do App tải và truyền xuống.
 * @param latest      số đo mới nhất của các cảm biến
 * @param devices     danh sách thiết bị
 * @param connected   WebSocket đã kết nối hay chưa
 * @param system      { mqttConnected, databaseConnected }
 * @param revision    tăng lên khi có dữ liệu mới (để biểu đồ tải lại)
 * @param refreshCore hàm tải lại latest/devices/system
 * @param setToast    hiện thông báo nhỏ góc màn hình
 * @param canControl  true nếu người dùng là admin (viewer chỉ được xem, không bật/tắt)
 */
export function Dashboard({
  latest,
  devices,
  connected,
  system,
  revision,
  refreshCore,
  setToast,
  canControl,
}) {
  // { [deviceId]: true } khi đang gửi lệnh cho thiết bị đó => khoá công tắc.
  const [sending, setSending] = useState({});

  // Đồng hồ cập nhật mỗi giây để kiểm tra số đo còn mới hay không.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Dữ liệu "cũ" khi thiếu cảm biến hoặc có cảm biến quá 15 giây không gửi số đo.
  const stale =
    latest.length !== SENSOR_COUNT ||
    latest.some((sensor) => !sensor.timestamp || now - Date.parse(sensor.timestamp) > FRESH_MS);

  // Bật/tắt thiết bị: gửi lệnh ngược với trạng thái hiện tại.
  async function toggleDevice(device) {
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

  // Thông báo khi mất kết nối, ưu tiên lỗi nghiêm trọng nhất.
  let warning = '';
  if (!connected) warning = 'Mất kết nối máy chủ.';
  else if (!system.mqttConnected) warning = 'MQTT chưa kết nối.';
  else if (stale) warning = 'Đang hiển thị số đo gần nhất; chờ dữ liệu mới.';

  return (
    <>
      <Header
        title="IoT Live Monitoring"
        subtitle="Real-time environmental performance & actuators"
      />

      {warning && <div className="connection-banner">{warning}</div>}

      <HistoryChart revision={revision} />

      <div className="dashboard-bottom">
        {/* Cột trái: số đo cảm biến. */}
        <section className="card sensors-panel" aria-labelledby="sensors-panel-title">
          <div className="devices-panel-header">
            <h2 id="sensors-panel-title">Live Sensor Readings</h2>
            <span className="devices-count">{latest.length} sensors</span>
          </div>
          <div className="metrics">
            {latest.map((sensor) => (
              <SensorCard key={sensor.sensorId} sensor={sensor} now={now} />
            ))}
            {!latest.length && <p className="empty">Đang tải số đo cảm biến…</p>}
          </div>
        </section>

        {/* Cột phải: bảng điều khiển thiết bị. */}
        <section className="card devices-panel" aria-labelledby="devices-panel-title">
          <div className="devices-panel-header">
            <h2 id="devices-panel-title">Actuators Control Panel</h2>
            <span className="devices-count">{devices.length} devices</span>
          </div>
          {!canControl && (
            <p className="empty">Tài khoản viewer chỉ được xem, không thể bật/tắt thiết bị.</p>
          )}
          <div className="devices-list" role="region" aria-label="Device list" tabIndex={0}>
            {devices.map((device) => (
              <DeviceRow
                key={device.id}
                device={device}
                busy={sending[device.id]}
                canControl={canControl}
                onToggle={() => toggleDevice(device)}
              />
            ))}
            {!devices.length && <p className="empty">Chưa có thiết bị.</p>}
          </div>
        </section>
      </div>
    </>
  );
}

// Thẻ một cảm biến: tên, số đo, mức thay đổi so với lần đo trước, thời gian cập nhật.
function SensorCard({ sensor, now }) {
  const { color, icon, sparkline } = SENSORS[sensor.sensorType];
  // Chênh lệch với số đo trước (làm tròn 2 chữ số); chưa có số đo trước thì không hiện.
  const delta =
    sensor.previousValue == null ? null : Number((sensor.value - sensor.previousValue).toFixed(2));

  return (
    <section className="metric">
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
          <img src={asset(sparkline)} alt="" />
        </span>
      </div>
      <footer>
        Last updated:{' '}
        {isFresh(sensor.timestamp, now) ? 'Just now' : formatDateTime(sensor.timestamp)}
      </footer>
    </section>
  );
}

// Nhãn trạng thái thiết bị, theo thứ tự ưu tiên: đang chờ ACK > offline > bật > tắt.
function deviceStatusLabel(device) {
  if (device.pendingActionId) return 'LOADING';
  if (device.connectionStatus === 'offline') return 'OFFLINE';
  return device.currentStatus === 'on' ? 'ACTIVE' : 'OFF';
}

// Một dòng thiết bị: icon, tên, trạng thái và công tắc.
// Công tắc bị khoá khi đang gửi lệnh, đang chờ ESP32 ACK lệnh trước, hoặc người dùng là viewer.
function DeviceRow({ device, busy, canControl, onToggle }) {
  const isOn = device.currentStatus === 'on';
  const name = `Device ${device.id} (${device.name})`;
  return (
    <div className={`device ${isOn ? 'active' : ''}`}>
      <span className={`device-icon ${isOn ? 'on' : ''}`}>
        <Icon name="imgSun1" />
      </span>
      <div className="device-info">
        <h3>{name}</h3>
        <p>{DEVICE_DESCRIPTIONS[device.id] ?? DEVICE_DESCRIPTIONS[2]}</p>
        <span
          className={`device-status ${device.pendingActionId ? 'loading' : device.currentStatus}`}
        >
          <i />
          {deviceStatusLabel(device)}
        </span>
      </div>
      <Toggle
        label={name}
        value={isOn}
        disabled={!canControl || busy || Boolean(device.pendingActionId)}
        onChange={onToggle}
      />
    </div>
  );
}
