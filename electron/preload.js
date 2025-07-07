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
    onSettingsUpdated: (callback) => ipcRenderer.on('settings-updated', callback)
});
