import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    allowedHosts: [
      '*.etdofresh.com',
      'vitetest.etdofresh.com'
    ]
  }
})
