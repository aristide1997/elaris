// Application configuration constants
module.exports = {
  // Server configuration
  SERVER_PORT: 8000,
  
  // Health check configuration
  HEALTH_CHECK_INTERVAL: 8000, // 8 seconds
  HEALTH_CHECK_TIMEOUT: 2000,
  HEALTH_CHECK_RETRIES: 40,
  HEALTH_CHECK_RETRY_INTERVAL: 500,
  
  // Backend restart configuration
  GRACEFUL_SHUTDOWN_TIMEOUT: 2000,
  
  // Window configuration
  MAIN_WINDOW: {
    width: 1200,
    height: 800,
    title: 'Elaris'
  },
  
  SETTINGS_WINDOW: {
    width: 800,
    height: 700,
    title: 'Settings - Elaris'
  },
  
  // Development configuration
  DEV_SERVER_URL: 'http://localhost:5173',
  
  // Auto-updater configuration
  UPDATE_CHECK_DELAY: 5000, // 5 seconds after startup
  
  // Paths
  ICON_PATH: 'icon.png',
  PRELOAD_PATH: 'preload.js'
};
