import { db } from '../config/db.js';
import { id } from '../utils/httpError.js';
import * as queries from '../services/queryService.js';
export const list = async (req, res) => res.json(await queries.actions(req.userId, req.query));
export const one = async (req, res) =>
  res.json({
    data: await db.one('SELECT * FROM ActionHistory WHERE id=? AND user_id=?', [
      id(req.params.id),
      req.userId,
    ]),
  });
export const exportCsv = async (req, res) =>
  res
    .attachment('iot-logs.csv')
    .type('text/csv')
    .send(queries.csv(await queries.actions(req.userId, req.query, true)));
