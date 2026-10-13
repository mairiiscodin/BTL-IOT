import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, '');
  const proxy =
    env.VITE_DATA_SOURCE === 'api'
      ? {
          '/api': { target: env.API_PROXY_TARGET || 'http://127.0.0.1:8080' },
          '/ws': { target: env.API_PROXY_TARGET || 'http://127.0.0.1:8080', ws: true },
        }
      : undefined;
  return {
    root,
    envDir: root,
    server: { host: '127.0.0.1', proxy },
    preview: { host: '127.0.0.1', proxy },
  };
});
