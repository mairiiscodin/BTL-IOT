import { config } from '../config/env.js';

/**
 * CORS: cho phép frontend chạy ở origin khác (vd. Vite :5173) gọi API backend (:8080).
 * Chỉ các origin trong ALLOWED_ORIGINS mới được trả header cho phép.
 * Request OPTIONS (preflight của trình duyệt) được trả lời 204 ngay.
 */
export function cors(req, res, next) {
  const origin = req.get('Origin');
  if (origin && config.allowedOrigins.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
    res.vary('Origin'); // báo cache rằng phản hồi phụ thuộc vào Origin
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
}
