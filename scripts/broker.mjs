import { Aedes } from 'aedes';
import net from 'node:net';
import '../backend/config/env.js';
if (!process.env.MQTT_USERNAME || !process.env.MQTT_PASSWORD)
  throw new Error('Set MQTT_USERNAME and MQTT_PASSWORD.');
const broker = await Aedes.createBroker();
broker.authenticate = (client, username, password, done) =>
  done(
    null,
    username === process.env.MQTT_USERNAME && password?.toString() === process.env.MQTT_PASSWORD,
  );
const server = net.createServer(broker.handle);
server.listen(Number(process.env.MQTT_PORT || 1883), '127.0.0.1', () =>
  console.log(`Local test MQTT broker: 127.0.0.1:${process.env.MQTT_PORT || 1883}`),
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    server.close();
    broker.close(() => process.exit());
  });
