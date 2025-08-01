const { ipcMain } = require('electron');

class IPCHandlers {
  constructor() {
    this.windowManager = null;
    this.updaterManager = null;
  }

  setWindowManager(windowManager) {
    this.windowManager = windowManager;
  }

  setUpdaterManager(updaterManager) {
    this.updaterManager = updaterManager;
  }

  setupHandlers() {
    // Settings window handlers
    ipcMain.handle('open-settings', () => {
      if (this.windowManager) {
        this.windowManager.createSettingsWindow();
      }
    });

    ipcMain.handle('close-settings', () => {
      if (this.windowManager) {
        this.windowManager.closeSettingsWindow();
      }
    });

    ipcMain.handle('settings-updated', (event, settings) => {
      // Notify main window that settings were updated
      if (this.windowManager) {
        this.windowManager.notifySettingsUpdated(settings);
      }
    });

    // Updater functionality handlers
    ipcMain.handle('download-update', () => {
      if (this.updaterManager) {
        this.updaterManager.downloadUpdate();
      }
    });

    ipcMain.handle('install-update', () => {
      if (this.updaterManager) {
        this.updaterManager.installUpdate();
      }
    });

    ipcMain.handle('check-for-updates', () => {
      if (this.updaterManager) {
        this.updaterManager.checkForUpdates();
      }
    });
  }

  // Clean up handlers when app is shutting down
  removeHandlers() {
    ipcMain.removeAllListeners('open-settings');
    ipcMain.removeAllListeners('close-settings');
    ipcMain.removeAllListeners('settings-updated');
    ipcMain.removeAllListeners('download-update');
    ipcMain.removeAllListeners('install-update');
    ipcMain.removeAllListeners('check-for-updates');
  }
}

module.exports = IPCHandlers;
