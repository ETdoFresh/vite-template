import { defineConfig } from 'vite';
import { syncToBackup } from './sync-backup.js';

// Vite plugin for backup synchronization
const backupSyncPlugin = () => ({
  name: 'backup-sync',
  configureServer(server) {
    // Sync on server start
    syncToBackup();
    
    // Sync on file changes
    server.watcher.on('change', () => {
      syncToBackup();
    });
  }
});

export default defineConfig({
  server: {
    host: true,
    allowedHosts: ['.etdofresh.com']
  },
  plugins: [backupSyncPlugin()]
});