import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  dbQuery: (sql: string, params: any[]) => ipcRenderer.invoke('db-query', sql, params),
  dbRun: (sql: string, params: any[]) => ipcRenderer.invoke('db-run', sql, params),
  dbGet: (sql: string, params: any[]) => ipcRenderer.invoke('db-get', sql, params),
  fsBackup: () => ipcRenderer.invoke('fs-backup'),
  fsRestore: () => ipcRenderer.invoke('fs-restore'),
});
