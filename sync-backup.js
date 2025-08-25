#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export function syncToBackup() {
  const sourceDir = '/app';
  const backupDir = '/app/backup';
  
  // Create backup directory if it doesn't exist
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
    console.log(`Created backup directory: ${backupDir}`);
  }
  
  // Use rsync to sync directories, excluding specified folders
  const rsyncCommand = `rsync -av --delete \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='backup' \
    ${sourceDir}/ ${backupDir}/`;
  
  try {
    console.log('Starting backup sync...');
    execSync(rsyncCommand, { stdio: 'inherit' });
    console.log('Backup sync completed successfully');
  } catch (error) {
    console.error('Error during backup sync:', error.message);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  syncToBackup();
}
