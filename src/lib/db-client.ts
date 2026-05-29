export interface DbRunResult {
  lastID: number;
  lastInsertRowid: number;
  changes: number;
}

export interface PrintToPdfOptions {
  html: string;
  filename: string;
  title: string;
}

export interface PrintToPdfResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

export interface OpenFileResult {
  success: boolean;
  error?: string;
}

declare global {
  interface Window {
    api: {
      dbQuery: (sql: string, params: any[]) => Promise<any[]>;
      dbRun: (sql: string, params: any[]) => Promise<DbRunResult>;
      dbGet: (sql: string, params: any[]) => Promise<any>;
      fsBackup: () => Promise<boolean>;
      fsRestore: () => Promise<boolean>;
      printToPdf: (options: PrintToPdfOptions) => Promise<PrintToPdfResult>;
      openFileForPrint: (filePath: string) => Promise<OpenFileResult>;
      getPrintOutputDir: () => Promise<string>;
      autoDebitFees: () => Promise<{ success: boolean; error?: string }>;
      clearDatabase: () => Promise<{ success: boolean; error?: string }>;
      resetApp: () => Promise<{ success: boolean; error?: string }>;
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
      }) => Promise<{ success: boolean; filePath?: string; error?: string; canceled?: boolean }>;
    };
  }
}

const getApi = () => {
  if (typeof window === 'undefined' || !window.api) {
    throw new Error(
      "Electron Database API (window.api) is not available. " +
      "This usually means the preload script failed to load or you are running the app in a web browser instead of Electron."
    );
  }
  return window.api;
};

export const db = {
  all: (sql: string, params: any[] = []) => getApi().dbQuery(sql, params),
  run: (sql: string, params: any[] = []) => getApi().dbRun(sql, params),
  get: (sql: string, params: any[] = []) => getApi().dbGet(sql, params),
  backup: () => getApi().fsBackup(),
  restore: () => getApi().fsRestore(),
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
  }) => getApi().exportXlsxReport(options),
  exportXlsxStatementsToZip: (options: {
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
  }) => getApi().exportXlsxStatementsToZip(options),
};
