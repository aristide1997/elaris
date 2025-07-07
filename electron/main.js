const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

// Keep a global reference of the window objects
let mainWindow;
let settingsWindow;
let pythonProcess;
let serverPort;

// Function to start Python backend
function startPythonBackend() {
    console.log(`Starting Python backend on port ${serverPort}`);
    
    // In development, use python directly
    const pythonExecutable = 'python';
    const pythonArgs = [path.join(__dirname, '..', 'python-backend', 'main.py')];

    pythonProcess = spawn(pythonExecutable, pythonArgs, {
        env: { 
            ...process.env, 
            PORT: serverPort.toString(),
            PYTHONPATH: path.join(__dirname, '..', 'python-backend'),
        },
        cwd: path.join(__dirname, '..', 'python-backend')
    });

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
        // Start Python backend with fixed port 8000
        serverPort = 8000;
        startPythonBackend();
        
        // Give it a moment to start, then create window
        setTimeout(() => {
            createWindow();
        }, 4000);
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
