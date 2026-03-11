const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('genie', {
  // Screen capture
  captureScreen: () => ipcRenderer.invoke('capture-screen'),

  // Clipboard
  copyToClipboard: (text) => ipcRenderer.invoke('copy-to-clipboard', text),

  // Window management
  toggleExpand: (expand) => ipcRenderer.invoke('toggle-expand', expand),
  getExpandedState: () => ipcRenderer.invoke('get-expanded-state'),

  // AI API - will be called from renderer
  // Note: API keys are loaded via IPC from the main process where dotenv runs
  getApiKey: () => ipcRenderer.invoke('get-api-key'),
  getOpenAIKey: () => ipcRenderer.invoke('get-openai-key'),

  // Permissions
  openScreenRecordingSettings: () => ipcRenderer.invoke('open-screen-recording-settings'),
  checkScreenPermission: () => ipcRenderer.invoke('check-screen-permission'),

  // Vector DB: Writing samples
  searchWritingSamples: (query, contentTypes) => ipcRenderer.invoke('search-writing-samples', query, contentTypes),
  uploadContent: (text, contentType, metadata) => ipcRenderer.invoke('upload-content', text, contentType, metadata)
});

// Also expose a simple way to check platform
contextBridge.exposeInMainWorld('platform', {
  isMac: process.platform === 'darwin',
  isWindows: process.platform === 'win32',
  isLinux: process.platform === 'linux'
});
