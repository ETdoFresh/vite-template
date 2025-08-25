import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const sourceDir = '/app';
const backupDir = '/app/backup';
const excludePatterns = [
  '--exclude=node_modules',
  '--exclude=.git', 
  '--exclude=backup',
  '--exclude=dist'
];

export function syncToBackup() {
  // Create backup directory if it doesn't exist
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
    console.log(`Created backup directory: ${backupDir}`);
  }
  
  // Sync from app to backup
  const rsyncCommand = `rsync -av --delete ${excludePatterns.join(' ')} ${sourceDir}/ ${backupDir}/`;
  
  try {
    console.log('Syncing /app → /app/backup...');
    execSync(rsyncCommand, { stdio: 'inherit' });
    console.log('Sync completed');
  } catch (error) {
    console.error('Error during sync:', error.message);
  }
}

export function syncFromBackup() {
  // Sync from backup to app (excluding the same patterns)
  const rsyncCommand = `rsync -av ${excludePatterns.join(' ')} ${backupDir}/ ${sourceDir}/`;
  
  try {
    console.log('Syncing /app/backup → /app...');
    execSync(rsyncCommand, { stdio: 'inherit' });
    console.log('Reverse sync completed');
  } catch (error) {
    console.error('Error during reverse sync:', error.message);
  }
}

// Track sync operations to prevent loops
let syncInProgress = false;
let lastSyncTime = 0;
const SYNC_DEBOUNCE = 1000; // 1 second debounce

export function handleFileChange(filePath, direction) {
  const now = Date.now();
  
  // Debounce rapid changes
  if (syncInProgress || (now - lastSyncTime) < SYNC_DEBOUNCE) {
    return;
  }
  
  syncInProgress = true;
  lastSyncTime = now;
  
  try {
    if (direction === 'to-backup') {
      syncToBackup();
    } else if (direction === 'from-backup') {
      syncFromBackup();
    }
  } finally {
    syncInProgress = false;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  syncToBackup();
}
