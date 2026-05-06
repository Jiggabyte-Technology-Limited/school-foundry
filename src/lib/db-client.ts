declare global {
  interface Window {
    api: {
      dbQuery: (sql: string, params: any[]) => Promise<any[]>;
      dbRun: (sql: string, params: any[]) => Promise<any>;
      dbGet: (sql: string, params: any[]) => Promise<any>;
      fsBackup: () => Promise<boolean>;
      fsRestore: () => Promise<boolean>;
    };
  }
}

export const db = {
  all: (sql: string, params: any[] = []) => window.api.dbQuery(sql, params),
  run: (sql: string, params: any[] = []) => window.api.dbRun(sql, params),
  get: (sql: string, params: any[] = []) => window.api.dbGet(sql, params),
  backup: () => window.api.fsBackup(),
  restore: () => window.api.fsRestore(),
};
