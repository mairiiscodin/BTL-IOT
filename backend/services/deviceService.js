// =============================================================
// Nghiệp vụ điều khiển thiết bị (đèn) qua MQTT, theo mô hình Command / ACK:
//
//   1. Người dùng bấm công tắc -> executeCommand() lưu lệnh vào ActionHistory với status 'loading'.
//   2. Backend publish lệnh lên MQTT topic 'iot/devices/<id>/command'.
//   3. ESP32 bật/tắt đèn rồi gửi ACK (kèm actionId) lên 'iot/devices/<id>/status'.
//   4. handleAck() cập nhật lệnh thành 'on'/'off' và trạng thái thiết bị.
//   5. Nếu quá COMMAND_TIMEOUT_MS mà chưa có ACK -> expireStale() đánh dấu 'timeout'.
//
// Mỗi thay đổi đều được emit qua WebSocket để giao diện cập nhật ngay.
// =============================================================
import { db, transaction } from '../config/db.js';
import { config } from '../config/env.js';
import { DEVICE_STATES } from '../config/constants.js';
import { emit } from '../realtime/socketHub.js';
import { HttpError } from '../utils/httpError.js';
import { parseId, validateAction } from '../utils/validation.js';

// ---------- Kết nối với MQTT ----------

// Hàm gửi lệnh thật do mqttService "cắm" vào qua setCommandPublisher().
// Tách như vậy để file này không phụ thuộc trực tiếp vào thư viện MQTT.
let publishCommand = async () => {
  throw new Error('MQTT unavailable');
};
export function setCommandPublisher(publish) {
  publishCommand = publish;
}

// ---------- Câu SQL dùng nhiều lần ----------

const SQL_MARK_DEVICE_ONLINE = `UPDATE Devices
  SET current_status=?, connection_status='online', last_seen_at=CURRENT_TIMESTAMP(3)
  WHERE id=?`;

const SQL_FINISH_ACTION = `UPDATE ActionHistory
  SET status=?, completed_at=CURRENT_TIMESTAMP(3)
  WHERE id=? AND status='loading'`;

// Chuyển id số trong DB thành mã hiển thị: 15 -> 'A15'.
const toActionCode = (id) => 'A' + id;

const isDeviceState = (status) => DEVICE_STATES.includes(status);

// ---------- Đọc danh sách ----------

// Danh sách thiết bị, kèm id của lệnh đang chờ ACK (nếu có) để giao diện khoá công tắc.
export const listDevices = () =>
  db.list(
    `SELECT d.*,
       (SELECT a.id FROM ActionHistory a
        WHERE a.device_id = d.id AND a.status = 'loading'
        ORDER BY a.id DESC LIMIT 1) AS pending_action_id
     FROM Devices d ORDER BY d.id`,
  );

// ---------- Gửi lệnh ----------

// Bước 1: tạo bản ghi lệnh (chạy trong transaction để 2 request đồng thời không cùng tạo lệnh).
async function createCommand(sql, userId, deviceId, action) {
  validateAction(action);

  // FOR UPDATE: khoá dòng thiết bị cho tới khi transaction kết thúc. Không có thiết bị => 404.
  await sql.one('SELECT * FROM Devices WHERE id=? FOR UPDATE', [deviceId]);

  // Mỗi thiết bị chỉ được có 1 lệnh đang chờ ACK.
  const pending = await sql.count(
    "SELECT COUNT(*) FROM ActionHistory WHERE device_id=? AND status='loading'",
    [deviceId],
  );
  if (pending) throw new HttpError(409, 'DEVICE_BUSY', 'Thiết bị đang chờ ACK của lệnh trước.');

  const actionId = await sql.insert(
    `INSERT INTO ActionHistory(user_id, device_id, action, status, source)
     VALUES(?, ?, ?, 'loading', 'manual')`,
    [userId, deviceId, action],
  );
  // Đây cũng chính là nội dung JSON gửi xuống ESP32.
  return {
    actionId: toActionCode(actionId),
    deviceId,
    action,
    status: 'loading',
    source: 'manual',
  };
}

// Bước 2: báo giao diện "đang gửi", rồi publish lên MQTT. Gửi lỗi => đánh dấu lệnh 'error'.
async function sendCommand(command) {
  emit('device.command.accepted', {
    deviceId: command.deviceId,
    actionId: command.actionId,
    status: 'loading',
  });
  try {
    await publishCommand(command);
  } catch {
    await finishPendingAction(parseId(command.actionId), 'error');
  }
}

/**
 * Người dùng bật/tắt thiết bị (POST /devices/:id/actions).
 * @param action 'ON' | 'OFF'
 * @returns lệnh vừa tạo, status = 'loading' (kết quả thật đến sau qua WebSocket).
 */
