import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const mountedVolumeDir = '/app/mounted-volume';
const excludedDirs = ['node_modules', '.git', 'mounted-volume', 'dist'];
const excludedFiles = ['startup.js', 'sync-backup.js'];

function setupMountedVolume() {
  // Only run in production environment (when /app exists)
  if (!fs.existsSync('/app')) {
    console.log('Not in production environment, skipping mounted volume setup');
    return;
  }

  console.log('Setting up mounted volume...');
  
  // Create mounted-volume directory if it doesn't exist
  if (!fs.existsSync(mountedVolumeDir)) {
    fs.mkdirSync(mountedVolumeDir, { recursive: true });
    console.log(`Created mounted-volume directory: ${mountedVolumeDir}`);
  }
  
  // Check if mounted volume is empty
  const mountedFiles = fs.readdirSync(mountedVolumeDir);
  const isEmpty = mountedFiles.length === 0;
  
  if (isEmpty) {
    console.log('Mounted volume is empty, copying initial files from /app...');
    
    // Get all items in /app
    const allAppItems = fs.readdirSync('/app');
    
    // Log and filter out excluded items
    const appItems = allAppItems.filter(item => {
      if (excludedDirs.includes(item) || excludedFiles.includes(item)) {
        console.log(`Ignoring excluded item in /app: ${item}`);
        return false;
      }
      return true;
    });
    
    // Copy each item to mounted volume
    appItems.forEach(item => {
      const sourcePath = path.join('/app', item);
      const destPath = path.join(mountedVolumeDir, item);
      
      try {
        const stats = fs.lstatSync(sourcePath);
        
        // Skip if it's already a symlink (shouldn't happen on first run)
        if (stats.isSymbolicLink()) {
          return;
        }
        
        // Use cp -r for directories, cp for files
        if (stats.isDirectory()) {
          execSync(`cp -r "${sourcePath}" "${destPath}"`);
        } else {
          execSync(`cp "${sourcePath}" "${destPath}"`);
        }
        console.log(`Copied: ${item}`);
      } catch (error) {
        console.error(`Error copying ${item}:`, error.message);
      }
    });
    
    console.log('Initial copy completed');
  } else {
    console.log('Mounted volume contains data, merging with /app...');
    // Merge strategy: Keep files from mounted volume, add missing files from /app
    mergeMountedWithApp();
  }
}

function mergeMountedWithApp() {
  if (!fs.existsSync('/app') || !fs.existsSync(mountedVolumeDir)) {
    return;
  }
  
  // Get all items in both directories
  const mountedItems = fs.readdirSync(mountedVolumeDir);
  
  // Get and filter app items with logging
  const allAppItems = fs.readdirSync('/app');
  const appItems = allAppItems.filter(item => {
    if (excludedDirs.includes(item) || excludedFiles.includes(item)) {
      console.log(`Ignoring excluded item in /app: ${item}`);
      return false;
    }
    return true;
  });
  
  // First, copy items from mounted volume to /app (these take priority)
  mountedItems.forEach(item => {
    // Skip excluded items
    if (excludedDirs.includes(item) || excludedFiles.includes(item)) {
      console.log(`Ignoring excluded item from mounted volume: ${item}`);
      return;
    }
    
    const sourcePath = path.join(mountedVolumeDir, item);
    const destPath = path.join('/app', item);
    
    try {
      // Check if source actually exists (handle broken symlinks, etc)
      if (!fs.existsSync(sourcePath)) {
        console.log(`Skipping non-existent item in mounted volume: ${item}`);
        return;
      }
      
      // Remove existing item in /app if it exists
      if (fs.existsSync(destPath)) {
        const stats = fs.lstatSync(destPath);
        if (stats.isDirectory()) {
          fs.rmSync(destPath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(destPath);
        }
      }
      
      // Copy from mounted volume to /app
      const sourceStats = fs.statSync(sourcePath);
      if (sourceStats.isDirectory()) {
        execSync(`cp -r "${sourcePath}" "${destPath}"`);
      } else {
        execSync(`cp "${sourcePath}" "${destPath}"`);
      }
      console.log(`Restored from mounted volume: ${item}`);
    } catch (error) {
      console.error(`Error restoring ${item}:`, error.message);
    }
  });
  
  // Then, copy items that exist in /app but not in mounted volume
  appItems.forEach(item => {
    if (!mountedItems.includes(item)) {
      const sourcePath = path.join('/app', item);
      const destPath = path.join(mountedVolumeDir, item);
      
      try {
        // Skip if source is a symlink
        const stats = fs.lstatSync(sourcePath);
        if (stats.isSymbolicLink()) {
          return;
        }
        
        // Copy from /app to mounted volume
        if (stats.isDirectory()) {
          execSync(`cp -r "${sourcePath}" "${destPath}"`);
        } else {
          execSync(`cp "${sourcePath}" "${destPath}"`);
        }
        console.log(`Added to mounted volume: ${item}`);
      } catch (error) {
        console.error(`Error adding ${item} to mounted volume:`, error.message);
      }
    }
  });
}

// Setup mounted volume on startup
setupMountedVolume();

export default defineConfig({
  server: {
    host: true,
    allowedHosts: ['.etdofresh.com'],
    watch: {
      // Ignore the mounted-volume directory to prevent loops
      ignored: ['**/mounted-volume/**', '**/node_modules/**'],
      // Use polling in container environments
      usePolling: true,
      interval: 1000
    }
  },
  plugins: [
    {
      name: 'sync-to-mounted-volume',
      handleHotUpdate({ file, server }) {
        // Only sync if we're in production environment
        if (!fs.existsSync('/app') || !fs.existsSync(mountedVolumeDir)) {
          return;
        }
        
        // Get relative path from /app
        const relativePath = path.relative('/app', file);
        
        // Skip if file is in excluded directories or is an excluded file
        const pathParts = relativePath.split(path.sep);
        if (excludedDirs.some(dir => pathParts.includes(dir))) {
          console.log(`Ignoring file in excluded directory: ${relativePath}`);
          return;
        }
        if (excludedFiles.includes(path.basename(file))) {
          console.log(`Ignoring excluded file: ${relativePath}`);
          return;
        }
        
        // Skip if file is in mounted-volume directory
        if (file.startsWith(mountedVolumeDir)) {
          return;
        }
        
        // Sync the changed file to mounted volume
        const destPath = path.join(mountedVolumeDir, relativePath);
        
        try {
          // Ensure destination directory exists
          const destDir = path.dirname(destPath);
          if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
          }
          
          // Copy the file to mounted volume
          fs.copyFileSync(file, destPath);
          console.log(`Synced to mounted volume: ${relativePath}`);
        } catch (error) {
          console.error(`Error syncing ${relativePath}:`, error.message);
        }
      }
    }
  ]
});