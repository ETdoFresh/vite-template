import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const appDir = '/app';
const mountedVolumeDir = '/app/mounted-volume';
const excludedDirs = ['node_modules', '.git', 'mounted-volume', 'dist'];
const excludedFiles = [];

// Function to check if a file should be excluded
function isExcluded(filename) {
  // Check if it's in excluded directories
  if (excludedDirs.includes(filename)) {
    return true;
  }
  // Check if it's an excluded file
  if (excludedFiles.includes(filename)) {
    return true;
  }
  // Exclude Vite temporary timestamp files
  if (filename.includes('.timestamp-') && filename.endsWith('.mjs')) {
    return true;
  }
  // Exclude vim swap files
  if (filename.startsWith('.') && filename.endsWith('.swp')) {
    return true;
  }
  return false;
}

// Check if we're in build phase or runtime phase
const isBuildPhase = process.env.NODE_ENV === 'production' && process.argv.includes('build');
const isRuntime = !isBuildPhase && fs.existsSync(appDir);

function setupMountedVolume() {
  // Only run at runtime in production environment (not during build)
  if (!isRuntime) {
    if (isBuildPhase) {
      console.log('Build phase detected, skipping mounted volume setup');
    } else {
      console.log('Not in production environment, skipping mounted volume setup');
    }
    return;
  }

  console.log('=== Starting Mounted Volume Setup ===');
  
  // Step 1: Create mounted-volume directory if it doesn't exist
  if (!fs.existsSync(mountedVolumeDir)) {
    fs.mkdirSync(mountedVolumeDir, { recursive: true });
    console.log(`Created mounted-volume directory: ${mountedVolumeDir}`);
  }
  
  // Check if mounted volume is empty
  const mountedFiles = fs.readdirSync(mountedVolumeDir);
  const isEmpty = mountedFiles.length === 0;
  
  // Step 1: If mounted volume is empty, copy initial files from /app
  if (isEmpty) {
    console.log('Step 1: Mounted volume is empty, copying initial files from /app...');
    
    const allItems = fs.readdirSync(appDir);
    allItems.forEach(item => {
      if (isExcluded(item)) {
        console.log(`  Skipping excluded item: ${item}`);
        return;
      }
      
      const sourcePath = path.join(appDir, item);
      const destPath = path.join(mountedVolumeDir, item);
      
      try {
        const stats = fs.lstatSync(sourcePath);
        
        // Skip if it's already a symlink (from a previous run)
        if (stats.isSymbolicLink()) {
          console.log(`  Skipping symlink: ${item}`);
          return;
        }
        
        // Copy to mounted volume
        if (stats.isDirectory()) {
          execSync(`cp -r "${sourcePath}" "${destPath}"`);
        } else {
          execSync(`cp "${sourcePath}" "${destPath}"`);
        }
        console.log(`  Copied to mounted volume: ${item}`);
      } catch (error) {
        console.error(`  Error copying ${item}:`, error.message);
      }
    });
    
    console.log('Initial copy to mounted volume completed');
  } else {
    console.log('Mounted volume already contains data');
  }
  
  // Step 2: Delete all files from /app except excluded directories
  console.log('\nStep 2: Cleaning /app directory (keeping only excluded items)...');
  const appItems = fs.readdirSync(appDir);
  
  appItems.forEach(item => {
    if (isExcluded(item)) {
      console.log(`  Keeping excluded item: ${item}`);
      return;
    }
    
    const itemPath = path.join(appDir, item);
    try {
      const stats = fs.lstatSync(itemPath);
      
      // Remove the item (whether it's a file, directory, or symlink)
      if (stats.isSymbolicLink()) {
        fs.unlinkSync(itemPath);
        console.log(`  Removed symlink: ${item}`);
      } else if (stats.isDirectory()) {
        fs.rmSync(itemPath, { recursive: true, force: true });
        console.log(`  Removed directory: ${item}`);
      } else {
        fs.unlinkSync(itemPath);
        console.log(`  Removed file: ${item}`);
      }
    } catch (error) {
      console.error(`  Error removing ${item}:`, error.message);
    }
  });
  
  // Step 3: Create symlinks from /app to /app/mounted-volume
  console.log('\nStep 3: Creating symlinks from /app to mounted volume...');
  updateSymlinks();
  
  console.log('\n=== Mounted Volume Setup Complete ===\n');
}

