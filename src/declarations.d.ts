declare module "*.css";
declare module "*.svg";
declare module "*.png";
declare module "*.jpg";
declare module "*.jpeg";
declare module "*.gif";
declare module "*.webp";

interface Window {
  api: {
    dbQuery: (sql: string, params: any[]) => Promise<any[]>;
    dbRun: (sql: string, params: any[]) => Promise<any>;
    dbGet: (sql: string, params: any[]) => Promise<any>;
    fsBackup: () => Promise<any>;
    fsRestore: () => Promise<any>;
    printToPdf: (options: { html: string; filename: string; title: string }) => Promise<any>;
    openFileForPrint: (filePath: string) => Promise<any>;
    getPrintOutputDir: () => Promise<string>;
  };
}
