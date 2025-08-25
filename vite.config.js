import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    host: true,
    allowedHosts: [
      '.etdofresh.com',
      'vitetest.etdofresh.com'
    ]
  }
})
