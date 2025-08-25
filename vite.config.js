import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true,
    port: 5173,
    hmr: {
      host: 'localhost'
    },
    cors: {
      origin: [
        'http://localhost:*',
        'http://127.0.0.1:*',
        /^https?:\/\/.*\.etdofresh\.com$/,
        'https://etdofresh.com',
        'http://etdofresh.com'
      ],
      credentials: true
    }
  }
});