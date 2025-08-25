import { defineConfig } from 'vite';
import { createSymlinkBackup } from './sync-backup.js';

// Vite plugin for symlink backup
const backupSymlinkPlugin = () => ({
  name: 'backup-symlink',
  configureServer(server) {
    // Create symlinks on server start
    createSymlinkBackup();
  }
});

export default defineConfig({
  server: {
    host: true,
    allowedHosts: ['.etdofresh.com']
  },
  plugins: [backupSymlinkPlugin()]
});