const { app, dialog } = require('electron');
const { waitForBackend } = require('../utils/backend-utils');

const BackendManager = require('./backend-manager');
const WindowManager = require('./window-manager');
const UpdaterManager = require('./updater-manager');
const IPCHandlers = require('./ipc-handlers');
const MenuManager = require('./menu-manager');

class AppManager {
  constructor() {
    this.backendManager = new BackendManager();
    this.windowManager = new WindowManager();
    this.updaterManager = new UpdaterManager();
    this.ipcHandlers = new IPCHandlers();
    this.menuManager = new MenuManager();

    // Set up cross-references between managers
    this.backendManager.setWindowManager(this.windowManager);
    this.updaterManager.setWindowManager(this.windowManager);
    this.ipcHandlers.setWindowManager(this.windowManager);
    this.ipcHandlers.setUpdaterManager(this.updaterManager);
    this.menuManager.setWindowManager(this.windowManager);

    this.setupAppEventHandlers();
  }

  setupAppEventHandlers() {
    app.whenReady().then(async () => {
      await this.onAppReady();
    });

    app.on('window-all-closed', () => {
      this.onWindowAllClosed();
    });

    app.on('activate', async () => {
      await this.onActivate();
    });

    app.on('before-quit', () => {
      this.onBeforeQuit();
    });
  }

  async onAppReady() {
    try {
      // Create application menu
      this.menuManager.createApplicationMenu();
      
      // Start backend initialization in parallel (don't await)
      this.backendManager.initialize().catch(error => {
        console.error('Backend initialization failed:', error);
        // Backend manager will handle retries via health monitoring
      });

      // Create main window immediately
      const mainWindow = this.windowManager.createMainWindow();
      
      // Notify window about server port (even if backend not ready yet)
      this.windowManager.notifyServerPort(this.backendManager.getServerPort());
      
      // Setup auto-updater
      this.updaterManager.setupAutoUpdater();
      
      // Setup IPC handlers
      this.ipcHandlers.setupHandlers();
      
    } catch (error) {
      console.error('Failed to start application:', error);
      dialog.showErrorBox('Startup Error', `Failed to start the application: ${error.message}`);
      app.quit();
    }
  }

  onWindowAllClosed() {
    // Stop backend
    this.backendManager.cleanup();
    
    // On macOS, keep app running even when all windows are closed
    if (process.platform !== 'darwin') {
      app.quit();
    }
  }

  async onActivate() {
    if (!this.windowManager.hasMainWindow()) {
      try {
        // Start backend if needed (don't await - let it start in parallel)
        if (!this.backendManager.isBackendRunning()) {
          this.backendManager.startPythonBackend();
        }
        
        // Create main window immediately
        this.windowManager.createMainWindow();
        
        // Notify window about server port (even if backend not ready yet)
        this.windowManager.notifyServerPort(this.backendManager.getServerPort());
        
        // Restart health monitoring if it was stopped
        this.backendManager.startHealthMonitoring();
      } catch (error) {
        console.error('Failed to restart on activate:', error);
        // Create window anyway
        this.windowManager.createMainWindow();
        // Let health monitor handle the restart
        this.backendManager.startHealthMonitoring();
      }
    }
  }

  onBeforeQuit() {
    // Clean up IPC handlers
    this.ipcHandlers.removeHandlers();
    
    // Clean up backend
    this.backendManager.cleanup();
  }

  // Public methods for external access if needed
  getBackendManager() {
    return this.backendManager;
  }

  getWindowManager() {
    return this.windowManager;
  }

  getUpdaterManager() {
    return this.updaterManager;
  }
}

module.exports = AppManager;
