import { requireValue } from './httpError.js';
export const ranges = { '1H': 3600, '6H': 21600, '24H': 86400, '7D': 604800 };
export const action = (value) => requireValue(['ON', 'OFF'].includes(value), 'Chỉ hỗ trợ ON/OFF.');
