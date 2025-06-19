const { app, BrowserWindow, dialog } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const net = require('net');
const fs = require('fs');

// Keep a global reference of the window object
let mainWindow;
let pythonProcess;
let serverPort;

// Function to find an available port
function findAvailablePort(startPort = 8000) {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.listen(startPort, () => {
            const port = server.address().port;
            server.close(() => resolve(port));
        });
        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                findAvailablePort(startPort + 1).then(resolve).catch(reject);
            } else {
                reject(err);
            }
        });
    });
}

// Simple function to start Python backend
function startPythonBackendSimple() {
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

// Function to start Python backend without waiting
async function startPythonBackendAsync() {
    try {
        serverPort = await findAvailablePort(8000);
        console.log(`Starting Python backend on port ${serverPort}`);
        
        // In development, use python directly
        // In production, this would be the bundled executable
        const pythonExecutable = process.env.NODE_ENV === 'development' 
            ? 'python' 
            : path.join(__dirname, '..', 'build', 'main');
        
        const pythonArgs = process.env.NODE_ENV === 'development'
            ? [path.join(__dirname, '..', 'python-backend', 'main.py')]
            : [];

        pythonProcess = spawn(pythonExecutable, pythonArgs, {
            env: { 
                ...process.env, 
                PORT: serverPort.toString(),
                PYTHONPATH: path.join(__dirname, '..', 'python-backend')
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

        return serverPort;
    } catch (error) {
        console.error('Failed to start Python backend:', error);
        throw error;
    }
}

// Function to start Python backend
async function startPythonBackend() {
    try {
        serverPort = await findAvailablePort(8000);
        console.log(`Starting Python backend on port ${serverPort}`);
        
        // In development, use python directly
        // In production, this would be the bundled executable
        const pythonExecutable = process.env.NODE_ENV === 'development' 
            ? 'python' 
            : path.join(__dirname, '..', 'build', 'main');
        
        const pythonArgs = process.env.NODE_ENV === 'development'
            ? [path.join(__dirname, '..', 'python-backend', 'main.py')]
            : [];

        pythonProcess = spawn(pythonExecutable, pythonArgs, {
            env: { 
                ...process.env, 
                PORT: serverPort.toString(),
                PYTHONPATH: path.join(__dirname, '..', 'python-backend')
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

        // Wait for server to be ready
        await waitForServer(serverPort);
        return serverPort;
    } catch (error) {
        console.error('Failed to start Python backend:', error);
        throw error;
    }
}

// Function to wait for server to be ready
function waitForServer(port, maxAttempts = 15) {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const checkServer = () => {
            const http = require('http');
            const req = http.request({
                hostname: 'localhost',
                port: port,
                path: '/docs', // FastAPI docs endpoint
                method: 'GET',
                timeout: 3000
            }, (res) => {
                console.log(`Server is ready on port ${port} (HTTP ${res.statusCode})`);
                req.destroy();
                resolve();
            });
            
            req.on('error', (err) => {
                attempts++;
                console.log(`Server check attempt ${attempts}/${maxAttempts} failed:`, err.code);
                if (attempts >= maxAttempts) {
                    reject(new Error(`Server failed to start after ${maxAttempts} attempts`));
                } else {
                    setTimeout(checkServer, 2000);
                }
            });
            
            req.on('timeout', () => {
                attempts++;
                console.log(`Server check attempt ${attempts}/${maxAttempts} timed out`);
                req.destroy();
                if (attempts >= maxAttempts) {
                    reject(new Error(`Server connection timed out after ${maxAttempts} attempts`));
                } else {
                    setTimeout(checkServer, 2000);
                }
            });
            
            req.end();
        };
        
        // Wait a bit before first check to let server initialize
        setTimeout(checkServer, 3000);
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
        startPythonBackendSimple();
        
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