export async function executeCommand(userId, deviceId, action) {
  const command = await transaction((sql) => createCommand(sql, userId, deviceId, action));
  await sendCommand(command);
  return command;
}

// ---------- Nhận phản hồi từ ESP32 ----------

/**
 * Một ACK chỉ được chấp nhận khi:
 * - không phải tin retained cũ,
 * - đúng thiết bị và lệnh vẫn đang 'loading',
 * - trạng thái báo về khớp với lệnh (ON -> 'on', OFF -> 'off'),
 * - còn trong thời hạn chờ.
 */
export function isValidAck(action, deviceId, status, retained, now = Date.now()) {
  return Boolean(
    !retained &&
    action &&
    action.deviceId === deviceId &&
    action.status === 'loading' &&
    isDeviceState(status) &&
    action.action.toLowerCase() === status &&
    now - new Date(action.createdAt).getTime() <= config.commandTimeoutMs,
  );
}

/**
 * ESP32 gửi ACK: { deviceId, actionId: 'A15', status: 'on' }.
 * Cập nhật lệnh + thiết bị trong 1 transaction rồi báo giao diện.
 */
export async function handleAck(deviceId, actionCode, status, retained) {
  if (retained || !isDeviceState(status)) return;

  let actionId;
  try {
    actionId = parseId(actionCode);
  } catch {
    return; // actionId sai định dạng => bỏ qua gói tin
  }

  const result = await transaction(async (sql) => {
    // Khoá thiết bị và lệnh để không xử lý trùng với expireStale() chạy song song.
    const devices = await sql.list('SELECT id FROM Devices WHERE id=? FOR UPDATE', [deviceId]);
    if (!devices.length) return;
    const [action] = await sql.list(
      'SELECT * FROM ActionHistory WHERE id=? AND device_id=? FOR UPDATE',
      [actionId, deviceId],
    );
    if (!isValidAck(action, deviceId, status, retained)) return;

    await sql.query(SQL_FINISH_ACTION, [status, actionId]);
    await sql.query(SQL_MARK_DEVICE_ONLINE, [status, deviceId]);
    return { actionId: toActionCode(actionId), deviceId, status, source: action.source };
  });

  if (result) emit('device.status.changed', result);
}

/**
 * ESP32 báo trạng thái định kỳ (không kèm actionId): { deviceId, status: 'off' }.
 * Dùng để đồng bộ lại trạng thái thật, vd. sau khi ESP32 khởi động lại.
 */
export async function handleReportedState(deviceId, status, retained) {
  if (retained || !isDeviceState(status)) return;
  const result = await db.query(SQL_MARK_DEVICE_ONLINE, [status, deviceId]);
  if (result.affectedRows) emit('device.status.changed', { deviceId, status, reported: true });
}

/**
 * ESP32 báo 'online' / 'offline' trên topic 'iot/esp32/status'.
 * 'offline' thường do broker tự gửi (Last Will) khi ESP32 mất kết nối đột ngột.
 */
export async function handleAvailability(online, retained) {
  // 'online' retained là tin cũ broker lưu lại, không chứng minh ESP32 đang sống.
  if (online && retained) return;
  await db.query(
    online
      ? "UPDATE Devices SET connection_status='online', last_seen_at=CURRENT_TIMESTAMP(3)"
      : "UPDATE Devices SET connection_status='offline'",
  );
  emit('device.connection.changed', { online });
}

// ---------- Hết hạn ----------

// Kết thúc một lệnh đang 'loading' với trạng thái 'timeout' hoặc 'error'.
async function finishPendingAction(actionId, status) {
  const [action] = await db.list(
    "SELECT device_id FROM ActionHistory WHERE id=? AND status='loading'",
    [actionId],
  );
  if (!action) return;
  const result = await db.query(SQL_FINISH_ACTION, [status, actionId]);
  if (result.affectedRows)
    emit('device.status.changed', {
      actionId: toActionCode(actionId),
      deviceId: action.deviceId,
      status,
    });
}

/**
 * Chạy mỗi giây (xem server.js):
 * - Lệnh chờ ACK quá COMMAND_TIMEOUT_MS -> 'timeout'.
 * - Thiết bị im lặng quá SENSOR_STALE_MS -> 'offline'.
 */
export async function expireStale() {
  const commandDeadline = new Date(Date.now() - config.commandTimeoutMs);
  const expired = await db.list(
    "SELECT id FROM ActionHistory WHERE status='loading' AND created_at<?",
    [commandDeadline],
  );
  for (const action of expired) await finishPendingAction(action.id, 'timeout');

  const seenDeadline = new Date(Date.now() - config.deviceStaleMs);
  const result = await db.query(
    "UPDATE Devices SET connection_status='offline' WHERE connection_status='online' AND last_seen_at<?",
    [seenDeadline],
  );
  if (result.affectedRows) emit('device.connection.changed', { online: false });
}
