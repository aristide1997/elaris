const path = require('path');
const { app } = require('electron');

// Get paths for Python executable and working directory
function getPythonPaths() {
  let pythonExecutable;
  let pythonArgs = [];
  let workingDirectory;

  // Check if we're in development or production
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    // Development mode - use python directly
    pythonExecutable = 'python';
    pythonArgs = [path.join(__dirname, '..', '..', '..', 'server', 'main.py')];
    workingDirectory = path.join(__dirname, '..', '..', '..', 'server');
  } else {
    // Production mode - use bundled executable (one-dir mode)
    const resourcesPath = process.resourcesPath;
    pythonExecutable = path.join(resourcesPath, 'build', 'elaris-backend', 'elaris-backend');
    pythonArgs = []; // No arguments needed for the bundled executable
    workingDirectory = path.join(resourcesPath, 'build', 'elaris-backend');
  }

  return {
    pythonExecutable,
    pythonArgs,
    workingDirectory
  };
}

// Get environment variables for Python process
function getPythonEnvironment(serverPort, workingDirectory) {
  const resourcesPath = process.resourcesPath;
  
  return {
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
    // Disable logfire (transitive dependency from pydantic-ai) to prevent PyInstaller crashes
    LOGFIRE_IGNORE_NO_CONFIG: '1',
  };
}

// Get log file path
function getLogFilePath() {
  return path.join(app.getPath('userData'), 'server.log');
}

// Get frontend paths for window loading
function getFrontendPaths() {
  if (process.env.NODE_ENV === 'development') {
    return {
      mainUrl: 'http://localhost:5173',
      settingsUrl: 'http://localhost:5173/settings.html'
    };
  } else {
    return {
      mainPath: path.join(__dirname, '..', '..', '..', 'frontend', 'dist', 'index.html'),
      settingsPath: path.join(__dirname, '..', '..', '..', 'frontend', 'dist', 'settings.html')
    };
  }
}

// Get asset paths
function getAssetPaths() {
  return {
    iconPath: path.join(__dirname, '..', '..', 'icon.png'),
    preloadPath: path.join(__dirname, '..', '..', 'preload.js')
  };
}

module.exports = {
  getPythonPaths,
  getPythonEnvironment,
  getLogFilePath,
  getFrontendPaths,
  getAssetPaths
};
