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
  moveWindow: (deltaX, deltaY) => ipcRenderer.invoke('move-window', deltaX, deltaY),

  // AI API - will be called from renderer
  // Note: API keys are loaded via IPC from the main process where dotenv runs
  getApiKey: () => ipcRenderer.invoke('get-api-key'),
  getOpenAIKey: () => ipcRenderer.invoke('get-openai-key'),

  // Permissions
  openScreenRecordingSettings: () => ipcRenderer.invoke('open-screen-recording-settings'),
  checkScreenPermission: () => ipcRenderer.invoke('check-screen-permission'),

  // Vector DB: Writing samples
  searchWritingSamples: (query, contentTypes) => ipcRenderer.invoke('search-writing-samples', query, contentTypes),
  uploadContent: (text, contentType, metadata) => ipcRenderer.invoke('upload-content', text, contentType, metadata),

  // Task Recording
  startRecording: () => ipcRenderer.invoke('start-recording'),
  stopRecording: () => ipcRenderer.invoke('stop-recording'),
  getRecordingStatus: () => ipcRenderer.invoke('get-recording-status'),
  recordEvent: (eventType, data) => ipcRenderer.invoke('record-event', eventType, data),

  // Session Management
  listSessions: () => ipcRenderer.invoke('list-sessions'),
  loadSession: (sessionId) => ipcRenderer.invoke('load-session', sessionId),
  saveSession: (session) => ipcRenderer.invoke('save-session', session),
  deleteSession: (sessionId) => ipcRenderer.invoke('delete-session', sessionId),
  renameSession: (sessionId, newName) => ipcRenderer.invoke('rename-session', sessionId, newName),

  // Replay
  replaySession: (sessionId, config) => ipcRenderer.invoke('replay-session', sessionId, config),
  stopReplay: () => ipcRenderer.invoke('stop-replay'),
  pauseReplay: () => ipcRenderer.invoke('pause-replay'),
  resumeReplay: () => ipcRenderer.invoke('resume-replay'),
  getReplayStatus: () => ipcRenderer.invoke('get-replay-status'),

  // AI Computer Use
  replayWithAI: (sessionId, config) => ipcRenderer.invoke('replay-with-ai', sessionId, config),
  stopComputerUse: () => ipcRenderer.invoke('stop-computer-use'),
  getComputerUseStatus: () => ipcRenderer.invoke('get-computer-use-status'),

  // Computer Use event listeners
  onComputerUseAction: (callback) => {
    ipcRenderer.on('computer-use-action', (event, data) => callback(data));
  },
  onComputerUseIteration: (callback) => {
    ipcRenderer.on('computer-use-iteration', (event, data) => callback(data));
  },
  onComputerUseCompleted: (callback) => {
    ipcRenderer.on('computer-use-completed', (event, data) => callback(data));
  },
  onComputerUseError: (callback) => {
    ipcRenderer.on('computer-use-error', (event, data) => callback(data));
  },

  // Accessibility (for input monitoring)
  checkAccessibilityPermission: () => ipcRenderer.invoke('check-accessibility-permission'),
  openAccessibilitySettings: () => ipcRenderer.invoke('open-accessibility-settings')
});

// Also expose a simple way to check platform
contextBridge.exposeInMainWorld('platform', {
  isMac: process.platform === 'darwin',
  isWindows: process.platform === 'win32',
  isLinux: process.platform === 'linux'
});
