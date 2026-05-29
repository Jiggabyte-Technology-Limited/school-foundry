import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { generateMachineId, validateMachineId } from '../lib/machine-id';

// Shared secret for symmetric activation key generation
// This matches the secret used in the keygen-webapp
export const LICENSE_SECRET = 'FeesFoundry_Offline_Secret_2026';
const LICENSE_FILENAME = 'license.lic';

export type LicenseStatus = 'valid' | 'invalid' | 'expired' | 'not_found' | 'machine_mismatch';

export interface ValidationResult {
  valid: boolean;
  status: LicenseStatus;
  activationKey?: string;
  error?: string;
}

/**
 * Generate a 16-character Activation Key formatted as XXXX-XXXX-XXXX-XXXX
 * using an HMAC-SHA256 of the Machine ID.
 */
export function generateActivationKey(machineId: string): string {
  const hmac = crypto.createHmac('sha256', LICENSE_SECRET);
  hmac.update(machineId);
  
  // Take first 16 chars of hex output and convert to uppercase
  const rawKey = hmac.digest('hex').substring(0, 16).toUpperCase();
  
  // Format as XXXX-XXXX-XXXX-XXXX
  const parts = [];
  for (let i = 0; i < 16; i += 4) {
    parts.push(rawKey.substring(i, i + 4));
  }
  return parts.join('-');
}

function getLicenseFilePath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, LICENSE_FILENAME);
}

function readLicenseFile(): string | null {
  try {
    const filePath = getLicenseFilePath();
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath, 'utf-8').trim();
  } catch (e) {
    return null;
  }
}

function writeLicenseFile(key: string): boolean {
  try {
    const filePath = getLicenseFilePath();
    fs.writeFileSync(filePath, key, 'utf-8');
    console.log('[LicenseValidator] License file written');
    return true;
  } catch (error) {
    console.error('[LicenseValidator] Failed to write license file:', error);
    return false;
  }
}

export function deleteLicenseFile(): boolean {
  try {
    const filePath = getLicenseFilePath();
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log('[LicenseValidator] License file deleted');
    }
    return true;
  } catch (error) {
    console.error('[LicenseValidator] Failed to delete license file:', error);
    return false;
  }
}

export async function validateLicense(): Promise<ValidationResult> {
  const storedKey = readLicenseFile();
  if (!storedKey) {
    return { valid: false, status: 'not_found', error: 'License file not found' };
  }

  const machineId = await generateMachineId();
  if (!machineId) {
    return { valid: false, status: 'invalid', error: 'Failed to generate machine ID' };
  }

  const expectedKey = generateActivationKey(machineId);

  // Normalize stored key (remove dashes, whitespace, uppercase it)
  const normalizedStored = storedKey.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  const normalizedExpected = expectedKey.replace(/[^A-Z0-9]/gi, '').toUpperCase();

  if (normalizedStored === normalizedExpected) {
    return { valid: true, status: 'valid', activationKey: storedKey };
  } else {
    console.error('[LicenseValidator] Activation key mismatch');
    deleteLicenseFile();
    return { valid: false, status: 'machine_mismatch', error: 'License is not valid for this machine' };
  }
}

export async function activateLicense(enteredKey: string): Promise<ValidationResult> {
  try {
    if (!enteredKey) {
      return { valid: false, status: 'invalid', error: 'Please enter an activation key' };
    }

    const machineId = await generateMachineId();
    if (!machineId) {
      return { valid: false, status: 'invalid', error: 'Failed to generate machine ID' };
    }

    const expectedKey = generateActivationKey(machineId);
    
    // Normalize both keys to allow users to ignore dashes or case
    const normalizedEntered = enteredKey.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    const normalizedExpected = expectedKey.replace(/[^A-Z0-9]/gi, '').toUpperCase();

    if (normalizedEntered !== normalizedExpected) {
      return { valid: false, status: 'invalid', error: 'Invalid activation key for this machine. Please check and try again.' };
    }

    const saved = writeLicenseFile(expectedKey); // Save properly formatted key

    if (!saved) {
      return { valid: false, status: 'invalid', error: 'Failed to save license. Check write permissions.' };
    }

    console.log('[LicenseValidator] License activated successfully');
    return { valid: true, status: 'valid', activationKey: expectedKey };
  } catch (err) {
    console.error('[LicenseValidator] License activation failed:', err);
    return { valid: false, status: 'invalid', error: 'An unexpected error occurred during activation' };
  }
}

export function deactivateLicense(): boolean {
  return deleteLicenseFile();
}

export async function getMachineId(): Promise<string | null> {
  return generateMachineId();
}
