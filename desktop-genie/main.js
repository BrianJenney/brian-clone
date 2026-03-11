// Load environment variables from parent directory (shared with Next.js app)
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  globalShortcut,
  ipcMain,
  desktopCapturer,
  clipboard,
  nativeImage,
  screen,
  systemPreferences,
  Notification,
  shell,
  dialog
} = require('electron');

// Vector DB integration
const { searchWritingSamples, formatWritingSamples } = require('./lib/search');
const { uploadContent } = require('./lib/upload');

let mainWindow = null;
let tray = null;
let isExpanded = false;

const COLLAPSED_SIZE = { width: 60, height: 60 };
const EXPANDED_SIZE = { width: 380, height: 520 };

function createWindow() {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: COLLAPSED_SIZE.width,
    height: COLLAPSED_SIZE.height,
    x: screenWidth - COLLAPSED_SIZE.width - 20,
    y: screenHeight - COLLAPSED_SIZE.height - 20,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Prevent window from being closed, just hide it
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // Keep window visible on all workspaces (macOS)
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
}

function createTray() {
  // Create a simple tray icon (will be replaced with actual icon)
  const trayIcon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAA7AAAAOwBeShxvQAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAKfSURBVFiFxddNiFVVHMfxz7kzjjOOOr7gC5iiIoKSUBBBixYGLVpEi4gWrVq0aNGiVbSoRYtWQbRo1aJFiyAIgqBFBBFBixYhCIIgKOKL4+j4Ms77zJ0Wdx7uPPfMnfsywl/+3HvO/3d+5/z/5557wr+IQZX5QyjGKHoq8xdwAydxFsdwBqvJn8RVTFQ+RzGOa/gBu/A9VuJFLMSv+AqXsQcPYjJOYBJP4l5sxTqsxkKE+ATTeBSLsQbLsAgfYxdewXpsKJe7C9fiafyMvXgPz5ULfYDjOIKv8QHexwMoBD6PsTiA7VheLvouDmMbduJd3F8u+Bie/EtTqKvE+wkncAjv4B1sLBf7G36Jn/EkHi8XeyeOl3kVz5SLvRePYT7m4VO8i0fLxV7C+/gZT2Ntudj7cQgvYyvewiZ8jc34AP+u+Pp+L34ZLyiswT/QdhbhIl7Dm3gLd5WLfQKHsQ1v4G3cWy72fnyOQ3gZW/AWHsB+fIC38UG52LfwMQ7hebyBe8rFPoqP8DM24jU8UC52B77Am3gNb+CecrFPYid+wkZsxb3lYn+IT3EQG/EGHi4X+wR24Uesx5t4qFzsE/gEP2E9tuLhcrH34hN8hnVYj4fLxd6Pj/Ez1mELHikXex92lOdehy14pFzsLdiJn7AOb+DRcrH34mP8grVYj8fKxd6LT/Er1mI9ni4Xex92oACbsQXPlIt9EB/jV6zFBmwuF3sPPsFvWIsN2Fou9gHsRIH12IjN5WLvx0f4HauxAZvLxT6AnfgFq7EB28rF3oeP8DtWYwO2l4u9F5/iD6zCemwvF3sfPsIfWIUN2FEu9h58ij+xCuuwq1zsPfgEf2ElNmB3udh78Cn+wkqsw55ysQ/gY/yNlViH/eViH8An+B9gD6oPPUFJwAAAAABJRU5ErkJggg=='
  );

  tray = new Tray(trayIcon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Genie',
      click: () => {
        mainWindow.show();
      }
    },
    {
      label: 'Capture Screen',
      click: () => {
        captureScreen();
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('Genie - AI Screen Assistant');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
    }
  });
}

