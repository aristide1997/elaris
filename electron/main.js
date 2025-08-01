const AppManager = require('./src/main/app-manager');

// Initialize the application
const appManager = new AppManager();

// Export for potential external access (testing, etc.)
module.exports = appManager;
