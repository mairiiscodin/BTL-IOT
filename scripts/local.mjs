import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

// Load local settings before importing the shared environment module.
process.env.ENV_FILE ||= '.runtime/local.env';
const { projectRoot, config } = await import('../backend/config/env.js');
const runtimeDir = path.join(projectRoot, '.runtime');
const children = new Set();
let stopping = false;

function isListening(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port });
    const finish = (ready) => {
      socket.destroy();
      resolve(ready);
    };
    socket.setTimeout(800);
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.once('timeout', () => finish(false));
  });
}

function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of [...children].reverse()) child.kill();
}

async function start({ name, port, command = process.execPath, args }) {
  if (await isListening(port)) {
    console.log(name + ' already listening at ' + port + '; reusing it.');
    return;
  }
  const logPath = path.join(runtimeDir, name + '.log');
  const log = fs.openSync(logPath, 'a');
  let child;
  try {
    child = spawn(command, args, {
      cwd: projectRoot,
      stdio: ['ignore', log, log],
      windowsHide: true,
      env: process.env,
    });
  } finally {
    fs.closeSync(log);
  }
  children.add(child);
  let failure;
  child.on('error', (error) => {
    failure = error;
  });
  child.on('exit', () => children.delete(child));
  for (let attempt = 0; attempt < 90 && !stopping; attempt++) {
    if (failure) throw failure;
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(name + ' stopped; check ' + logPath);
    }
    if (await isListening(port)) {
      console.log(name + ': 127.0.0.1:' + port);
      return;
    }
    await delay(500);
  }
  throw new Error(name + ' startup interrupted or timed out; check ' + logPath);
}

const mysqlBase = process.env.MYSQL_BASE || 'C:/Program Files/MySQL/MySQL Server 8.0';
const frontendPort = Number(process.env.FRONTEND_PORT || 5173);
const services = [
  {
    name: 'mysql',
    port: Number(process.env.DB_PORT || 3311),
    command: path.join(mysqlBase, 'bin/mysqld.exe'),
    args: [
      '--no-defaults',
      '--basedir=' + mysqlBase,
      '--datadir=' + path.join(runtimeDir, 'mysql-data'),
      '--port=' + (process.env.DB_PORT || 3311),
      '--bind-address=127.0.0.1',
      '--mysqlx=0',
      '--console',
    ],
  },
  { name: 'mqtt', port: Number(process.env.MQTT_PORT || 1885), args: ['scripts/broker.mjs'] },
  { name: 'backend', port: config.port, args: ['backend/server.js'] },
  {
    name: 'frontend',
    port: frontendPort,
    args: [
      'frontend/node_modules/vite/bin/vite.js',
      'frontend',
      '--host',
      '127.0.0.1',
      '--port',
      String(frontendPort),
      '--strictPort',
    ],
  },
];

for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    stop();
    process.exit();
  });
try {
  fs.mkdirSync(runtimeDir, { recursive: true });
  for (const service of services) await start(service);
  console.log(
    'Open http://127.0.0.1:' +
      frontendPort +
      '. Simulator is started separately. Ctrl+C stops processes started here.',
  );
  setInterval(() => {}, 1000);
} catch (error) {
  console.error(error.message);
  stop();
  process.exitCode = 1;
}
