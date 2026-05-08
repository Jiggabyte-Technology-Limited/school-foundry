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
};
