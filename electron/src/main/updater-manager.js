const { autoUpdater } = require('electron-updater');
const { app } = require('electron');
const { UPDATE_CHECK_DELAY } = require('../config/constants');

class UpdaterManager {
  constructor() {
    this.windowManager = null;
  }

  setWindowManager(windowManager) {
    this.windowManager = windowManager;
  }

  // Auto-updater configuration and event handlers
  setupAutoUpdater() {
    // Configure auto-updater
    autoUpdater.autoDownload = false; // Don't auto-download, ask user first
    autoUpdater.autoInstallOnAppQuit = true;
    
    // Allow prereleases if current version is beta or in development
    const currentVersion = app.getVersion();
    const isBetaVersion = currentVersion.includes('beta') || process.env.NODE_ENV === 'development';
    autoUpdater.allowPrerelease = isBetaVersion;
    
    // Enable development mode update checking
    if (process.env.NODE_ENV === 'development' && !app.isPackaged) {
      autoUpdater.forceDevUpdateConfig = true;
      console.log('=== DEVELOPMENT MODE: Force enabling update checking ===');
    }
    
    // Enable detailed logging
    autoUpdater.logger = {
      info: (message) => console.log(`[AUTO-UPDATER] ${message}`),
      warn: (message) => console.warn(`[AUTO-UPDATER] ${message}`),
      error: (message) => console.error(`[AUTO-UPDATER] ${message}`)
    };
    
    console.log(`Auto-updater configured:`);
    console.log(`  - Current version: ${currentVersion}`);
    console.log(`  - Beta channel enabled: ${isBetaVersion}`);
    console.log(`  - App is packaged: ${app.isPackaged}`);
    console.log(`  - Force dev config: ${autoUpdater.forceDevUpdateConfig || false}`);
    console.log(`  - Platform: ${process.platform}`);
    console.log(`  - Arch: ${process.arch}`);
    
    // Log the update feed URL
    try {
      const feedURL = autoUpdater.getFeedURL();
      console.log(`  - Update feed URL: ${feedURL}`);
    } catch (error) {
      console.error(`  - Failed to get update feed URL: ${error.message}`);
    }

    this.setupEventHandlers();

    // Check for updates on startup (but wait a bit for app to fully initialize)
    setTimeout(() => {
      console.log('=== Starting automatic update check ===');
      autoUpdater.checkForUpdatesAndNotify();
    }, UPDATE_CHECK_DELAY);
  }

  setupEventHandlers() {
    // Auto-updater event handlers
    autoUpdater.on('checking-for-update', () => {
      console.log('=== CHECKING FOR UPDATE ===');
      console.log(`Current app version: ${app.getVersion()}`);
      console.log('Fetching update information from GitHub...');
    });

    autoUpdater.on('update-available', (info) => {
      console.log('=== UPDATE AVAILABLE ===');
      console.log(`Available version: ${info.version}`);
      console.log(`Release date: ${info.releaseDate}`);
      console.log(`Release name: ${info.releaseName || 'N/A'}`);
      console.log(`Files:`, info.files);
      console.log(`Full update info:`, JSON.stringify(info, null, 2));
      
      // Notify renderer about available update
      if (this.windowManager) {
        this.windowManager.notifyUpdateAvailable({
          version: info.version,
          releaseNotes: info.releaseNotes,
          releaseName: info.releaseName,
          releaseDate: info.releaseDate
        });
      }
    });

    autoUpdater.on('update-not-available', (info) => {
      console.log('=== UPDATE NOT AVAILABLE ===');
      console.log(`Current version: ${app.getVersion()}`);
      console.log(`Latest version found: ${info.version}`);
      console.log(`Release date: ${info.releaseDate}`);
      console.log(`Full info:`, JSON.stringify(info, null, 2));
      console.log('No newer version available.');
    });

    autoUpdater.on('error', (err) => {
      console.error('=== UPDATE ERROR ===');
      console.error(`Error message: ${err.message}`);
      console.error(`Error stack: ${err.stack}`);
      console.error(`Full error:`, err);
      
      if (this.windowManager) {
        this.windowManager.notifyUpdateError(err.message);
      }
    });

    autoUpdater.on('download-progress', (progressObj) => {
      let log_message = `Download speed: ${progressObj.bytesPerSecond}`;
      log_message = log_message + ` - Downloaded ${progressObj.percent}%`;
      log_message = log_message + ` (${progressObj.transferred}/${progressObj.total})`;
      console.log(log_message);
      
      // Notify renderer about download progress
      if (this.windowManager) {
        this.windowManager.notifyUpdateDownloadProgress({
          percent: Math.round(progressObj.percent),
          transferred: progressObj.transferred,
          total: progressObj.total,
          bytesPerSecond: progressObj.bytesPerSecond
        });
      }
    });

    autoUpdater.on('update-downloaded', (info) => {
      console.log('Update downloaded:', info);
      
      // Notify renderer that update is ready to install
      if (this.windowManager) {
        this.windowManager.notifyUpdateDownloaded({
          version: info.version,
          releaseNotes: info.releaseNotes
        });
      }
    });
  }

  // Public methods for IPC handlers
  downloadUpdate() {
    console.log('Starting update download...');
    autoUpdater.downloadUpdate();
  }

  installUpdate() {
    console.log('Installing update and restarting...');
    autoUpdater.quitAndInstall();
  }

  checkForUpdates() {
    console.log('Manual update check requested...');
    autoUpdater.checkForUpdatesAndNotify();
  }
}

module.exports = UpdaterManager;
