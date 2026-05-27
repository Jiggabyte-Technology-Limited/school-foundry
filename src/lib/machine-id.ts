import { exec } from 'child_process';
import { promisify } from 'util';
import { createHash } from 'crypto';
import { platform } from 'os';

const execAsync = promisify(exec);

// Static salt for hardware fingerprint hashing
// This prevents rainbow table attacks on the machine ID
const STATIC_SALT = '5ch00lF0undry_L1c3ns3_S4lt_2024!';

/**
 * Extract motherboard UUID using wmic or PowerShell (Windows only)
 * Returns null if not on Windows or if extraction fails
 */
async function getMotherboardUuid(): Promise<string | null> {
  if (platform() !== 'win32') {
    console.warn('[MachineID] Non-Windows platform detected, returning null UUID');
    return null;
  }

  // 1. Try wmic first
  try {
    const { stdout } = await execAsync('wmic csproduct get UUID', {
      timeout: 5000,
      windowsHide: true,
    });

    const lines = stdout.trim().split('\n');
    if (lines.length >= 2) {
      const uuid = lines[1].trim();
      if (uuid && uuid !== 'FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF') {
        return uuid;
      }
    }
  } catch (error) {
    console.warn('[MachineID] wmic failed to get motherboard UUID, trying PowerShell...', error);
  }

  // 2. Try PowerShell Get-CimInstance
  try {
    const { stdout } = await execAsync(
      'powershell -ExecutionPolicy Bypass -Command "(Get-CimInstance Win32_ComputerSystemProduct).UUID"',
      {
        timeout: 5000,
        windowsHide: true,
      }
    );
    const uuid = stdout.trim();
    if (uuid && uuid !== 'FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF' && uuid.length > 0) {
      return uuid;
    }
  } catch (error) {
    console.warn('[MachineID] PowerShell Get-CimInstance failed, trying Get-WmiObject...', error);
  }

  // 3. Try PowerShell Get-WmiObject
  try {
    const { stdout } = await execAsync(
      'powershell -ExecutionPolicy Bypass -Command "(Get-WmiObject Win32_ComputerSystemProduct).UUID"',
      {
        timeout: 5000,
        windowsHide: true,
      }
    );
    const uuid = stdout.trim();
    if (uuid && uuid !== 'FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF' && uuid.length > 0) {
      return uuid;
    }
  } catch (error) {
    console.error('[MachineID] All motherboard UUID extraction methods failed:', error);
  }

  return null;
}

/**
 * Extract CPU Processor ID using wmic or PowerShell (Windows only)
 * Returns null if not on Windows or if extraction fails
 */
async function getCpuProcessorId(): Promise<string | null> {
  if (platform() !== 'win32') {
    console.warn('[MachineID] Non-Windows platform detected, returning null CPU ID');
    return null;
  }

  // 1. Try wmic first
  try {
    const { stdout } = await execAsync('wmic cpu get ProcessorId', {
      timeout: 5000,
      windowsHide: true,
    });

    const lines = stdout.trim().split('\n');
    if (lines.length >= 2) {
      const processorId = lines[1].trim();
      if (processorId && processorId.length > 0) {
        return processorId;
      }
    }
  } catch (error) {
    console.warn('[MachineID] wmic failed to get CPU ID, trying PowerShell...', error);
  }

  // 2. Try PowerShell Get-CimInstance
  try {
    const { stdout } = await execAsync(
      'powershell -ExecutionPolicy Bypass -Command "(Get-CimInstance Win32_Processor).ProcessorId"',
      {
        timeout: 5000,
        windowsHide: true,
      }
    );
    const processorId = stdout.trim();
    if (processorId && processorId.length > 0) {
      return processorId;
    }
  } catch (error) {
    console.warn('[MachineID] PowerShell Get-CimInstance failed, trying Get-WmiObject...', error);
  }

  // 3. Try PowerShell Get-WmiObject
  try {
    const { stdout } = await execAsync(
      'powershell -ExecutionPolicy Bypass -Command "(Get-WmiObject Win32_Processor).ProcessorId"',
      {
        timeout: 5000,
        windowsHide: true,
      }
    );
    const processorId = stdout.trim();
    if (processorId && processorId.length > 0) {
      return processorId;
    }
  } catch (error) {
    console.error('[MachineID] All CPU ID extraction methods failed:', error);
  }

  return null;
}

/**
 * Generate SHA-256 hash of input string
 * Returns 64-character lowercase hex string
 */
function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Generate a unique machine ID based on hardware fingerprint
 *
 * Algorithm:
 * 1. Extract motherboard UUID via wmic csproduct get UUID
 * 2. Extract CPU Processor ID via wmic cpu get ProcessorId
 * 3. Concatenate: UUID + CPU_ID + STATIC_SALT
 * 4. Hash with SHA-256 to produce 64-character hex MachineID
 *
 * Returns null if hardware extraction fails (non-Windows or wmic unavailable)
 */
export async function generateMachineId(): Promise<string | null> {
  const [motherboardUuid, cpuProcessorId] = await Promise.all([
    getMotherboardUuid(),
    getCpuProcessorId(),
  ]);

  if (!motherboardUuid || !cpuProcessorId) {
    console.error(
      '[MachineID] Failed to extract hardware identifiers:',
      'UUID:',
      motherboardUuid,
      'CPU:',
      cpuProcessorId
    );
    return null;
  }

  // Concatenate components with static salt
  const fingerprint = `${motherboardUuid}|${cpuProcessorId}|${STATIC_SALT}`;

  // Generate SHA-256 hash (64-character hex)
  const machineId = sha256Hex(fingerprint);

  console.log('[MachineID] Generated Machine ID:', machineId);
  return machineId;
}

/**
 * Validate that a machine ID matches the current hardware
 * Used for license verification
 */
export async function validateMachineId(expectedMachineId: string): Promise<boolean> {
  const currentMachineId = await generateMachineId();
  if (!currentMachineId) {
    return false;
  }
  return currentMachineId === expectedMachineId;
}
