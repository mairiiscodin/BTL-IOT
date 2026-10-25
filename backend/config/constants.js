// =============================================================
// Hằng số dùng chung: topic MQTT, các giá trị hợp lệ, giới hạn...
// Gom về một chỗ để khi cần đổi chỉ sửa ở đây.
// =============================================================

// Topic MQTT giữa backend <-> ESP32 (firmware và simulator dùng đúng các tên này).
export const TOPICS = {
  sensorData: 'iot/sensors/data', // ESP32 gửi số đo cảm biến
  esp32Status: 'iot/esp32/status', // ESP32 báo 'online' / 'offline' (Last Will)
  deviceStatus: 'iot/devices/+/status', // ESP32 báo trạng thái/ACK của từng thiết bị
  deviceCommand: (deviceId) => `iot/devices/${deviceId}/command`, // backend gửi lệnh
};

// Lệnh người dùng có thể gửi cho thiết bị.
export const DEVICE_ACTIONS = ['ON', 'OFF'];

// Trạng thái thật của thiết bị mà ESP32 báo về.
export const DEVICE_STATES = ['on', 'off'];

// Vòng đời một lệnh trong bảng ActionHistory:
// loading (vừa gửi) -> on/off (ESP32 đã ACK) | timeout (quá hạn) | error (gửi MQTT lỗi).
export const ACTION_STATUSES = ['loading', 'on', 'off', 'timeout', 'error'];
export const ACTION_SOURCES = ['manual', 'automation', 'scene'];

// Các loại cảm biến được hỗ trợ.
export const SENSOR_TYPES = ['temperature', 'humidity', 'light'];

// Số bản ghi gần nhất của mỗi cảm biến hiển thị trên biểu đồ.
export const CHART_LIMIT = 30;

// Phân trang và xuất CSV.
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 200;
export const MAX_EXPORT_ROWS = 100000;
