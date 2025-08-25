import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const appDir = '/app';
const mountedVolumeDir = '/app/mounted-volume';
const excludedDirs = ['node_modules', '.git', 'mounted-volume', 'dist'];

function isDirectoryEmpty(dir) {
  try {
    const files = fs.readdirSync(dir);
    return files.length === 0;
  } catch (error) {
    return true; // If directory doesn't exist, consider it empty
  }
}

function copyInitialFiles() {
  console.log('Copying initial files from /app to /app/mounted-volume...');
  
  // Use rsync to copy files, excluding certain directories
  const rsyncCommand = `rsync -av --exclude=node_modules --exclude=.git --exclude=mounted-volume --exclude=dist ${appDir}/ ${mountedVolumeDir}/`;
  
  try {
    execSync(rsyncCommand, { stdio: 'inherit' });
    console.log('Initial copy completed');
  } catch (error) {
    console.error('Error during initial copy:', error.message);
  }
}

export function setupMountedVolume() {
  // Create mounted-volume directory if it doesn't exist
  if (!fs.existsSync(mountedVolumeDir)) {
    fs.mkdirSync(mountedVolumeDir, { recursive: true });
    console.log(`Created mounted-volume directory: ${mountedVolumeDir}`);
  }
  
  // If mounted-volume is empty, copy initial files from /app
  if (isDirectoryEmpty(mountedVolumeDir)) {
    console.log('Mounted volume is empty, initializing with app files...');
    copyInitialFiles();
  } else {
    console.log('Mounted volume contains data, using it as source of truth');
  }
  
  // Get all items currently in /app (excluding our excluded dirs)
  const appItems = fs.readdirSync(appDir).filter(item => !excludedDirs.includes(item));
  
  // Remove existing non-excluded items from /app (they'll be replaced with symlinks)
  appItems.forEach(item => {
    const itemPath = path.join(appDir, item);
    try {
      const stats = fs.lstatSync(itemPath);
      if (stats.isSymbolicLink()) {
        fs.unlinkSync(itemPath);
      } else if (stats.isDirectory()) {
        fs.rmSync(itemPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(itemPath);
      }
    } catch (error) {
      console.error(`Error removing ${item}:`, error.message);
    }
  });
  
  // Create symlinks from /app to /app/mounted-volume for all items in mounted-volume
  const mountedItems = fs.readdirSync(mountedVolumeDir);
  
  mountedItems.forEach(item => {
    const sourcePath = path.join(mountedVolumeDir, item);
    const linkPath = path.join(appDir, item);
    
    try {
      // Create symlink from /app/item -> /app/mounted-volume/item
      fs.symlinkSync(sourcePath, linkPath);
      console.log(`Created symlink: /app/${item} -> /app/mounted-volume/${item}`);
    } catch (error) {
      console.error(`Error creating symlink for ${item}:`, error.message);
    }
  });
  
  console.log('Mounted volume setup completed');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setupMountedVolume();
}
