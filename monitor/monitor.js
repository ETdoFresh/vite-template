const fs = require('fs-extra');
const path = require('path');
const chokidar = require('chokidar');

const VOLUME_PATH = '/volume';
const APP_PATH = '/app';
const MONITOR_PATH = '/monitor';

console.log('Starting file monitor service...');

async function ensureDirectories() {
  console.log('Ensuring directories exist...');
  await fs.ensureDir(APP_PATH);
  await fs.ensureDir(VOLUME_PATH);
  console.log('Directories ready');
}

async function initializeVolume() {
  const volumeEmpty = (await fs.readdir(VOLUME_PATH)).length === 0;
  
  if (volumeEmpty) {
    console.log('Volume is empty, copying initial files...');
    const filesToCopy = ['package.json', 'package-lock.json', 'frontend', 'backend', 'service'];
    
    for (const file of filesToCopy) {
      const sourcePath = path.join(MONITOR_PATH, file);
      const destPath = path.join(VOLUME_PATH, file);
      
      if (await fs.pathExists(sourcePath)) {
        console.log(`Copying ${file} to volume...`);
        await fs.copy(sourcePath, destPath, { overwrite: false });
      }
    }
    console.log('Initial files copied to volume');
  }
}

async function createSymlink(volumePath, appPath) {
  try {
    if (await fs.pathExists(appPath)) {
      const stats = await fs.lstat(appPath);
      if (stats.isSymbolicLink()) {
        await fs.unlink(appPath);
      } else {
        await fs.remove(appPath);
      }
    }
    
    await fs.ensureDir(path.dirname(appPath));
    
    const volumeStats = await fs.stat(volumePath);
    if (volumeStats.isDirectory()) {
      await fs.ensureDir(volumePath);
      await fs.symlink(volumePath, appPath, 'dir');
    } else {
      await fs.symlink(volumePath, appPath, 'file');
    }
    
    console.log(`Symlink created: ${appPath} -> ${volumePath}`);
  } catch (error) {
    console.error(`Error creating symlink for ${volumePath}:`, error.message);
  }
}

async function removeSymlink(appPath) {
  try {
    if (await fs.pathExists(appPath)) {
      const stats = await fs.lstat(appPath);
      if (stats.isSymbolicLink()) {
        await fs.unlink(appPath);
        console.log(`Symlink removed: ${appPath}`);
      }
    }
  } catch (error) {
    console.error(`Error removing symlink for ${appPath}:`, error.message);
  }
}

async function syncVolumeToApp() {
  console.log('Syncing volume to app directory...');
  
  const items = await fs.readdir(VOLUME_PATH);
  
  for (const item of items) {
    const volumePath = path.join(VOLUME_PATH, item);
    const appPath = path.join(APP_PATH, item);
    await createSymlink(volumePath, appPath);
  }
  
  console.log('Initial sync complete');
}

async function startFileWatcher() {
  console.log('Starting file watcher...');
  
  const watcher = chokidar.watch(VOLUME_PATH, {
    persistent: true,
    ignoreInitial: true,
    followSymlinks: false,
    depth: 99,
    awaitWriteFinish: {
      stabilityThreshold: 500,
      pollInterval: 100
    }
  });
  
  watcher
    .on('add', async (volumePath) => {
      const relativePath = path.relative(VOLUME_PATH, volumePath);
      const appPath = path.join(APP_PATH, relativePath);
      console.log(`File added: ${relativePath}`);
      await createSymlink(volumePath, appPath);
    })
    .on('addDir', async (volumePath) => {
      const relativePath = path.relative(VOLUME_PATH, volumePath);
      const appPath = path.join(APP_PATH, relativePath);
      console.log(`Directory added: ${relativePath}`);
      await createSymlink(volumePath, appPath);
    })
    .on('unlink', async (volumePath) => {
      const relativePath = path.relative(VOLUME_PATH, volumePath);
      const appPath = path.join(APP_PATH, relativePath);
      console.log(`File removed: ${relativePath}`);
      await removeSymlink(appPath);
    })
    .on('unlinkDir', async (volumePath) => {
      const relativePath = path.relative(VOLUME_PATH, volumePath);
      const appPath = path.join(APP_PATH, relativePath);
      console.log(`Directory removed: ${relativePath}`);
      await removeSymlink(appPath);
    })
    .on('error', error => console.error('Watcher error:', error));
  
  console.log('File watcher started');
}

async function startServices() {
  console.log('Starting application services...');
  
  const { spawn } = require('child_process');
  
  process.chdir(APP_PATH);
  
  const npmInstall = spawn('npm', ['run', 'install:all'], {
    cwd: APP_PATH,
    stdio: 'inherit',
    shell: true
  });
  
  await new Promise((resolve) => {
    npmInstall.on('close', (code) => {
      if (code === 0) {
        console.log('Dependencies installed successfully');
      }
      resolve();
    });
  });
  
  const appProcess = spawn('npm', ['run', 'start'], {
    cwd: APP_PATH,
    stdio: 'inherit',
    shell: true
  });
  
  appProcess.on('error', (error) => {
    console.error('Failed to start application:', error);
  });
  
  appProcess.on('close', (code) => {
    console.log(`Application exited with code ${code}`);
    process.exit(code);
  });
}

async function main() {
  try {
    await ensureDirectories();
    await initializeVolume();
    await syncVolumeToApp();
    await startFileWatcher();
    await startServices();
  } catch (error) {
    console.error('Monitor startup error:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

main();