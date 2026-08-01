import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    proxy: {
      '/api/bridge-proxy': {
        target: 'https://api.bridgeapi.io/v2',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/bridge-proxy/, ''),
      },
      '/api/gocardless-proxy': {
        target: 'https://bankaccountdata.gocardless.com/api/v2',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/gocardless-proxy/, ''),
      },
    },
  },
});
