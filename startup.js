#!/usr/bin/env node
import { setupMountedVolume } from './sync-backup.js';
import { spawn } from 'child_process';

// Setup mounted volume first
console.log('Setting up mounted volume...');
setupMountedVolume();

// Then start Vite
console.log('Starting Vite server...');
const vite = spawn('npx', ['vite', '--host', '0.0.0.0', '--port', '5173'], {
  stdio: 'inherit',
  shell: true
});

vite.on('error', (error) => {
  console.error('Failed to start Vite:', error);
  process.exit(1);
});

vite.on('exit', (code) => {
  process.exit(code);
});
