# Mounted Volume Sync Documentation

TLDR;
You should mount volume `/app/mounted-volume` to persist, edit, and backup your application files.

## Overview
This document explains the synchronization process between the application directory (`/app`) and the mounted volume (`/app/mounted-volume`) in the containerized environment.

## Architecture

```
/app/                          # Application directory
├── node_modules/              # Excluded - Node dependencies
├── .git/                      # Excluded - Git repository
├── mounted-volume/            # Excluded - The mounted volume itself
├── dist/                      # Excluded - Build output
├── index.html → mounted-volume/index.html     # Symlink
├── package.json → mounted-volume/package.json # Symlink
├── vite.config.js → mounted-volume/vite.config.js # Symlink
└── ... (other symlinks)

/app/mounted-volume/           # Persistent storage (source of truth)
├── index.html                 # Actual file
├── package.json               # Actual file
├── vite.config.js             # Actual file
└── ... (other actual files)
```

## Process Flow

### Initial Setup (On Container Start)

1. **Check Environment**: The process only runs in production (when `/app` exists)

2. **Clean Mounted Volume**:
   - Remove any symlinks from `/app/mounted-volume` 
   - Symlinks should never exist in the mounted volume as it's the source of truth
   - This prevents circular reference errors

3. **Initialize Mounted Volume**:
   - If `/app/mounted-volume` doesn't exist, create it
   - If mounted volume is empty, copy all files from `/app` to `/app/mounted-volume`
   - Excluded directories/files are never copied:
     - `node_modules/` - Dependencies are installed fresh
     - `.git/` - Version control stays in app directory
     - `mounted-volume/` - Avoid recursion
     - `dist/` - Build artifacts
     - `*.timestamp-*.mjs` - Vite temporary files
     - `.*.swp` - Vim swap files

4. **Clean App Directory**:
   - Remove all files/directories from `/app` except excluded items
   - This ensures we start with a clean slate for symlinks

5. **Create Symlinks**:
   - For each item in `/app/mounted-volume`, create a symlink in `/app`
   - Verify source files are not symlinks themselves before creating links
   - Example: `/app/index.html` → `/app/mounted-volume/index.html`

### Runtime Behavior

#### File Modifications
- When you edit a file through Vite (e.g., `/app/index.html`), you're actually editing `/app/mounted-volume/index.html` through the symlink
- Changes are immediately persisted to the mounted volume
- Vite's hot reload works normally

#### File Additions
- When a new file is added to `/app/mounted-volume`:
  1. The file watcher detects the addition
  2. `updateSymlinks()` is called
  3. A new symlink is created in `/app`

#### File Deletions
- When a file is deleted from `/app/mounted-volume`:
  1. The file watcher detects the deletion
  2. `updateSymlinks()` is called
  3. The corresponding symlink in `/app` is removed

## Key Benefits

1. **Persistence**: All changes are stored in the mounted volume and survive container restarts
2. **Clean Separation**: Working directories (`node_modules`, `.git`) stay in the container
3. **Simple Mental Model**: Mounted volume is always the source of truth
4. **No Sync Conflicts**: Using symlinks means there's only one copy of each file
5. **Automatic Updates**: File additions/deletions are handled automatically

## Excluded Items

The following directories and files are never synced:
- `node_modules/` - Package dependencies (rebuilt on container start)
- `.git/` - Git repository data
- `mounted-volume/` - The mounted volume directory itself
- `dist/` - Build output directory

## Debugging

### Common Issues

1. **"Too many symbolic links" error**: This usually means symlinks are pointing to themselves. The current implementation prevents this by:
   - Cleaning symlinks from mounted volume on startup
   - Cleaning `/app` before creating symlinks
   - Verifying source files are not symlinks before creating new links

2. **Files not persisting**: Check that the mounted volume is properly mounted in your container configuration.

3. **Permission errors**: Ensure the container has read/write permissions for the mounted volume.

4. **"recursive watch unavailable" error**: On Linux, recursive file watching isn't available. The system uses Vite's built-in watcher (chokidar) instead.

### Logging

The system provides detailed logging:
- Items being skipped (excluded directories)
- Files being copied to mounted volume (initial setup)
- Symlinks being created/removed
- File changes detected through symlinks

## Configuration

The sync behavior is configured in `vite.config.js`:

```javascript
const excludedDirs = ['node_modules', '.git', 'mounted-volume', 'dist'];
const excludedFiles = []; // Add any specific files to exclude
```

## Development vs Production

- **Development** (local): The sync process is completely skipped
- **Production** (container): Full sync process is activated when `/app` exists

## File Watcher

The system uses Vite's built-in watcher (powered by chokidar) to:
1. Watch files through symlinks for content changes
2. Monitor the mounted volume directory for file additions/deletions
3. Automatically update symlinks when files are added or removed

This unified approach avoids platform-specific issues with native file watching.