import { createServer } from 'node:http';
import { app } from './app.js';
import { config } from './config/env.js';
import { pool } from './config/db.js';
import { initialize } from './scripts/initDb.js';
import { attachSocketHub } from './realtime/socketHub.js';
import { startMqtt, stopMqtt } from './services/mqttService.js';
import { expire } from './services/deviceService.js';
let timer,
  closeSockets,
  server,
  stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  clearInterval(timer);
  closeSockets?.();
  server?.close();
  await stopMqtt();
  await pool.end();
}
try {
  await initialize();
  server = createServer(app);
  closeSockets = attachSocketHub(server);
  startMqtt();
  let expiring = false;
  timer = setInterval(async () => {
    if (expiring) return;
    expiring = true;
    try {
      await expire();
    } catch (e) {
      console.error('Command expiry:', e.code || e.name);
    } finally {
      expiring = false;
    }
  }, 1000);
  timer.unref();
  server.listen(config.port, config.host, () =>
    console.log('Smart Room Node API: http://' + config.host + ':' + config.port),
  );
  server.on('error', async (error) => {
    console.error('HTTP server:', error.code);
    await stop();
    process.exitCode = 1;
  });
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.on(signal, () =>
      stop().catch(() => {
        process.exitCode = 1;
      }),
    );
} catch (error) {
  console.error('Startup failed:', error.code || error.message);
  await stop();
  process.exitCode = 1;
}
