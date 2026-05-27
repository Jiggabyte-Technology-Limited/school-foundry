import { ipcMain } from 'electron';
import {
  validateLicense,
  activateLicense,
  deactivateLicense,
  getMachineId,
  type ValidationResult,
} from './validator';

/**
 * Setup IPC handlers for license operations
 */
export function setupLicenseIpcHandlers(): void {
  console.log('[LicenseIPC] Setting up license IPC handlers...');

  // Handler: Get Machine ID for display in activation UI
  ipcMain.handle('get-machine-id', async (): Promise<string | null> => {
    try {
      const machineId = await getMachineId();
      return machineId;
    } catch (error) {
      console.error('[LicenseIPC] Error getting machine ID:', error);
      return null;
    }
  });

  // Handler: Activate license with Base64-encoded license string
  ipcMain.handle(
    'activate-license',
    async (_event, base64License: string): Promise<ValidationResult> => {
      try {
        const result = await activateLicense(base64License);
        return result;
      } catch (error) {
        console.error('[LicenseIPC] Error activating license:', error);
        return {
          valid: false,
          status: 'invalid',
          error: 'An unexpected error occurred during activation.',
        };
      }
    }
  );

  // Handler: Get current license status
  ipcMain.handle('get-license-status', async (): Promise<ValidationResult> => {
    try {
      const result = await validateLicense();
      return result;
    } catch (error) {
      console.error('[LicenseIPC] Error getting license status:', error);
      return {
        valid: false,
        status: 'invalid',
        error: 'Failed to validate license.',
      };
    }
  });

  // Handler: Deactivate license (delete license file)
  ipcMain.handle('deactivate-license', async (): Promise<boolean> => {
    try {
      return deactivateLicense();
    } catch (error) {
      console.error('[LicenseIPC] Error deactivating license:', error);
      return false;
    }
  });

  console.log('[LicenseIPC] License IPC handlers registered');
}
