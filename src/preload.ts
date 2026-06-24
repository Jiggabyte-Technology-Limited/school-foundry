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
  exportXlsxStatementsToZip: (
    options: {
      suggestedFileName: string;
      statements: Array<{
        filename: string;
        workbook: {
          sheetName: string;
          topRows?: Array<{ value: string; styleId?: number; mergeAcross?: number }>;
          columns: Array<{ key: string; header: string; width?: number; type?: string }>;
          rows: Array<Record<string, any>>;
          summaryRows?: Array<{
            label: string;
            value: string | number;
            valueType?: string;
            valueStyleId?: number;
          }>;
          freezeRows?: number;
          autoFilter?: boolean;
        };
      }>;
    }
  ) => ipcRenderer.invoke('export-xlsx-statements-to-zip', options),
  openUserGuideWindow: () => ipcRenderer.invoke('open-user-guide-window'),
  clearDatabase: () => ipcRenderer.invoke('clear-database'),
  resetApp: () => ipcRenderer.invoke('reset-app'),
  exportXlsxReport: (options: {
    suggestedFileName: string;
    workbook: {
      sheetName: string;
      topRows?: Array<{ value: string; styleId?: number; mergeAcross?: number }>;
      columns: Array<{ key: string; header: string; width?: number; type?: string }>;
      rows: Array<Record<string, any>>;
      summaryRows?: Array<{
        label: string;
        value: string | number;
        valueType?: string;
        valueStyleId?: number;
      }>;
      freezeRows?: number;
      autoFilter?: boolean;
    };
  }) => ipcRenderer.invoke('export-xlsx-report', options),
  getGuideMediaLibrary: () => ipcRenderer.invoke('get-guide-media-library'),

  // Import APIs
  openImportFileDialog: () => ipcRenderer.invoke('open-import-file-dialog'),
  getImportPreview: (options: {
    filePath: string;
    sheetName: string;
    columnMapping: Record<string, string>;
    tableType: 'students' | 'payments';
  }) => ipcRenderer.invoke('get-import-preview', options),
  commitImport: (options: {
    filePath: string;
    sheetName: string;
    columnMapping: Record<string, string>;
    tableType: 'students' | 'payments';
    dryRun?: boolean;
  }) => ipcRenderer.invoke('commit-import', options),

  // License APIs
  getMachineId: () => ipcRenderer.invoke('get-machine-id'),
  activateLicense: (licenseKey: string) => ipcRenderer.invoke('activate-license', licenseKey),
  getLicenseStatus: () => ipcRenderer.invoke('get-license-status'),
  deactivateLicense: () => ipcRenderer.invoke('deactivate-license'),
});
