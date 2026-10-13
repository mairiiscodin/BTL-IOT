import mqtt from 'mqtt';
import { emit } from '../realtime/socketHub.js';
import { ingest } from './sensorService.js';
import { setPublisher, acknowledge, reportedState, availability } from './deviceService.js';
let client,
  queue = Promise.resolve();
export const connected = () => Boolean(client?.connected);
export function startMqtt() {
  if (process.env.MQTT_ENABLED === 'false') return;
  const url = (process.env.MQTT_URL || 'mqtt://127.0.0.1:1883')
    .replace(/^tcp:/, 'mqtt:')
    .replace(/^ssl:/, 'mqtts:');
  client = mqtt.connect(url, {
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
    clean: true,
    connectTimeout: 3000,
    reconnectPeriod: 5000,
    keepalive: 15,
    queueQoSZero: false,
  });
  client.on('connect', () =>
    client.subscribe(
      ['iot/sensors/data', 'iot/devices/+/status', 'iot/esp32/status'],
      { qos: 1 },
      (error) => {
        if (error) console.error('MQTT subscribe failed');
        else emit('system.connection', { mqttConnected: true });
      },
    ),
  );
  client.on('offline', () => emit('system.connection', { mqttConnected: false }));
  client.on('error', (error) => console.error('MQTT:', error.code || error.name));
  client.on('message', (topic, bytes, packet) => {
    if (bytes.length > 4096) return;
    queue = queue
      .then(() => handleMessage(topic, bytes, packet.retain))
      .catch((error) => console.error('Rejected MQTT packet:', error.code || error.name));
  });
  setPublisher(publishCommand);
}
export async function stopMqtt() {
  if (client) await client.endAsync(true);
  await queue;
}

async function handleMessage(topic, bytes, retained) {
  if (topic === 'iot/esp32/status') return availability(bytes.toString() === 'online', retained);
  const body = JSON.parse(bytes.toString());
  if (topic === 'iot/sensors/data') return ingest(body, retained);
  const match = /^iot\/devices\/([1-9][0-9]*)\/status$/.exec(topic);
  if (!match || !body || typeof body !== 'object') return;
  const device = Number(match[1]);
  if (body.deviceId !== device) return;
  if (body.actionId != null) await acknowledge(device, body.actionId, body.status, retained);
  else await reportedState(device, body.status, retained);
}

function publishCommand(command) {
  return new Promise((resolve, reject) => {
    if (!connected()) return reject(new Error('MQTT unavailable'));
    const timer = setTimeout(() => reject(new Error('MQTT publish timeout')), 3000);
    client.publish(
      'iot/devices/' + command.deviceId + '/command',
      JSON.stringify(command),
      { qos: 1, retain: false },
      (error) => {
        clearTimeout(timer);
        error ? reject(error) : resolve();
      },
    );
  });
}
