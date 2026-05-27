declare module '*.css';
declare module '*.svg';
declare module '*.png';
declare module '*.jpg';
declare module '*.jpeg';
declare module '*.gif';
declare module '*.webp';
declare module 'jszip';

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
    printStatementsToZip: (
      statements: { html: string; filename: string }[]
    ) => Promise<{ success: boolean; filePath?: string; error?: string; canceled?: boolean }>;

    // License APIs
    getMachineId: () => Promise<string | null>;
    activateLicense: (licenseKey: string) => Promise<{
      valid: boolean;
      status: string;
      error?: string;
      expiresAt?: string;
      daysRemaining?: number;
    }>;
    getLicenseStatus: () => Promise<{
      valid: boolean;
      status: string;
      error?: string;
      expiresAt?: string;
      daysRemaining?: number;
    }>;
    deactivateLicense: () => Promise<boolean>;
  };
}
