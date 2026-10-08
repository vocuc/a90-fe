import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    server: {
      port: 5173,
      // Chuyển tiếp /api sang backend Laravel để trình duyệt gọi cùng origin, không vướng CORS
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY_TARGET || 'http://a90.local',
          changeOrigin: true,
        },
      },
    },
  };
});
