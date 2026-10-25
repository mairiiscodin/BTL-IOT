// =============================================================
// Giả lập ESP32 khi không có phần cứng: dùng đúng giao thức MQTT như firmware.
//   - Mỗi 3 giây gửi số đo giả (dao động hình sin) + heartbeat.
//   - Nhận lệnh ON/OFF, chờ 0,7 giây (giả độ trễ) rồi gửi ACK.
// Chạy: npm run simulator
// =============================================================
import mqtt from 'mqtt';
import '../backend/config/env.js'; // nạp .env vào process.env

const SENSOR_INTERVAL_MS = 3000;
const ACK_DELAY_MS = 700;
const MAX_REMEMBERED_ACKS = 100;

const url =
  process.env.MQTT_TEST_URL ||
  process.env.MQTT_URL.replace('tcp://', 'mqtt://').replace('ssl://', 'mqtts://');

const client = mqtt.connect(url, {
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
  clientId: `esp32-simulator-${Date.now()}`,
  // Last Will: simulator chết đột ngột => broker tự báo 'offline'.
  will: { topic: 'iot/esp32/status', payload: 'offline', retain: true, qos: 1 },
});

const deviceStates = { 1: 'off', 2: 'off' };
const handledAcks = new Map(); // actionId -> ACK đã gửi (để gửi lại nếu nhận lệnh trùng)
let tick = 0;

// Gửi tin; object thì tự chuyển sang JSON.
const publish = (topic, payload, retain = false) =>
  client.publish(topic, typeof payload === 'string' ? payload : JSON.stringify(payload), {
    qos: 1,
    retain,
  });

// Báo "còn sống" và trạng thái các thiết bị, giống firmware.
function heartbeat() {
  publish('iot/esp32/status', 'online', true);
  for (const [deviceId, status] of Object.entries(deviceStates))
    publish(`iot/devices/${deviceId}/status`, { deviceId: Number(deviceId), status });
}

client.on('connect', () => {
  console.log('ESP32 simulator connected. Uses actual MQTT → Node.js → MySQL.');
  client.subscribe('iot/devices/+/command', { qos: 1 });
  heartbeat();
});

// Nhận lệnh từ backend: kiểm tra hợp lệ, đổi trạng thái rồi gửi ACK.
client.on('message', (topic, payload, packet) => {
  try {
    if (packet.retain) return;
    const command = JSON.parse(payload);
    const deviceId = Number(topic.split('/')[2]); // 'iot/devices/1/command' -> 1
    const valid =
      command.deviceId === deviceId &&
      ['ON', 'OFF'].includes(command.action) &&
      /^A\d+$/.test(command.actionId);
    if (!valid) return;

    // Lệnh trùng => gửi lại ACK cũ, không đổi trạng thái.
    if (handledAcks.has(command.actionId)) {
      publish(`iot/devices/${deviceId}/status`, handledAcks.get(command.actionId));
      return;
    }

    setTimeout(() => {
      deviceStates[deviceId] = command.action.toLowerCase();
      const ack = { deviceId, actionId: command.actionId, status: deviceStates[deviceId] };
      handledAcks.set(command.actionId, ack);
      // Chỉ nhớ 100 ACK gần nhất (Map giữ thứ tự thêm vào => xoá key đầu tiên là cũ nhất).
      if (handledAcks.size > MAX_REMEMBERED_ACKS)
        handledAcks.delete(handledAcks.keys().next().value);
      publish(`iot/devices/${deviceId}/status`, ack);
      console.log('ACK', ack);
    }, ACK_DELAY_MS);
  } catch (e) {
    console.error(e.message);
  }
});

// Số đo giả: nhiệt độ 24–32°C, độ ẩm 58–74%, ánh sáng 130–570 lux.
const timer = setInterval(() => {
  if (!client.connected) return;
  tick++;
  publish('iot/sensors/data', {
    temperature: Number((28 + Math.sin(tick / 7) * 4).toFixed(1)),
    humidity: Number((66 + Math.cos(tick / 9) * 8).toFixed(1)),
    light: Math.round(350 + Math.sin(tick / 6) * 220),
    lightUnit: 'lux',
  });
  heartbeat();
}, SENSOR_INTERVAL_MS);

client.on('error', (e) => console.error('MQTT:', e.message));

// Ctrl+C => báo 'offline' rồi mới thoát.
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    clearInterval(timer);
    publish('iot/esp32/status', 'offline', true);
    client.end(false, () => process.exit());
  });
