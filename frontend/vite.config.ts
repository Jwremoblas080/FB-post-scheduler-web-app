import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const LAMBDA_URL = 'https://njidx1ny8i.execute-api.us-east-1.amazonaws.com';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/auth/login': { target: LAMBDA_URL, changeOrigin: true, secure: true },
      '/auth/pages': { target: LAMBDA_URL, changeOrigin: true, secure: true },
      '/posts': { target: LAMBDA_URL, changeOrigin: true, secure: true },
      '/upload': { target: LAMBDA_URL, changeOrigin: true, secure: true },
      '/health': { target: LAMBDA_URL, changeOrigin: true, secure: true },
    },
  },
});
