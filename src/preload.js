const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  loadPortfolio: () => ipcRenderer.invoke('portfolio:load'),
  savePortfolio: (data) => ipcRenderer.invoke('portfolio:save', data),
  copyCover: (data) => ipcRenderer.invoke('portfolio:copyCover', data),
  exportSite: () => ipcRenderer.invoke('portfolio:export'),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
  pickImage: () => ipcRenderer.invoke('dialog:pickImage'),
  confirmDelete: (payload) => ipcRenderer.invoke('confirm-delete', payload),
  copyDeveloperPhoto: (sourcePath) => ipcRenderer.invoke('portfolio:copyDeveloperPhoto', sourcePath),
  openExportFolder: () => ipcRenderer.invoke('portfolio:openExportFolder'),
  quitAfterSave: () => ipcRenderer.invoke('app:quitAfterSave'),
  onBeforeClose: (callback) => {
    ipcRenderer.on('app:before-close', () => callback());
  }
});