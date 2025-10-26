const http = require('http');
const { HEALTH_CHECK_TIMEOUT, HEALTH_CHECK_RETRIES, HEALTH_CHECK_RETRY_INTERVAL } = require('../config/constants');

// Helper to wait for the Python backend to be ready
function waitForBackend(port, retries = HEALTH_CHECK_RETRIES, interval = HEALTH_CHECK_RETRY_INTERVAL) {
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
function checkBackendHealth(port) {
  return new Promise((resolve) => {
    const req = http.request(
      { 
        hostname: '127.0.0.1', 
        port, 
        path: '/api/conversations?limit=1', 
        method: 'GET', 
        timeout: HEALTH_CHECK_TIMEOUT 
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

module.exports = {
  waitForBackend,
  checkBackendHealth
};
