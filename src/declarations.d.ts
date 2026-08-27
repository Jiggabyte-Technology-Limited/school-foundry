declare module '*.css' {
  const content: any;
  export default content;
}

declare module '*.svg' {
  const content: string;
  export default content;
}

declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module '*.jpeg' {
  const content: string;
  export default content;
}

declare module '*.gif' {
  const content: string;
  export default content;
}

declare module '*.webp' {
  const content: string;
  export default content;
}

declare module 'jszip';

declare module '*.mjs' {
  const content: any;
  export default content;
  export const DEFAULT_NEW_USER: any;
  export const hasUnsavedSettingsChanges: any;
  export const getDangerZoneConfirmationPhrase: any;
  export const getClearDatabaseTargets: any;
  export const getResetAppTargets: any;
  export const buildWorkbookBytes: any;
}

declare module '*?raw' {
  const content: string;
  export default content;
}

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

export interface DiscoveredPeer {
  nodeId: string;
  deviceName: string;
  schoolName: string;
  ipAddress: string;
  syncPort: number;
  lastSeen: number;
  status: 'online' | 'stale';
}

export interface NodeIdentityInfo {
  nodeId: string;
  deviceName: string;
  receiptPrefix: string;
  schoolName: string;
}

export interface SyncOperationResult {
  success: boolean;
  localApplied: number;
  remoteApplied: number;
  error?: string;
}

export interface XlsxWorkbookData {
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
}

export interface WindowApi {
  dbQuery: (sql: string, params?: any[]) => Promise<any[]>;
  dbRun: (sql: string, params?: any[]) => Promise<DbRunResult>;
  dbGet: (sql: string, params?: any[]) => Promise<any>;
  fsBackup: () => Promise<boolean>;
  fsRestore: () => Promise<boolean>;
  printToPdf: (options: PrintToPdfOptions) => Promise<PrintToPdfResult>;
  openFileForPrint: (filePath: string) => Promise<OpenFileResult>;
  getPrintOutputDir: () => Promise<string>;
  autoDebitFees: () => Promise<{ success: boolean; error?: string }>;
  printStatementsToZip: (
    statements: { html: string; filename: string }[]
  ) => Promise<{ success: boolean; filePath?: string; error?: string; canceled?: boolean }>;
  exportXlsxStatementsToZip: (options: {
    suggestedFileName: string;
    statements: Array<{
      filename: string;
      workbook: XlsxWorkbookData;
    }>;
  }) => Promise<{ success: boolean; filePath?: string; error?: string; canceled?: boolean }>;
  openUserGuideWindow: () => Promise<void>;
  clearDatabase: () => Promise<{ success: boolean; error?: string }>;
  resetApp: () => Promise<{ success: boolean; error?: string }>;
  exportXlsxReport: (options: {
    suggestedFileName: string;
    workbook: XlsxWorkbookData;
  }) => Promise<{ success: boolean; filePath?: string; error?: string; canceled?: boolean }>;
  getGuideMediaLibrary: () => Promise<{ success: boolean; rootPath?: string; sections?: any[]; error?: string }>;

  // Import APIs
  openImportFileDialog: () => Promise<any>;
  getImportPreview: (options: {
    filePath: string;
    sheetName: string;
    columnMapping: Record<string, string>;
    tableType: 'students' | 'payments';
  }) => Promise<any>;
  commitImport: (options: {
    filePath: string;
    sheetName: string;
    columnMapping: Record<string, string>;
    tableType: 'students' | 'payments';
    dryRun?: boolean;
  }) => Promise<any>;
  saveImportTemplate: (options: {
    fileName: string;
    headers: string[];
    sheetName: string;
  }) => Promise<any>;

  // Sync & Multi-Device Peer APIs
  syncGetIdentity: () => Promise<{ success: boolean; identity?: NodeIdentityInfo; syncPort?: number; error?: string }>;
  syncUpdateDeviceName: (name: string) => Promise<{ success: boolean; error?: string }>;
  syncGetPeers: () => Promise<{ success: boolean; peers: DiscoveredPeer[]; error?: string }>;
  syncWithPeer: (peerIp: string, peerPort: number) => Promise<SyncOperationResult>;
  syncAllPeers: () => Promise<{ success: boolean; results: Array<{ peer: DiscoveredPeer; result: SyncOperationResult }> }>;
  onPeersUpdated: (callback: (peers: DiscoveredPeer[]) => void) => () => void;
}

declare global {
  interface Window {
    api: WindowApi;
  }
}
