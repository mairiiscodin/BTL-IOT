// Cấu hình Vite (dev server + build frontend).
import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, '');
  // Proxy: frontend gọi '/api' và '/ws' trên cổng 5173, Vite chuyển tiếp sang backend (mặc định 8080).
  // Nhờ vậy trình duyệt coi như cùng origin, không vướng CORS khi phát triển.
  const target = env.API_PROXY_TARGET || 'http://127.0.0.1:8080';
  const proxy = { '/api': { target }, '/ws': { target, ws: true } };
  return {
    root,
    envDir: root,
    server: { host: '127.0.0.1', proxy },
    preview: { host: '127.0.0.1', proxy },
  };
});
