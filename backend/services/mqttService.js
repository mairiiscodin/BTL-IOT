// =============================================================
// Kết nối MQTT broker: nhận dữ liệu từ ESP32 và gửi lệnh điều khiển xuống ESP32.
//
// Topic nhận (subscribe):
//   iot/sensors/data        { temperature, humidity, light, lightUnit }
//   iot/devices/<id>/status { deviceId, status, actionId? }
//   iot/esp32/status        'online' | 'offline'
// Topic gửi (publish):
//   iot/devices/<id>/command { actionId, deviceId, action, ... }
// =============================================================
import mqtt from 'mqtt';
import { TOPICS } from '../config/constants.js';
import { emit } from '../realtime/socketHub.js';
import { ingestReadings } from './sensorService.js';
import {
  setCommandPublisher,
  handleAck,
  handleReportedState,
  handleAvailability,
} from './deviceService.js';

const MAX_PACKET_BYTES = 4096; // bỏ qua gói tin lớn bất thường
const PUBLISH_TIMEOUT_MS = 3000;
const DEVICE_STATUS_TOPIC = /^iot\/devices\/([1-9][0-9]*)\/status$/; // bắt <id> trong topic

let client;
// Hàng đợi: xử lý lần lượt từng gói tin theo đúng thứ tự đến, tránh ghi DB chồng chéo.
let queue = Promise.resolve();

export const isMqttConnected = () => Boolean(client?.connected);

export function startMqtt() {
  if (process.env.MQTT_ENABLED === 'false') return;

  // Hỗ trợ cả cú pháp kiểu Java 'tcp://' / 'ssl://' từ cấu hình cũ.
  const url = (process.env.MQTT_URL || 'mqtt://127.0.0.1:1883')
    .replace(/^tcp:/, 'mqtt:')
    .replace(/^ssl:/, 'mqtts:');

  client = mqtt.connect(url, {
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
    clean: true,
    connectTimeout: 3000,
    reconnectPeriod: 5000, // mất kết nối thì 5 giây thử lại một lần
    keepalive: 15,
    queueQoSZero: false,
  });

  // Kết nối (hoặc kết nối lại) thành công => đăng ký các topic cần nghe.
  client.on('connect', () => {
    const topics = [TOPICS.sensorData, TOPICS.deviceStatus, TOPICS.esp32Status];
    client.subscribe(topics, { qos: 1 }, (error) => {
      if (error) console.error('MQTT subscribe failed');
      else emit('system.connection', { mqttConnected: true });
    });
  });
  client.on('offline', () => emit('system.connection', { mqttConnected: false }));
  client.on('error', (error) => console.error('MQTT:', error.code || error.name));

  client.on('message', (topic, bytes, packet) => {
    if (bytes.length > MAX_PACKET_BYTES) return;
    queue = queue
      .then(() => handleMessage(topic, bytes.toString(), packet.retain))
      .catch((error) => console.error('Rejected MQTT packet:', error.code || error.name));
  });

  setCommandPublisher(publishCommand);
}

// Đóng kết nối và chờ xử lý xong các gói tin còn trong hàng đợi.
export async function stopMqtt() {
  if (client) await client.endAsync(true);
  await queue;
}

// Phân loại gói tin theo topic rồi chuyển cho service tương ứng.
async function handleMessage(topic, text, retained) {
  if (topic === TOPICS.esp32Status) return handleAvailability(text === 'online', retained);

  const body = JSON.parse(text); // JSON lỗi => ném lỗi, được .catch() ở trên ghi log
  if (topic === TOPICS.sensorData) return ingestReadings(body, retained);

  const match = DEVICE_STATUS_TOPIC.exec(topic);
  if (!match || !body || typeof body !== 'object') return;
  const deviceId = Number(match[1]);
  if (body.deviceId !== deviceId) return; // id trong topic và trong nội dung phải khớp

  // Có actionId => đây là ACK cho một lệnh; không có => chỉ là báo trạng thái định kỳ.
  if (body.actionId != null) await handleAck(deviceId, body.actionId, body.status, retained);
  else await handleReportedState(deviceId, body.status, retained);
}

// Gửi lệnh xuống ESP32 với QoS 1 (broker đảm bảo giao ít nhất 1 lần).
// Trả về Promise: resolve khi broker xác nhận, reject nếu lỗi hoặc quá 3 giây.
function publishCommand(command) {
  return new Promise((resolve, reject) => {
    if (!isMqttConnected()) return reject(new Error('MQTT unavailable'));
    const timer = setTimeout(() => reject(new Error('MQTT publish timeout')), PUBLISH_TIMEOUT_MS);
    client.publish(
      TOPICS.deviceCommand(command.deviceId),
      JSON.stringify(command),
      { qos: 1, retain: false },
      (error) => {
        clearTimeout(timer);
        if (error) reject(error);
        else resolve();
      },
    );
  });
}
