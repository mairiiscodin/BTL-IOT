import { db, transaction } from '../config/db.js';
import { config } from '../config/env.js';
import { emit } from '../realtime/socketHub.js';
import { HttpError, id } from '../utils/httpError.js';
import { action as validateAction } from '../utils/validation.js';
let publishCommand = async () => {
  throw new Error('MQTT unavailable');
};
export function setPublisher(publish) {
  publishCommand = publish;
}
export const devices = () =>
  db.list(
    "SELECT d.*, (SELECT a.id FROM ActionHistory a WHERE a.device_id=d.id AND a.status='loading' ORDER BY a.id DESC LIMIT 1) AS pending_action_id FROM Devices d ORDER BY d.id",
  );
async function create(sql, user, device, action) {
  validateAction(action);
  await sql.one('SELECT * FROM Devices WHERE id=? FOR UPDATE', [device]);
  if (
    await sql.count("SELECT COUNT(*) FROM ActionHistory WHERE device_id=? AND status='loading'", [
      device,
    ])
  )
    throw new HttpError(409, 'DEVICE_BUSY', 'Thiết bị đang chờ ACK của lệnh trước.');
  const key = await sql.insert(
    "INSERT INTO ActionHistory(user_id,device_id,action,status,source) VALUES(?,?,?,'loading','manual')",
    [user, device, action],
  );
  return { actionId: 'A' + key, deviceId: device, action, status: 'loading', source: 'manual' };
}
async function publish(command) {
  emit('device.command.accepted', {
    deviceId: command.deviceId,
    actionId: command.actionId,
    status: 'loading',
  });
  try {
    await publishCommand(command);
  } catch {
    await finishError(id(command.actionId), 'error');
  }
}
export async function execute(user, device, action) {
  const command = await transaction((sql) => create(sql, user, device, action));
  await publish(command);
  return command;
}
export function validAck(row, device, status, retained, now = Date.now()) {
  return (
    !retained &&
    row &&
    row.deviceId === device &&
    row.status === 'loading' &&
    ['on', 'off'].includes(status) &&
    row.action.toLowerCase() === status &&
    now - new Date(row.createdAt).getTime() <= config.timeout
  );
}
export async function acknowledge(device, actionId, status, retained) {
  if (retained || !['on', 'off'].includes(status)) return;
  let key;
  try {
    key = id(actionId);
  } catch {
    return;
  }
  const result = await transaction(async (sql) => {
    const known = await sql.list('SELECT id FROM Devices WHERE id=? FOR UPDATE', [device]);
    if (!known.length) return;
    const rows = await sql.list(
      'SELECT * FROM ActionHistory WHERE id=? AND device_id=? FOR UPDATE',
      [key, device],
    );
    const row = rows[0];
    if (!validAck(row, device, status, retained)) return;
    await sql.query(
      "UPDATE ActionHistory SET status=?,completed_at=CURRENT_TIMESTAMP(3) WHERE id=? AND status='loading'",
      [status, key],
    );
    await sql.query(
      "UPDATE Devices SET current_status=?,connection_status='online',last_seen_at=CURRENT_TIMESTAMP(3) WHERE id=?",
      [status, device],
    );
    return { actionId: 'A' + key, deviceId: device, status, source: row.source };
  });
  if (result) emit('device.status.changed', result);
}
export async function reportedState(device, status, retained) {
  if (retained || !['on', 'off'].includes(status)) return;
  const result = await db.query(
    "UPDATE Devices SET current_status=?,connection_status='online',last_seen_at=CURRENT_TIMESTAMP(3) WHERE id=?",
    [status, device],
  );
  if (result.affectedRows)
    emit('device.status.changed', { deviceId: device, status, reported: true });
}
export async function availability(online, retained) {
  if (online && retained) return;
  await db.query(
    online
      ? "UPDATE Devices SET connection_status='online',last_seen_at=CURRENT_TIMESTAMP(3)"
      : "UPDATE Devices SET connection_status='offline'",
  );
  emit('device.connection.changed', { online });
}
async function finishError(key, status) {
  const rows = await db.list(
    "SELECT device_id FROM ActionHistory WHERE id=? AND status='loading'",
    [key],
  );
  if (!rows.length) return;
  const result = await db.query(
    "UPDATE ActionHistory SET status=?,completed_at=CURRENT_TIMESTAMP(3) WHERE id=? AND status='loading'",
    [status, key],
  );
  if (result.affectedRows)
    emit('device.status.changed', { actionId: 'A' + key, deviceId: rows[0].deviceId, status });
}
export async function expire() {
  for (const a of await db.list(
    "SELECT id FROM ActionHistory WHERE status='loading' AND created_at<?",
    [new Date(Date.now() - config.timeout)],
  ))
    await finishError(a.id, 'timeout');
  const result = await db.query(
    "UPDATE Devices SET connection_status='offline' WHERE connection_status='online' AND last_seen_at<?",
    [new Date(Date.now() - config.stale)],
  );
  if (result.affectedRows) emit('device.connection.changed', { online: false });
}
