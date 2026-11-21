import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    root: 'frontend',
    envDir: '..',
    plugins: [react()],
    define: {
      'import.meta.env.VITE_NEON_AUTH_URL': JSON.stringify(
        env.VITE_NEON_AUTH_URL || env.NEON_AUTH_BASE_URL || '',
      ),
    },
    server: {
      host: '127.0.0.1',
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:4000',
          changeOrigin: true,
          configure(proxy) {
            proxy.on('error', (_error, _request, response) => {
              if (response.headersSent) return;
              response.writeHead(503, { 'Content-Type': 'application/json' });
              response.end(JSON.stringify({
                error: {
                  code: 'api_unavailable',
                  message: 'The ProjectVault API is offline. Run npm run dev from the repository root to start the API and frontend together.',
                },
              }));
            });
          },
        },
      },
    },
  };
});
