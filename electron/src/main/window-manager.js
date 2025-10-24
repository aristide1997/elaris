const { BrowserWindow, Menu } = require('electron');
const { MAIN_WINDOW, SETTINGS_WINDOW } = require('../config/constants');
const { getFrontendPaths, getAssetPaths } = require('../utils/path-utils');

class WindowManager {
  constructor() {
    this.mainWindow = null;
    this.settingsWindow = null;
  }

  createMainWindow() {
    const { iconPath, preloadPath } = getAssetPaths();
    
    this.mainWindow = new BrowserWindow({
      width: MAIN_WINDOW.width,
      height: MAIN_WINDOW.height,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        preload: preloadPath
      },
      icon: iconPath,
      title: MAIN_WINDOW.title
    });

    // Load the renderer - use Vite dev server in development, built files in production
    const { mainUrl, mainPath } = getFrontendPaths();
    if (process.env.NODE_ENV === 'development') {
      this.mainWindow.loadURL(mainUrl);
      this.mainWindow.webContents.openDevTools();
    } else {
      this.mainWindow.loadFile(mainPath);
    }

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    // Enable context menu for right-click (copy/paste/etc)
    this.mainWindow.webContents.on('context-menu', (event, params) => {
      const { editFlags, isEditable, selectionText } = params;
      
      const menuTemplate = [];
      
      // Add editing options for editable fields
      if (isEditable) {
        menuTemplate.push(
          { role: 'undo', enabled: editFlags.canUndo },
          { role: 'redo', enabled: editFlags.canRedo },
          { type: 'separator' },
          { role: 'cut', enabled: editFlags.canCut },
          { role: 'copy', enabled: editFlags.canCopy },
          { role: 'paste', enabled: editFlags.canPaste },
          { role: 'delete', enabled: editFlags.canDelete },
          { type: 'separator' },
          { role: 'selectAll', enabled: editFlags.canSelectAll }
        );
      } else if (selectionText && selectionText.trim() !== '') {
        // Add copy option for selected text
        menuTemplate.push(
          { role: 'copy', enabled: editFlags.canCopy }
        );
      }
      
      // Show the context menu if there are items
      if (menuTemplate.length > 0) {
        const contextMenu = Menu.buildFromTemplate(menuTemplate);
        contextMenu.popup();
      }
    });

    return this.mainWindow;
  }

  createSettingsWindow() {
    // Don't create multiple settings windows
    if (this.settingsWindow) {
      this.settingsWindow.focus();
      return this.settingsWindow;
    }

    const { iconPath, preloadPath } = getAssetPaths();

    this.settingsWindow = new BrowserWindow({
      width: SETTINGS_WINDOW.width,
      height: SETTINGS_WINDOW.height,
      parent: this.mainWindow,
      modal: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        preload: preloadPath
      },
      icon: iconPath,
      title: SETTINGS_WINDOW.title,
      resizable: true,
      minimizable: false,
      maximizable: false
    });

    // Load the settings page
    const { settingsUrl, settingsPath } = getFrontendPaths();
    if (process.env.NODE_ENV === 'development') {
      this.settingsWindow.loadURL(settingsUrl);
      this.settingsWindow.webContents.openDevTools();
    } else {
      this.settingsWindow.loadFile(settingsPath);
    }

    this.settingsWindow.on('closed', () => {
      this.settingsWindow = null;
    });

    // Enable context menu for settings window
    this.settingsWindow.webContents.on('context-menu', (event, params) => {
      const { editFlags, isEditable, selectionText } = params;
      
      const menuTemplate = [];
      
      if (isEditable) {
        menuTemplate.push(
          { role: 'undo', enabled: editFlags.canUndo },
          { role: 'redo', enabled: editFlags.canRedo },
          { type: 'separator' },
          { role: 'cut', enabled: editFlags.canCut },
          { role: 'copy', enabled: editFlags.canCopy },
          { role: 'paste', enabled: editFlags.canPaste },
          { role: 'delete', enabled: editFlags.canDelete },
          { type: 'separator' },
          { role: 'selectAll', enabled: editFlags.canSelectAll }
        );
      } else if (selectionText && selectionText.trim() !== '') {
        menuTemplate.push(
          { role: 'copy', enabled: editFlags.canCopy }
        );
      }
      
      if (menuTemplate.length > 0) {
        const contextMenu = Menu.buildFromTemplate(menuTemplate);
        contextMenu.popup();
      }
    });

    return this.settingsWindow;
  }

  // Send server port to windows when ready
  notifyServerPort(serverPort) {
    if (this.mainWindow) {
      this.mainWindow.webContents.once('dom-ready', () => {
        this.mainWindow.webContents.send('server-port', serverPort);
      });
    }
    
    if (this.settingsWindow) {
      this.settingsWindow.webContents.once('dom-ready', () => {
        this.settingsWindow.webContents.send('server-port', serverPort);
      });
    }
  }

  // Backend notification methods
  notifyBackendRestarting() {
    if (this.mainWindow) {
      this.mainWindow.webContents.send('backend-restarting');
    }
    if (this.settingsWindow) {
      this.settingsWindow.webContents.send('backend-restarting');
    }
  }

  notifyBackendRestarted(serverPort) {
    if (this.mainWindow) {
      this.mainWindow.webContents.send('backend-restarted', serverPort);
    }
    if (this.settingsWindow) {
      this.settingsWindow.webContents.send('backend-restarted', serverPort);
    }
  }

  notifyBackendRestartFailed() {
    if (this.mainWindow) {
      this.mainWindow.webContents.send('backend-restart-failed');
    }
    if (this.settingsWindow) {
      this.settingsWindow.webContents.send('backend-restart-failed');
    }
  }

  // Update notification methods
  notifyUpdateAvailable(updateInfo) {
    if (this.mainWindow) {
      this.mainWindow.webContents.send('update-available', updateInfo);
    }
  }

  notifyUpdateError(errorMessage) {
    if (this.mainWindow) {
      this.mainWindow.webContents.send('update-error', errorMessage);
    }
  }

  notifyUpdateDownloadProgress(progressInfo) {
    if (this.mainWindow) {
      this.mainWindow.webContents.send('update-download-progress', progressInfo);
    }
  }

  notifyUpdateDownloaded(updateInfo) {
    if (this.mainWindow) {
      this.mainWindow.webContents.send('update-downloaded', updateInfo);
    }
  }

  // Settings notification methods
  notifySettingsUpdated(settings) {
    if (this.mainWindow) {
      this.mainWindow.webContents.send('settings-updated', settings);
    }
  }

  // Getters
  getMainWindow() {
    return this.mainWindow;
  }

  getSettingsWindow() {
    return this.settingsWindow;
  }

  hasMainWindow() {
    return this.mainWindow !== null;
  }

  hasSettingsWindow() {
    return this.settingsWindow !== null;
  }

  // Close methods
  closeSettingsWindow() {
    if (this.settingsWindow) {
      this.settingsWindow.close();
    }
  }

  // Focus methods
  focusMainWindow() {
    if (this.mainWindow) {
      this.mainWindow.focus();
    }
  }

  focusSettingsWindow() {
    if (this.settingsWindow) {
      this.settingsWindow.focus();
    }
  }
}

module.exports = WindowManager;
