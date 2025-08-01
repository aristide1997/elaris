const { app, BrowserWindow, dialog, ipcMain, Menu } = require('electron');
const { autoUpdater } = require('electron-updater');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

// Keep a global reference of the window objects
let mainWindow;
let settingsWindow;
let pythonProcess;
let serverPort;
let healthCheckInterval;
let isRestarting = false;

// Function to start Python backend
function startPythonBackend() {
    console.log(`Starting Python backend on port ${serverPort}`);
    
    let pythonExecutable;
    let pythonArgs = [];
    let workingDirectory;

    // Check if we're in development or production
    if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
        // Development mode - use python directly
        pythonExecutable = 'python';
        pythonArgs = [path.join(__dirname, '..', 'server', 'main.py')];
        workingDirectory = path.join(__dirname, '..', 'server');
    } else {
        // Production mode - use bundled executable (one-dir mode)
        const resourcesPath = process.resourcesPath;
        pythonExecutable = path.join(resourcesPath, 'build', 'elaris-backend', 'elaris-backend');
        pythonArgs = []; // No arguments needed for the bundled executable
        workingDirectory = path.join(resourcesPath, 'build', 'elaris-backend');
    }

    console.log(`Using Python executable: ${pythonExecutable}`);
    console.log(`Working directory: ${workingDirectory}`);

    // Build environment for Python process, including embedded Node/npm for npx support
    const resourcesPath = process.resourcesPath;
    // Use bundled Node.js binary from `node-dist` packaged as `node` in Resources
    const embeddedNodeBin = path.join(resourcesPath, 'node', 'bin');
    const embeddedNpmBin = path.join(resourcesPath, 'npm', 'bin');
    const devNpmBin = path.join(__dirname, '..', 'node_modules', 'npm', 'bin');
    const spawnEnv = {
        ...process.env,
        // Prod: embedded node-dist/bin contains node & npx  
        PATH: [
            path.join(process.resourcesPath, 'node', 'bin'),
            '/usr/local/bin',
            '/opt/homebrew/bin',
            process.env.PATH
        ].filter(Boolean).join(':'),
        PORT: serverPort.toString(),
        PYTHONPATH: workingDirectory,
    };
    pythonProcess = spawn(pythonExecutable, pythonArgs, { env: spawnEnv, cwd: workingDirectory });

    // Pipe Python backend logs to file
    const logFile = path.join(app.getPath('userData'), 'server.log');
    const logStream = fs.createWriteStream(logFile, { flags: 'a' });
    pythonProcess.stdout.pipe(logStream);
    pythonProcess.stderr.pipe(logStream);

    pythonProcess.stdout.on('data', (data) => {
        console.log(`Python stdout: ${data}`);
    });

    pythonProcess.stderr.on('data', (data) => {
        console.error(`Python stderr: ${data}`);
    });

    pythonProcess.on('close', (code) => {
        console.log(`Python process exited with code ${code}`);
    });

    pythonProcess.on('error', (error) => {
        console.error('Failed to start Python process:', error);
    });
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, 'icon.png'), // We'll create this later
        title: 'Elaris'
    });

    // Load the renderer - use Vite dev server in development, built files in production
    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'));
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Pass server port to renderer when ready
    mainWindow.webContents.once('dom-ready', () => {
        mainWindow.webContents.send('server-port', serverPort);
    });
}

function createSettingsWindow() {
    // Don't create multiple settings windows
    if (settingsWindow) {
        settingsWindow.focus();
        return;
    }

    settingsWindow = new BrowserWindow({
        width: 800,
        height: 700,
        parent: mainWindow,
        modal: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, 'icon.png'),
        title: 'Settings - Elaris',
        resizable: true,
        minimizable: false,
        maximizable: false
    });

    // Load the settings page
    if (process.env.NODE_ENV === 'development') {
        settingsWindow.loadURL('http://localhost:5173/settings.html');
        settingsWindow.webContents.openDevTools();
    } else {
        settingsWindow.loadFile(path.join(__dirname, '..', 'frontend', 'dist', 'settings.html'));
    }

    settingsWindow.on('closed', () => {
        settingsWindow = null;
    });

    // Pass server port to settings window when ready
    settingsWindow.webContents.once('dom-ready', () => {
        settingsWindow.webContents.send('server-port', serverPort);
    });
}

