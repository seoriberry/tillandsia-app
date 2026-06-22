const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onSystemData: (callback) => {
    ipcRenderer.on('system-data', (event, data) => callback(data));
  },
  moveWindow: (x, y) => ipcRenderer.send('move-window', { x, y }),
  getCursorPos: () => ipcRenderer.invoke('get-cursor-pos'),
  getWindowPos: () => ipcRenderer.invoke('get-window-pos'),
});