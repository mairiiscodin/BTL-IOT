import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

export const backendRoot = fileURLToPath(new URL('..', import.meta.url));
export const projectRoot = path.dirname(backendRoot);
const candidates = process.env.ENV_FILE
  ? [path.resolve(projectRoot, process.env.ENV_FILE)]
  : [path.join(backendRoot, '.env'), path.join(projectRoot, '.env')];
for (const file of candidates) {
  if (!fs.existsSync(file)) {
    if (process.env.ENV_FILE) throw new Error('ENV_FILE does not exist: ' + file);
    continue;
  }
  for (const [key, value] of Object.entries(parseEnv(fs.readFileSync(file, 'utf8')))) {
    process.env[key] ??= value;
  }
}
export const config = {
  port: Number(process.env.SERVER_PORT || 8080),
  host: process.env.SERVER_HOST || '127.0.0.1',
  timeout: Number(process.env.COMMAND_TIMEOUT_MS || 10000),
  stale: Number(process.env.SENSOR_STALE_MS || 15000),
  zone: process.env.APP_TIME_ZONE || 'Asia/Ho_Chi_Minh',
  sessionHours: Number(process.env.SESSION_HOURS || 8),
  origins: (
    process.env.ALLOWED_ORIGINS ||
    'http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:8080,http://localhost:8080'
  )
    .split(',')
    .map((s) => s.trim()),
};