// Helper to wait for the Python backend to be ready
function waitForBackend(port, retries = 40, interval = 500) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      const req = http.request(
        { hostname: '127.0.0.1', port, path: '/api/conversations?limit=1', method: 'GET', timeout: 1000 },
        res => resolve()
      );
      req.on('error', () => {
        attempts++;
        if (attempts < retries) {
          setTimeout(check, interval);
        } else {
          reject(new Error('Backend did not start in time'));
        }
      });
      req.end();
    };
    check();
  });
}

// Function to check if Python backend is healthy
function checkBackendHealth() {
  return new Promise((resolve) => {
    const req = http.request(
      { 
        hostname: '127.0.0.1', 
        port: serverPort, 
        path: '/api/conversations?limit=1', 
        method: 'GET', 
        timeout: 2000 
      },
      (res) => {
        resolve(true);
      }
    );
    
    req.on('error', (error) => {
      console.log('Backend health check failed:', error.message);
      resolve(false);
    });
    
    req.on('timeout', () => {
      console.log('Backend health check timed out');
      req.destroy();
      resolve(false);
    });
    
    req.end();
  });
}

// Function to restart Python backend
async function restartPythonBackend() {
  if (isRestarting) {
    console.log('Backend restart already in progress, skipping...');
    return;
  }
  
  isRestarting = true;
  console.log('Restarting Python backend...');
  
  // Notify renderer about restart
  if (mainWindow) {
    mainWindow.webContents.send('backend-restarting');
  }
  if (settingsWindow) {
    settingsWindow.webContents.send('backend-restarting');
  }
  
  try {
    // Kill existing process if it exists
    if (pythonProcess) {
      pythonProcess.kill('SIGTERM');
      // Wait a bit for graceful shutdown
      await new Promise(resolve => setTimeout(resolve, 2000));
      if (!pythonProcess.killed) {
        pythonProcess.kill('SIGKILL');
      }
    }
    
    // Start new backend process
    startPythonBackend();
    
    // Wait for it to be ready
    await waitForBackend(serverPort);
    
    console.log('Python backend restarted successfully');
    
    // Notify renderer about successful restart
    if (mainWindow) {
      mainWindow.webContents.send('backend-restarted', serverPort);
    }
    if (settingsWindow) {
      settingsWindow.webContents.send('backend-restarted', serverPort);
    }
    
  } catch (error) {
    console.error('Failed to restart Python backend:', error);
    
    // Notify renderer about restart failure
    if (mainWindow) {
      mainWindow.webContents.send('backend-restart-failed');
    }
    if (settingsWindow) {
      settingsWindow.webContents.send('backend-restart-failed');
    }
  } finally {
    isRestarting = false;
  }
}

// Function to start health monitoring
function startHealthMonitoring() {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
  }
  
  healthCheckInterval = setInterval(async () => {
    if (isRestarting) {
      return; // Skip health check during restart
    }
    
    const isHealthy = await checkBackendHealth();
    if (!isHealthy) {
      console.log('Backend unhealthy, attempting restart...');
      await restartPythonBackend();
    }
  }, 8000); // Check every 8 seconds
  
  console.log('Backend health monitoring started');
}

// Function to stop health monitoring
function stopHealthMonitoring() {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
    console.log('Backend health monitoring stopped');
  }
}

