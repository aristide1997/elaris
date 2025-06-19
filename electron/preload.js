const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    onServerPort: (callback) => ipcRenderer.on('server-port', callback),
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});
