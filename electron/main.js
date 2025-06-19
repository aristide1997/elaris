const { app, BrowserWindow, dialog } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

// Keep a global reference of the window object
let mainWindow;
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

    // Load the renderer HTML file
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

    // Open DevTools in development
    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Pass server port to renderer when ready
    mainWindow.webContents.once('dom-ready', () => {
        mainWindow.webContents.send('server-port', serverPort);
    });
}

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
