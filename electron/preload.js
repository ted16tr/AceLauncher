const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mcAPI', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (data) => ipcRenderer.invoke('save-config', data),
  getVersions: () => ipcRenderer.invoke('get-versions'),
  getLoaderVersions: (data) => ipcRenderer.invoke('get-loader-versions', data),
  getProfiles: () => ipcRenderer.invoke('get-profiles'),
  createProfile: (data) => ipcRenderer.invoke('create-profile', data),
  deleteProfile: (id) => ipcRenderer.invoke('delete-profile', id),
  openProfileFolder: (dir) => ipcRenderer.invoke('open-profile-folder', dir),
  searchContent: (data) => ipcRenderer.invoke('search-content', data),
  installContent: (data) => ipcRenderer.invoke('install-content', data),
  launchGame: (data) => ipcRenderer.invoke('launch-game', data),
  onInstallProgress: (cb) => ipcRenderer.on('install-progress', (_, msg) => cb(msg)),
  onStatus: (cb) => ipcRenderer.on('launch-status', (_, msg) => cb(msg)),
  onProgress: (cb) => ipcRenderer.on('launch-progress', (_, data) => cb(data)),
  onLog: (cb) => ipcRenderer.on('launch-log', (_, data) => cb(data)),
  onClose: (cb) => ipcRenderer.on('launch-close', (_, code) => cb(code)),
});
