import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/auth': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        bypass(req) {
          // Don't proxy the callback page navigation — let React Router handle it
          if (req.method === 'GET' && req.url?.startsWith('/auth/callback') && !req.headers['x-requested-with']) {
            return req.url;
          }
        },
      },
      '/posts': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/upload': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
