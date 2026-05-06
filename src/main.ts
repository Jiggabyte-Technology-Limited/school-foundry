import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { initializeDatabase } from './db/init';
import { setupIpcHandlers } from './db/ipc';

function createWindow() {
  const isDev = !app.isPackaged;
  const preloadPath = path.join(__dirname, 'preload.js');
  
  console.log('[Main] Preload Path:', preloadPath);
  console.log('[Main] Dev Mode:', isDev);

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath,
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, 'index.html'));
  }
}

async function startApp() {
  await initializeDatabase();
  setupIpcHandlers();
  createWindow();
}

app.whenReady().then(startApp);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
