const { spawn } = require('child_process');
const fs = require('fs');
const { SERVER_PORT, HEALTH_CHECK_INTERVAL, GRACEFUL_SHUTDOWN_TIMEOUT } = require('../config/constants');
const { waitForBackend, checkBackendHealth } = require('../utils/backend-utils');
const { getPythonPaths, getPythonEnvironment, getLogFilePath } = require('../utils/path-utils');

class BackendManager {
  constructor() {
    this.pythonProcess = null;
    this.serverPort = SERVER_PORT;
    this.healthCheckInterval = null;
    this.isRestarting = false;
    this.windowManager = null;
  }

  setWindowManager(windowManager) {
    this.windowManager = windowManager;
  }

  // Function to start Python backend
  startPythonBackend() {
    console.log(`Starting Python backend on port ${this.serverPort}`);
    
    const { pythonExecutable, pythonArgs, workingDirectory } = getPythonPaths();
    const spawnEnv = getPythonEnvironment(this.serverPort, workingDirectory);

    console.log(`Using Python executable: ${pythonExecutable}`);
    console.log(`Working directory: ${workingDirectory}`);

    this.pythonProcess = spawn(pythonExecutable, pythonArgs, { 
      env: spawnEnv, 
      cwd: workingDirectory 
    });

    // Pipe Python backend logs to file
    const logFile = getLogFilePath();
    const logStream = fs.createWriteStream(logFile, { flags: 'a' });
    this.pythonProcess.stdout.pipe(logStream);
    this.pythonProcess.stderr.pipe(logStream);

    this.pythonProcess.stdout.on('data', (data) => {
      console.log(`Python stdout: ${data}`);
    });

    this.pythonProcess.stderr.on('data', (data) => {
      console.error(`Python stderr: ${data}`);
    });

    this.pythonProcess.on('close', (code) => {
      console.log(`Python process exited with code ${code}`);
    });

    this.pythonProcess.on('error', (error) => {
      console.error('Failed to start Python process:', error);
    });
  }

  // Function to restart Python backend
  async restartPythonBackend() {
    if (this.isRestarting) {
      console.log('Backend restart already in progress, skipping...');
      return;
    }
    
    this.isRestarting = true;
    console.log('Restarting Python backend...');
    
    // Notify renderer about restart
    if (this.windowManager) {
      this.windowManager.notifyBackendRestarting();
    }
    
    try {
      // Kill existing process if it exists
      if (this.pythonProcess) {
        this.pythonProcess.kill('SIGTERM');
        // Wait a bit for graceful shutdown
        await new Promise(resolve => setTimeout(resolve, GRACEFUL_SHUTDOWN_TIMEOUT));
        if (!this.pythonProcess.killed) {
          this.pythonProcess.kill('SIGKILL');
        }
      }
      
      // Start new backend process
      this.startPythonBackend();
      
      // Wait for it to be ready
      await waitForBackend(this.serverPort);
      
      console.log('Python backend restarted successfully');
      
      // Notify renderer about successful restart
      if (this.windowManager) {
        this.windowManager.notifyBackendRestarted(this.serverPort);
      }
      
    } catch (error) {
      console.error('Failed to restart Python backend:', error);
      
      // Notify renderer about restart failure
      if (this.windowManager) {
        this.windowManager.notifyBackendRestartFailed();
      }
    } finally {
      this.isRestarting = false;
    }
  }

  // Function to start health monitoring
  startHealthMonitoring() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    this.healthCheckInterval = setInterval(async () => {
      if (this.isRestarting) {
        return; // Skip health check during restart
      }
      
      const isHealthy = await checkBackendHealth(this.serverPort);
      if (!isHealthy) {
        console.log('Backend unhealthy, attempting restart...');
        await this.restartPythonBackend();
      }
    }, HEALTH_CHECK_INTERVAL);
    
    console.log('Backend health monitoring started');
  }

  // Function to stop health monitoring
  stopHealthMonitoring() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      console.log('Backend health monitoring stopped');
    }
  }

  // Initialize backend
  async initialize() {
    this.startPythonBackend();
    await waitForBackend(this.serverPort);
    this.startHealthMonitoring();
  }

  // Cleanup backend
  cleanup() {
    this.stopHealthMonitoring();
    
    // Terminate Python process
    if (this.pythonProcess) {
      this.pythonProcess.kill('SIGTERM');
      // Give it a moment to shut down gracefully
      setTimeout(() => {
        if (this.pythonProcess && !this.pythonProcess.killed) {
          this.pythonProcess.kill('SIGKILL');
        }
      }, 1000);
    }
  }

  // Check if backend is running
  isBackendRunning() {
    return this.pythonProcess && !this.pythonProcess.killed;
  }

  getServerPort() {
    return this.serverPort;
  }
}

module.exports = BackendManager;
