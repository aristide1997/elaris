const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

// Keep a global reference of the window objects
let mainWindow;
let settingsWindow;
let pythonProcess;
let serverPort;

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
        pythonArgs = [path.join(__dirname, '..', 'python-backend', 'main.py')];
        workingDirectory = path.join(__dirname, '..', 'python-backend');
    } else {
        // Production mode - use bundled executable
        const resourcesPath = process.resourcesPath;
        pythonExecutable = path.join(resourcesPath, 'build', 'mcp-chatbot-backend');
        pythonArgs = []; // No arguments needed for the bundled executable
        workingDirectory = path.join(resourcesPath, 'build');
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
    const logFile = path.join(app.getPath('userData'), 'python-backend.log');
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
        title: 'MCP Chatbot'
    });

    // Load the renderer - use Vite dev server in development, built files in production
    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, 'renderer', 'dist', 'index.html'));
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
        title: 'Settings - MCP Chatbot',
        resizable: true,
        minimizable: false,
        maximizable: false
    });

    // Load the settings page
    if (process.env.NODE_ENV === 'development') {
        settingsWindow.loadURL('http://localhost:5173/settings.html');
        settingsWindow.webContents.openDevTools();
    } else {
        settingsWindow.loadFile(path.join(__dirname, 'renderer', 'dist', 'settings.html'));
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

app.whenReady().then(async () => {
  try {
    // Start Python backend on fixed port
    serverPort = 8000;
    startPythonBackend();

    // Wait for backend to be ready before opening window
    await waitForBackend(serverPort);
    createWindow();
  } catch (error) {
    console.error('Failed to start application:', error);
    dialog.showErrorBox('Startup Error', 'Failed to start the application backend.');
    app.quit();
  }
});

app.on('window-all-closed', () => {
    // Terminate Python process
    if (pythonProcess) {
        pythonProcess.kill();
    }
    
    // On macOS, keep app running even when all windows are closed
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});

app.on('before-quit', () => {
    // Ensure Python process is terminated
    if (pythonProcess) {
        pythonProcess.kill();
    }
});
