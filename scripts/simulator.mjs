import mqtt from 'mqtt';
import '../backend/config/env.js';
const url =
  process.env.MQTT_TEST_URL ||
  process.env.MQTT_URL.replace('tcp://', 'mqtt://').replace('ssl://', 'mqtts://');
const client = mqtt.connect(url, {
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
  clientId: `esp32-simulator-${Date.now()}`,
  will: { topic: 'iot/esp32/status', payload: 'offline', retain: true, qos: 1 },
});
const states = { 1: 'off', 2: 'off' },
  seen = new Map();
let tick = 0;
const publish = (topic, payload, retain = false) =>
  client.publish(topic, typeof payload === 'string' ? payload : JSON.stringify(payload), {
    qos: 1,
    retain,
  });
function heartbeat() {
  publish('iot/esp32/status', 'online', true);
  for (const [deviceId, status] of Object.entries(states))
    publish(`iot/devices/${deviceId}/status`, { deviceId: Number(deviceId), status });
}
client.on('connect', () => {
  console.log('ESP32 simulator connected. Uses actual MQTT → Node.js → MySQL.');
  client.subscribe('iot/devices/+/command', { qos: 1 });
  heartbeat();
});
client.on('message', (topic, payload, packet) => {
  try {
    if (packet.retain) return;
    const command = JSON.parse(payload);
    const id = Number(topic.split('/')[2]);
    if (
      command.deviceId !== id ||
      !['ON', 'OFF'].includes(command.action) ||
      !/^A\d+$/.test(command.actionId)
    )
      return;
    if (seen.has(command.actionId)) {
      publish(`iot/devices/${id}/status`, seen.get(command.actionId));
      return;
    }
    setTimeout(() => {
      states[id] = command.action.toLowerCase();
      const ack = { deviceId: id, actionId: command.actionId, status: states[id] };
      seen.set(command.actionId, ack);
      if (seen.size > 100) seen.delete(seen.keys().next().value);
      publish(`iot/devices/${id}/status`, ack);
      console.log('ACK', ack);
    }, 700);
  } catch (e) {
    console.error(e.message);
  }
});
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
}, 3000);
client.on('error', (e) => console.error('MQTT:', e.message));
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    clearInterval(timer);
    publish('iot/esp32/status', 'offline', true);
    client.end(false, () => process.exit());
  });
