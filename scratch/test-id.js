const { exec } = require('child_process');
const { promisify } = require('util');
const { createHash } = require('crypto');
const { platform } = require('os');

const execAsync = promisify(exec);
const STATIC_SALT = '5ch00lF0undry_L1c3ns3_S4lt_2024!';

function sha256Hex(input) {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

async function getMotherboardUuid() {
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
    console.warn('[MachineID] wmic failed to get motherboard UUID, trying PowerShell...');
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
    console.warn('[MachineID] PowerShell Get-CimInstance failed, trying Get-WmiObject...');
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

async function getCpuProcessorId() {
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
    console.warn('[MachineID] wmic failed to get CPU ID, trying PowerShell...');
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
    console.warn('[MachineID] PowerShell Get-CimInstance failed, trying Get-WmiObject...');
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

async function run() {
  console.log('Detecting motherboard UUID...');
  const uuid = await getMotherboardUuid();
  console.log('Motherboard UUID:', uuid);

  console.log('Detecting CPU Processor ID...');
  const cpu = await getCpuProcessorId();
  console.log('CPU ID:', cpu);

  if (uuid && cpu) {
    const fingerprint = `${uuid}|${cpu}|${STATIC_SALT}`;
    const machineId = sha256Hex(fingerprint);
    console.log('SUCCESS! Generated Machine ID:', machineId);
  } else {
    console.error('FAILED to extract necessary hardware identifiers.');
  }
}

run();
