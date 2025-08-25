import { defineConfig } from 'vite';
import { setupMountedVolume } from './sync-backup.js';

// Vite plugin for mounted volume setup
const mountedVolumePlugin = () => ({
  name: 'mounted-volume',
  configureServer(server) {
    // Setup mounted volume on server start
    setupMountedVolume();
  }
});

export default defineConfig({
  server: {
    host: true,
    allowedHosts: ['.etdofresh.com']
  },
  plugins: [mountedVolumePlugin()]
});