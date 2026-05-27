import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { generateMachineId, validateMachineId } from '../lib/machine-id';

// ============================================================================
// PUBLIC KEY (SPKI PEM format)
// This key is embedded in the application for signature verification
// Corresponds to the private key in keygen.js
// ============================================================================
const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEArCvN3r6jGkVfFqj0yD9R
pLwW7VmPjH8V4gHvBZxJfZ8mQK3LdN7sR5pY2xG8WJhM1vK0nOqT7sZ4cB9L2V
qX5fP4wZ8mK2nH5tR3sY7vB8wL9oX6aQ4eP1rU2vT8wZ3mK5nH7tR5sY9vB8wL
oX6aQ4eP1rU2vT8wZ3mK5nH7tR5sY9vB8wLoX6aQ4eP1rU2vT8wZ3mK5nH7tR
5sY9vB8wLoX6aQ4eP1rU2vT8wZ3mK5nH7tR5sY9vB8wLoX6aQ4eP1rU2vT8wZ
3mK5nH7tR5sY9vB8wLoX6aQ4eP1rU2vT8wZ3mK5nHwIDAQAB
-----END PUBLIC KEY-----`;

// License file name stored in app userData directory
const LICENSE_FILENAME = 'license.lic';

// License status types
export type LicenseStatus = 'valid' | 'invalid' | 'expired' | 'not_found' | 'machine_mismatch';

export interface LicensePayload {
  machineId: string;
  expiresAt?: string; // ISO date string (YYYY-MM-DD) or undefined for perpetual
  generatedAt: string; // ISO timestamp
}

export interface LicenseData {
  payload: LicensePayload;
  signature: string; // Base64-encoded RSA-PSS signature
}

export interface ValidationResult {
  valid: boolean;
  status: LicenseStatus;
  payload?: LicensePayload;
  error?: string;
  expiresAt?: string;
  daysRemaining?: number;
}

/**
 * Get the path to the license file in app userData directory
 */
function getLicenseFilePath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, LICENSE_FILENAME);
}

/**
 * Read the license file from disk
 * Returns null if file doesn't exist or is malformed
 */
function readLicenseFile(): LicenseData | null {
  try {
    const filePath = getLicenseFilePath();

    if (!fs.existsSync(filePath)) {
      console.log('[LicenseValidator] License file not found:', filePath);
      return null;
    }

    const base64Content = fs.readFileSync(filePath, 'utf-8').trim();
    const jsonString = Buffer.from(base64Content, 'base64').toString('utf-8');
    const licenseData: LicenseData = JSON.parse(jsonString);

    return licenseData;
  } catch (error) {
    console.error('[LicenseValidator] Failed to read license file:', error);
    return null;
  }
}

/**
 * Write license data to disk
 */
function writeLicenseFile(licenseData: LicenseData): boolean {
  try {
    const filePath = getLicenseFilePath();
    const jsonString = JSON.stringify(licenseData);
    const base64Content = Buffer.from(jsonString, 'utf-8').toString('base64');

    fs.writeFileSync(filePath, base64Content, 'utf-8');
    console.log('[LicenseValidator] License file written to:', filePath);
    return true;
  } catch (error) {
    console.error('[LicenseValidator] Failed to write license file:', error);
    return false;
  }
}

/**
 * Delete the license file
 */
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

/**
 * Canonicalize payload for signature verification
 * Fields must be in exact order with no extra whitespace
 */
function canonicalizePayload(payload: LicensePayload): string {
  // Enforce strict field order matching keygen.js
  const orderedPayload = {
    machineId: payload.machineId,
    expiresAt: payload.expiresAt || null,
    generatedAt: payload.generatedAt,
  };

  return JSON.stringify(orderedPayload);
}

/**
 * Verify RSA-PSS signature
 * Returns true if signature is valid
 */
function verifySignature(payload: LicensePayload, signatureBase64: string): boolean {
  try {
    const payloadString = canonicalizePayload(payload);
    const signatureBuffer = Buffer.from(signatureBase64, 'base64');

    const isValid = crypto.verify(
      'sha256',
      Buffer.from(payloadString, 'utf-8'),
      {
        key: PUBLIC_KEY_PEM,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
      },
      signatureBuffer
    );

    return isValid;
  } catch (error) {
    console.error('[LicenseValidator] Signature verification failed:', error);
    return false;
  }
}

/**
 * Check if license has expired
 * Returns true if expired, false otherwise
 */
function isExpired(expiresAt?: string): boolean {
  if (!expiresAt) {
    return false; // Perpetual license never expires
  }

  const expiryDate = new Date(expiresAt + 'T23:59:59.999Z');
  const now = new Date();

  return now > expiryDate;
}

/**
 * Calculate days remaining until expiration
 */
function calculateDaysRemaining(expiresAt?: string): number | undefined {
  if (!expiresAt) {
    return undefined; // Perpetual license
  }

  const expiryDate = new Date(expiresAt + 'T23:59:59.999Z');
  const now = new Date();
  const diffMs = expiryDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  return Math.max(0, diffDays);
}

/**
 * Validate the current license
 */
export async function validateLicense(): Promise<ValidationResult> {
  // Step 1: Read license file
  const licenseData = readLicenseFile();

  if (!licenseData) {
    return {
      valid: false,
      status: 'not_found',
      error: 'License file not found',
    };
  }

  const { payload, signature } = licenseData;

  // Step 2: Verify RSA-PSS signature
  const isSignatureValid = verifySignature(payload, signature);

  if (!isSignatureValid) {
    console.error('[LicenseValidator] Invalid signature detected');
    deleteLicenseFile(); // Clean up invalid license
    return {
      valid: false,
      status: 'invalid',
      error: 'License signature is invalid',
    };
  }

  // Step 3: Verify machine ID matches current hardware
  const currentMachineId = await generateMachineId();

  if (!currentMachineId) {
    return {
      valid: false,
      status: 'invalid',
      error: 'Failed to generate machine ID',
    };
  }

  if (currentMachineId !== payload.machineId) {
    console.error('[LicenseValidator] Machine ID mismatch');
    deleteLicenseFile(); // Clean up license for wrong machine
    return {
      valid: false,
      status: 'machine_mismatch',
      error: 'License is not valid for this machine',
    };
  }

  // Step 4: Check expiration
  if (isExpired(payload.expiresAt)) {
    return {
      valid: false,
      status: 'expired',
      payload,
      error: 'License has expired',
      expiresAt: payload.expiresAt,
    };
  }

  // All checks passed
  return {
    valid: true,
    status: 'valid',
    payload,
    expiresAt: payload.expiresAt,
    daysRemaining: calculateDaysRemaining(payload.expiresAt),
  };
}

/**
 * Activate license with a Base64-encoded license string
 * This is called when user pastes the license key received via SMS/WhatsApp
 */
export async function activateLicense(
  base64License: string
): Promise<ValidationResult> {
  try {
    // Step 1: Decode the Base64 license string
    let licenseData: LicenseData;

    try {
      const jsonString = Buffer.from(base64License.trim(), 'base64').toString('utf-8');
      licenseData = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('[LicenseValidator] Failed to parse license:', parseError);
      return {
        valid: false,
        status: 'invalid',
        error: 'Invalid license format. Please check the license key and try again.',
      };
    }

    // Step 2: Validate license structure
    if (!licenseData.payload || !licenseData.signature) {
      return {
        valid: false,
        status: 'invalid',
        error: 'License file is malformed',
      };
    }

    // Step 3: Get current machine ID
    const currentMachineId = await generateMachineId();

    if (!currentMachineId) {
      return {
        valid: false,
        status: 'invalid',
        error: 'Failed to generate machine ID. Please ensure you are on Windows.',
      };
    }

    // Step 4: Verify machine ID matches the license
    if (currentMachineId !== licenseData.payload.machineId) {
      return {
        valid: false,
        status: 'machine_mismatch',
        error: `This license is not valid for this machine.\nYour Machine ID: ${currentMachineId}`,
      };
    }

    // Step 5: Verify signature before saving
    const isSignatureValid = verifySignature(licenseData.payload, licenseData.signature);

    if (!isSignatureValid) {
      return {
        valid: false,
        status: 'invalid',
        error: 'License signature verification failed. The license may have been tampered with.',
      };
    }

    // Step 6: Check expiration
    if (isExpired(licenseData.payload.expiresAt)) {
      return {
        valid: false,
        status: 'expired',
        payload: licenseData.payload,
        error: 'This license has expired. Please contact support for a new license.',
        expiresAt: licenseData.payload.expiresAt,
      };
    }

    // Step 7: Save license to disk
    const saved = writeLicenseFile(licenseData);

    if (!saved) {
      return {
        valid: false,
        status: 'invalid',
        error: 'Failed to save license file. Please check write permissions.',
      };
    }

    console.log('[LicenseValidator] License activated successfully');

    return {
      valid: true,
      status: 'valid',
      payload: licenseData.payload,
      expiresAt: licenseData.payload.expiresAt,
      daysRemaining: calculateDaysRemaining(licenseData.payload.expiresAt),
    };
  } catch (error) {
    console.error('[LicenseValidator] License activation failed:', error);
    return {
      valid: false,
      status: 'invalid',
      error: 'An unexpected error occurred during license activation.',
    };
  }
}

/**
 * Deactivate license (delete the license file)
 */
export function deactivateLicense(): boolean {
  deleteLicenseFile();
  return true;
}

/**
 * Get current machine ID for display in activation UI
 */
export async function getMachineId(): Promise<string | null> {
  return generateMachineId();
}
