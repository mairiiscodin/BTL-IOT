// =============================================================
// Ứng dụng Express: khai báo middleware và route theo đúng thứ tự xử lý.
// (Khởi động HTTP server, MQTT, WebSocket nằm ở server.js.)
// =============================================================
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { projectRoot } from './config/env.js';
import { db } from './config/db.js';
import { isMqttConnected } from './services/mqttService.js';
import { cors } from './middleware/cors.js';
import { authenticate } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/authRoutes.js';
import sensorRoutes from './routes/sensorRoutes.js';
import deviceRoutes from './routes/deviceRoutes.js';
import actionRoutes from './routes/actionHistoryRoutes.js';

export const app = express();
app.disable('x-powered-by'); // không để lộ "X-Powered-By: Express"

// 1. Middleware chung cho mọi request.
app.use(cors);
app.use(express.json({ limit: '64kb' })); // đọc body JSON vào req.body

// 2. Route công khai (login không cần token).
app.use('/api/v1/auth', authRoutes);

// 3. Từ đây trở xuống, mọi /api/v1/... đều phải đăng nhập.
app.use('/api/v1', authenticate);

// GET /api/v1/system -> tình trạng kết nối DB và MQTT (hiển thị cảnh báo trên Dashboard).
app.get('/api/v1/system', async (req, res) => {
  res.json({
    data: {
      databaseConnected: (await db.count('SELECT 1')) === 1,
      mqttConnected: isMqttConnected(),
      time: new Date().toISOString(),
    },
  });
});
app.use('/api/v1/sensors', sensorRoutes);
app.use('/api/v1/devices', deviceRoutes);
app.use('/api/v1/actions', actionRoutes);

// 4. API không tồn tại => 404 dạng JSON.
app.use('/api', (req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Không tìm thấy API.' } });
});

// 5. Nếu đã build frontend (npm run build) thì backend phục vụ luôn giao diện ở cổng 8080.
const frontendDist = path.join(projectRoot, 'frontend/dist');
if (fs.existsSync(path.join(frontendDist, 'index.html'))) {
  app.use(express.static(frontendDist));
  app.get('/', (req, res) => res.sendFile(path.join(frontendDist, 'index.html')));
}

// 6. Bắt mọi lỗi phía trên (luôn đặt cuối cùng).
app.use(errorHandler);
