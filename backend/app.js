import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { config, projectRoot } from './config/env.js';
import { db } from './config/db.js';
import { connected } from './services/mqttService.js';
import { authenticate } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/authRoutes.js';
import sensorRoutes from './routes/sensorRoutes.js';
import deviceRoutes from './routes/deviceRoutes.js';
import actionRoutes from './routes/actionHistoryRoutes.js';
export const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => {
  const origin = req.get('Origin');
  if (origin && config.origins.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
    res.vary('Origin');
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: '64kb' }));
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1', authenticate);
app.get('/api/v1/system', async (req, res) =>
  res.json({
    data: {
      databaseConnected: (await db.count('SELECT 1')) === 1,
      mqttConnected: connected(),
      time: new Date().toISOString(),
    },
  }),
);
app.use('/api/v1/sensors', sensorRoutes);
app.use('/api/v1/devices', deviceRoutes);
app.use('/api/v1/actions', actionRoutes);
app.use('/api', (req, res) =>
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Không tìm thấy API.' } }),
);
const dist = path.join(projectRoot, 'frontend/dist');
if (fs.existsSync(path.join(dist, 'index.html'))) {
  app.use(express.static(dist));
  app.get('/', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}
app.use(errorHandler);