// Function to create application menu
function createApplicationMenu() {
  const template = [
    ...(process.platform === 'darwin' ? [{
      label: app.getName(),
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Preferences...',
          accelerator: 'Cmd+,',
          click: () => createSettingsWindow()
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideothers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    { role: 'fileMenu' },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Auto-updater configuration and event handlers
function setupAutoUpdater() {
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

  // Check for updates on startup (but wait a bit for app to fully initialize)
  setTimeout(() => {
    console.log('=== Starting automatic update check ===');
    autoUpdater.checkForUpdatesAndNotify();
  }, 5000);

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
    if (mainWindow) {
      mainWindow.webContents.send('update-available', {
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
    
    if (mainWindow) {
      mainWindow.webContents.send('update-error', err.message);
    }
  });

  autoUpdater.on('download-progress', (progressObj) => {
    let log_message = `Download speed: ${progressObj.bytesPerSecond}`;
    log_message = log_message + ` - Downloaded ${progressObj.percent}%`;
    log_message = log_message + ` (${progressObj.transferred}/${progressObj.total})`;
    console.log(log_message);
    
    // Notify renderer about download progress
    if (mainWindow) {
      mainWindow.webContents.send('update-download-progress', {
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
    if (mainWindow) {
      mainWindow.webContents.send('update-downloaded', {
        version: info.version,
        releaseNotes: info.releaseNotes
      });
    }
  });
}

// IPC handlers for settings window
ipcMain.handle('open-settings', () => {
    createSettingsWindow();
});

ipcMain.handle('close-settings', () => {
    if (settingsWindow) {
        settingsWindow.close();
    }
});

ipcMain.handle('settings-updated', (event, settings) => {
    // Notify main window that settings were updated
    if (mainWindow) {
        mainWindow.webContents.send('settings-updated', settings);
    }
});

// IPC handlers for updater functionality
ipcMain.handle('download-update', () => {
    console.log('Starting update download...');
    autoUpdater.downloadUpdate();
});

ipcMain.handle('install-update', () => {
    console.log('Installing update and restarting...');
    autoUpdater.quitAndInstall();
});

ipcMain.handle('check-for-updates', () => {
    console.log('Manual update check requested...');
    autoUpdater.checkForUpdatesAndNotify();
});

app.whenReady().then(async () => {
  try {
    // Create application menu
    createApplicationMenu();
    
    // Start Python backend on fixed port
    serverPort = 8000;
    startPythonBackend();

    // Wait for backend to be ready before opening window
    await waitForBackend(serverPort);
    createWindow();
    
    // Setup auto-updater
    setupAutoUpdater();
    
    // Start health monitoring after everything is ready
    startHealthMonitoring();
  } catch (error) {
    console.error('Failed to start application:', error);
    dialog.showErrorBox('Startup Error', 'Failed to start the application backend.');
    app.quit();
  }
});

app.on('window-all-closed', () => {
    // Stop health monitoring
    stopHealthMonitoring();
    
    // Terminate Python process
    if (pythonProcess) {
        pythonProcess.kill();
    }
    
    // On macOS, keep app running even when all windows are closed
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', async () => {
    if (mainWindow === null) {
        try {
            // Immediately restart backend if needed
            if (!pythonProcess || pythonProcess.killed) {
                startPythonBackend();
                await waitForBackend(serverPort);
            }
            
            createWindow();
            
            // Restart health monitoring if it was stopped
            if (!healthCheckInterval) {
                startHealthMonitoring();
            }
        } catch (error) {
            console.error('Failed to restart on activate:', error);
            createWindow(); // Create window anyway
            startHealthMonitoring(); // Let health monitor handle the restart
        }
    }
});

app.on('before-quit', () => {
    // Stop health monitoring
    stopHealthMonitoring();
    
    // Ensure Python process is terminated
    if (pythonProcess) {
        pythonProcess.kill('SIGTERM');
        // Give it a moment to shut down gracefully
        setTimeout(() => {
            if (pythonProcess && !pythonProcess.killed) {
                pythonProcess.kill('SIGKILL');
            }
        }, 1000);
    }
});
