const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mcAPI', {
  getVersions: () => ipcRenderer.invoke('get-versions'),
  getProfiles: () => ipcRenderer.invoke('get-profiles'),
  createProfile: (data) => ipcRenderer.invoke('create-profile', data),
  launchGame: (data) => ipcRenderer.invoke('launch-game', data),
  onProgress: (cb) => ipcRenderer.on('launch-progress', (_, data) => cb(data)),
  onLog: (cb) => ipcRenderer.on('launch-log', (_, data) => cb(data)),
  onClose: (cb) => ipcRenderer.on('launch-close', (_, code) => cb(code)),
});
