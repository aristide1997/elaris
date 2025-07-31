const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    onServerPort: (callback) => ipcRenderer.on('server-port', callback),
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
    
    // Settings window IPC methods
    openSettings: () => ipcRenderer.invoke('open-settings'),
    closeSettings: () => ipcRenderer.invoke('close-settings'),
    settingsUpdated: (settings) => ipcRenderer.invoke('settings-updated', settings),
    onSettingsUpdated: (callback) => ipcRenderer.on('settings-updated', callback),
    
    // Backend restart event handlers
    onBackendRestarting: (callback) => ipcRenderer.on('backend-restarting', callback),
    onBackendRestarted: (callback) => ipcRenderer.on('backend-restarted', callback),
    onBackendRestartFailed: (callback) => ipcRenderer.on('backend-restart-failed', callback),
    
    // Auto-updater IPC methods
    downloadUpdate: () => ipcRenderer.invoke('download-update'),
    installUpdate: () => ipcRenderer.invoke('install-update'),
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    
    // Auto-updater event handlers
    onUpdateAvailable: (callback) => ipcRenderer.on('update-available', callback),
    onUpdateError: (callback) => ipcRenderer.on('update-error', callback),
    onUpdateDownloadProgress: (callback) => ipcRenderer.on('update-download-progress', callback),
    onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', callback)
});
