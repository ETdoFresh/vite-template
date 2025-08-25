import { defineConfig } from 'vite';
import { syncToBackup, syncFromBackup, handleFileChange } from './sync-backup.js';
import fs from 'fs';
import path from 'path';

// Vite plugin for two-way backup synchronization
const backupSyncPlugin = () => ({
  name: 'backup-sync',
  configureServer(server) {
    // Initial sync on server start
    syncToBackup();
    
    // Watch for changes in /app (excluding backup folder)
    server.watcher.on('change', (filePath) => {
      // Only sync if the change is not in the backup folder
      if (!filePath.includes('/app/backup/')) {
        handleFileChange(filePath, 'to-backup');
      }
    });
    
    // Set up watcher for /app/backup directory
    if (fs.existsSync('/app/backup')) {
      const backupWatcher = server.watcher.add('/app/backup');
      
      backupWatcher.on('change', (filePath) => {
        // Sync changes from backup to app
        if (filePath.startsWith('/app/backup/')) {
          handleFileChange(filePath, 'from-backup');
        }
      });
    }
  }
});

export default defineConfig({
  server: {
    host: true,
    allowedHosts: ['.etdofresh.com'],
    watch: {
      // Watch backup directory for changes
      ignored: ['**/node_modules/**', '**/.git/**', '**/dist/**']
    }
  },
  plugins: [backupSyncPlugin()]
});