function updateSymlinks() {
  if (!isRuntime || !fs.existsSync(mountedVolumeDir)) {
    return;
  }
  
  // Get current state of both directories
  const mountedItems = fs.readdirSync(mountedVolumeDir);
  const appItems = fs.readdirSync(appDir);
  
  // Remove symlinks that no longer have a corresponding file in mounted volume
  appItems.forEach(item => {
    if (isExcluded(item)) {
      return; // Skip excluded items
    }
    
    const itemPath = path.join(appDir, item);
    try {
      const stats = fs.lstatSync(itemPath);
      if (stats.isSymbolicLink() && !mountedItems.includes(item)) {
        fs.unlinkSync(itemPath);
        console.log(`  Removed orphaned symlink: ${item}`);
      }
    } catch (error) {
      // Item might have been removed already
    }
  });
  
  // Create symlinks for all items in mounted volume
  mountedItems.forEach(item => {
    if (isExcluded(item)) {
      console.log(`  Skipping excluded item: ${item}`);
      return;
    }
    
    const sourcePath = path.join(mountedVolumeDir, item);
    const linkPath = path.join(appDir, item);
    
    try {
      // Check if symlink already exists and is correct
      if (fs.existsSync(linkPath)) {
        const stats = fs.lstatSync(linkPath);
        if (stats.isSymbolicLink()) {
          const currentTarget = fs.readlinkSync(linkPath);
          if (currentTarget === sourcePath) {
            // Symlink already exists and points to the right place
            return;
          }
          // Remove incorrect symlink
          fs.unlinkSync(linkPath);
        } else {
          // Non-symlink exists, remove it
          if (stats.isDirectory()) {
            fs.rmSync(linkPath, { recursive: true, force: true });
          } else {
            fs.unlinkSync(linkPath);
          }
        }
      }
      
      // Create new symlink
      fs.symlinkSync(sourcePath, linkPath);
      console.log(`  Created symlink: ${item} -> mounted-volume/${item}`);
    } catch (error) {
      console.error(`  Error creating symlink for ${item}:`, error.message);
    }
  });
}

// Only setup mounted volume at runtime, not during build
if (!isBuildPhase) {
  setupMountedVolume();
}

export default defineConfig({
  server: {
    host: true,
    allowedHosts: ['.etdofresh.com'],
    watch: {
      // Watch the actual files through symlinks, not the mounted volume directly
      ignored: ['**/node_modules/**', '**/mounted-volume/**', '**/.git/**'],
      // Use polling in container environments
      usePolling: true,
      interval: 1000
    }
  },
  build: {
    // During build, output to dist directory as normal
    outDir: 'dist',
    emptyOutDir: true
  },
  plugins: [
    {
      name: 'sync-symlinks-on-change',
      configureServer(server) {
        // Only set up watcher at runtime
        if (!isRuntime || !fs.existsSync(mountedVolumeDir)) {
          return;
        }
        
        // Use Vite's built-in watcher to watch the mounted volume
        // This works cross-platform and doesn't require recursive option
        server.watcher.add(mountedVolumeDir);
        
        // Listen for file add/unlink events in mounted volume
        server.watcher.on('add', (file) => {
          if (file.startsWith(mountedVolumeDir)) {
            const filename = path.relative(mountedVolumeDir, file);
            if (!excludedDirs.some(dir => filename.includes(dir))) {
              console.log(`\nFile added in mounted volume: ${filename}`);
              console.log('Updating symlinks...');
              updateSymlinks();
            }
          }
        });
        
        server.watcher.on('unlink', (file) => {
          if (file.startsWith(mountedVolumeDir)) {
            const filename = path.relative(mountedVolumeDir, file);
            if (!excludedDirs.some(dir => filename.includes(dir))) {
              console.log(`\nFile removed from mounted volume: ${filename}`);
              console.log('Updating symlinks...');
              updateSymlinks();
            }
          }
        });
      },
      handleHotUpdate({ file, server }) {
        // When a file changes through the symlink, the actual file in mounted volume
        // is already updated (because the symlink points there).
        // We just need to handle file additions/deletions which are handled by the watcher above.
        
        // Log the file change for debugging
        if (isRuntime) {
          const relativePath = path.relative(appDir, file);
          if (!relativePath.startsWith('mounted-volume') && 
              !relativePath.startsWith('node_modules') &&
              !relativePath.startsWith('.git')) {
            console.log(`File updated through symlink: ${relativePath}`);
          }
        }
      }
    }
  ]
});