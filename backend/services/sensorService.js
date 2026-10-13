import { db, transaction } from '../config/db.js';
import { emit } from '../realtime/socketHub.js';
export const latest = () =>
  db.list(
    'SELECT s.id AS sensor_id,s.name,s.type AS sensor_type,s.unit,d.id,d.value,d.measured_at AS timestamp,(SELECT x.value FROM SensorData x WHERE x.sensor_id=s.id ORDER BY x.measured_at DESC,x.id DESC LIMIT 1 OFFSET 1) AS previous_value FROM Sensors s LEFT JOIN SensorData d ON d.id=(SELECT x.id FROM SensorData x WHERE x.sensor_id=s.id ORDER BY x.measured_at DESC,x.id DESC LIMIT 1) WHERE s.is_active=TRUE ORDER BY s.id',
  );
export function validReading(type, value, unit = 'lux') {
  if (typeof value !== 'number' || !Number.isFinite(value)) return false;
  return type === 'temperature'
    ? value >= -40 && value <= 125
    : type === 'humidity'
      ? value >= 0 && value <= 100
      : type === 'light' && value >= 0 && value <= 1000000 && unit === 'lux';
}
export async function ingest(body, retained) {
  if (retained || !body || typeof body !== 'object' || Array.isArray(body)) return;
  const values = [];
  const now = new Date();
  for (const sensor of await db.list('SELECT * FROM Sensors WHERE is_active=TRUE'))
    if (validReading(sensor.type, body[sensor.type], body.lightUnit ?? 'lux'))
      values.push([sensor.id, body[sensor.type], now]);
  if (!values.length) return;
  await transaction(async (sql) => {
    for (const v of values)
      await sql.insert('INSERT INTO SensorData(sensor_id,value,measured_at) VALUES(?,?,?)', v);
  });
  const current = await latest();
  emit('sensor.updated', current);
}
