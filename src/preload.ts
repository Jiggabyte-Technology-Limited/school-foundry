import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  dbQuery: (sql: string, params: any[]) => ipcRenderer.invoke('db-query', sql, params),
  dbRun: (sql: string, params: any[]) => ipcRenderer.invoke('db-run', sql, params),
  dbGet: (sql: string, params: any[]) => ipcRenderer.invoke('db-get', sql, params),
  fsBackup: () => ipcRenderer.invoke('fs-backup'),
  fsRestore: () => ipcRenderer.invoke('fs-restore'),
  printToPdf: (options: { html: string; filename: string; title: string }) =>
    ipcRenderer.invoke('print-to-pdf', options),
  openFileForPrint: (filePath: string) => ipcRenderer.invoke('open-file-for-print', filePath),
  getPrintOutputDir: () => ipcRenderer.invoke('get-print-output-dir'),
  autoDebitFees: () => ipcRenderer.invoke('auto-debit-fees'),
  printStatementsToZip: (statements: { html: string; filename: string }[]) =>
    ipcRenderer.invoke('print-statements-to-zip', { statements }),

  // License APIs
  getMachineId: () => ipcRenderer.invoke('get-machine-id'),
  activateLicense: (licenseKey: string) => ipcRenderer.invoke('activate-license', licenseKey),
  getLicenseStatus: () => ipcRenderer.invoke('get-license-status'),
  deactivateLicense: () => ipcRenderer.invoke('deactivate-license'),
});
