// =============================================================
// MQTT broker nhỏ chạy bằng Node (thư viện Aedes) để test trên máy, thay cho Mosquitto.
// Chạy: npm run broker   (đọc MQTT_USERNAME, MQTT_PASSWORD, MQTT_PORT từ .env)
// =============================================================
import { Aedes } from 'aedes';
import net from 'node:net';
import '../backend/config/env.js'; // nạp .env vào process.env

if (!process.env.MQTT_USERNAME || !process.env.MQTT_PASSWORD)
  throw new Error('Set MQTT_USERNAME and MQTT_PASSWORD.');

const port = Number(process.env.MQTT_PORT || 1883);
const broker = await Aedes.createBroker();

// Chỉ cho client có đúng username/password trong .env kết nối.
broker.authenticate = (client, username, password, done) =>
  done(
    null,
    username === process.env.MQTT_USERNAME && password?.toString() === process.env.MQTT_PASSWORD,
  );

// Aedes chỉ xử lý giao thức MQTT; còn mở cổng TCP thì dùng module net của Node.
const server = net.createServer(broker.handle);
// Nghe 0.0.0.0 để ESP32 trong cùng mạng Wi-Fi kết nối được (đã có username/password).
server.listen(port, '0.0.0.0', () => console.log(`Local test MQTT broker: 0.0.0.0:${port}`));

// Ctrl+C => đóng cổng và broker rồi thoát.
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    server.close();
    broker.close(() => process.exit());
  });
