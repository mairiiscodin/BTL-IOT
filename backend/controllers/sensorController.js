import { db } from '../config/db.js';
import { latest } from '../services/sensorService.js';
import * as queries from '../services/queryService.js';
export const sensors = async (req, res) =>
  res.json({ data: await db.list('SELECT * FROM Sensors ORDER BY id') });
export const realtime = async (req, res) => res.json({ data: await latest() });
export const history = async (req, res) => res.json(await queries.sensors(req.query));
export const chart = async (req, res) => res.json({ data: await queries.chart(req.query.range) });
export const exportCsv = async (req, res) =>
  res
    .attachment('iot-logs.csv')
    .type('text/csv')
    .send(queries.csv(await queries.sensors(req.query, true)));
