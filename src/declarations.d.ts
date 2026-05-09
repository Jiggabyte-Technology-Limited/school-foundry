declare module '*.css';
declare module '*.svg';
declare module '*.png';
declare module '*.jpg';
declare module '*.jpeg';
declare module '*.gif';
declare module '*.webp';

interface Window {
  api: {
    dbQuery: (sql: string, params: any[]) => Promise<any[]>;
    dbRun: (
      sql: string,
      params: any[]
    ) => Promise<{ lastID: number; lastInsertRowid: number; changes: number }>;
    dbGet: (sql: string, params: any[]) => Promise<any>;
    fsBackup: () => Promise<boolean>;
    fsRestore: () => Promise<boolean>;
    printToPdf: (options: {
      html: string;
      filename: string;
      title: string;
    }) => Promise<{ success: boolean; filePath?: string; error?: string }>;
    openFileForPrint: (filePath: string) => Promise<{ success: boolean; error?: string }>;
    getPrintOutputDir: () => Promise<string>;
    autoDebitFees: () => Promise<{ success: boolean; error?: string }>;
  };
}