function registerGlobalShortcut() {
  const shortcut = 'CommandOrControl+Shift+G';

  const success = globalShortcut.register(shortcut, () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  if (!success) {
    console.error('Failed to register global shortcut:', shortcut);
  }
}

async function captureScreen() {
  try {
    // Check screen capture permission on macOS
    if (process.platform === 'darwin') {
      const status = systemPreferences.getMediaAccessStatus('screen');
      console.log('Screen recording permission status:', status);

      if (status !== 'granted') {
        // Show dialog to guide user
        const result = await dialog.showMessageBox(mainWindow, {
          type: 'warning',
          title: 'Screen Recording Permission Required',
          message: 'Genie needs Screen Recording permission to capture your screen.',
          detail: 'Click "Open Settings" to grant permission, then restart Genie.',
          buttons: ['Open Settings', 'Cancel'],
          defaultId: 0
        });

        if (result.response === 0) {
          // Open System Preferences to Security & Privacy > Screen Recording
          shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
        }

        return {
          error: 'Screen Recording permission required. Grant permission in System Settings, then restart Genie.',
          permissionDenied: true
        };
      }
    }

    console.log('Attempting to get screen sources...');
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 }
    });
    console.log('Got sources:', sources.length);

    if (sources.length === 0) {
      return {
        error: 'No screen sources available. Try restarting Genie after granting permission.',
        permissionDenied: true
      };
    }

    const primaryScreen = sources[0];
    const screenshot = primaryScreen.thumbnail;

    // Check if we got an actual image (not empty)
    if (screenshot.isEmpty()) {
      return {
        error: 'Screen capture returned empty image. Please grant Screen Recording permission and restart Genie.',
        permissionDenied: true
      };
    }

    const base64 = screenshot.toDataURL().replace(/^data:image\/png;base64,/, '');

    return {
      success: true,
      image: base64,
      width: screenshot.getSize().width,
      height: screenshot.getSize().height
    };
  } catch (error) {
    console.error('Screen capture error:', error);
    return { error: `Screen capture failed: ${error.message}` };
  }
}

// IPC Handlers
ipcMain.handle('capture-screen', async () => {
  return await captureScreen();
});

ipcMain.handle('copy-to-clipboard', async (event, text) => {
  clipboard.writeText(text);

  // Show notification
  if (Notification.isSupported()) {
    new Notification({
      title: 'Copied to Clipboard',
      body: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      silent: true
    }).show();
  }

  return { success: true };
});

ipcMain.handle('toggle-expand', async (event, expand) => {
  isExpanded = expand;
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  if (expand) {
    mainWindow.setSize(EXPANDED_SIZE.width, EXPANDED_SIZE.height);
    mainWindow.setPosition(
      screenWidth - EXPANDED_SIZE.width - 20,
      screenHeight - EXPANDED_SIZE.height - 20
    );
  } else {
    mainWindow.setSize(COLLAPSED_SIZE.width, COLLAPSED_SIZE.height);
    mainWindow.setPosition(
      screenWidth - COLLAPSED_SIZE.width - 20,
      screenHeight - COLLAPSED_SIZE.height - 20
    );
  }

  return { success: true, expanded: isExpanded };
});

ipcMain.handle('get-expanded-state', () => {
  return isExpanded;
});

ipcMain.handle('get-api-key', () => {
  return process.env.ANTHROPIC_API_KEY || '';
});

ipcMain.handle('get-openai-key', () => {
  return process.env.OPENAI_API_KEY || '';
});

ipcMain.handle('open-screen-recording-settings', () => {
  shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
});

ipcMain.handle('check-screen-permission', () => {
  if (process.platform === 'darwin') {
    return systemPreferences.getMediaAccessStatus('screen');
  }
  return 'granted';
});

// Vector DB: Search writing samples
ipcMain.handle('search-writing-samples', async (event, query, contentTypes = null) => {
  try {
    const results = await searchWritingSamples(query, contentTypes);
    return {
      success: true,
      results,
      formatted: formatWritingSamples(results)
    };
  } catch (error) {
    console.error('Search error:', error);
    return { success: false, error: error.message };
  }
});

// Vector DB: Upload content
ipcMain.handle('upload-content', async (event, text, contentType, metadata = {}) => {
  try {
    const result = await uploadContent(text, contentType, metadata);
    return result;
  } catch (error) {
    console.error('Upload error:', error);
    return { success: false, error: error.message };
  }
});

// App lifecycle
app.whenReady().then(() => {
  createWindow();
  createTray();
  registerGlobalShortcut();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow.show();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('before-quit', () => {
  app.isQuitting = true;
});
