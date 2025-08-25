import fs from 'fs';
import path from 'path';

const sourceDir = '/app';
const backupDir = '/app/backup';
const excludedDirs = ['node_modules', '.git', 'backup', 'dist'];

export function createSymlinkBackup() {
  // Remove existing backup directory if it exists
  if (fs.existsSync(backupDir)) {
    fs.rmSync(backupDir, { recursive: true, force: true });
    console.log(`Removed existing backup directory: ${backupDir}`);
  }
  
  // Create backup directory
  fs.mkdirSync(backupDir, { recursive: true });
  console.log(`Created backup directory: ${backupDir}`);
  
  // Read all items in source directory
  const items = fs.readdirSync(sourceDir);
  
  // Create symlinks for each non-excluded item
  items.forEach(item => {
    // Skip excluded directories
    if (excludedDirs.includes(item)) {
      console.log(`Skipping: ${item}`);
      return;
    }
    
    const sourcePath = path.join(sourceDir, item);
    const linkPath = path.join(backupDir, item);
    
    try {
      // Create symlink
      fs.symlinkSync(sourcePath, linkPath);
      console.log(`Created symlink: ${item}`);
    } catch (error) {
      console.error(`Error creating symlink for ${item}:`, error.message);
    }
  });
  
  console.log('Symlink backup completed');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createSymlinkBackup();
}
