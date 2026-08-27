import * as crypto from 'crypto';
import * as os from 'os';
import db from '../db/init';

export interface NodeIdentity {
  nodeId: string;
  deviceName: string;
  receiptPrefix: string;
  schoolName: string;
}

let cachedIdentity: NodeIdentity | null = null;

function runQuery<T>(sql: string, params: any[] = []): Promise<T | null> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve((row as T) || null);
    });
  });
}

function runExec(sql: string, params: any[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, err => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/**
 * Initialize or fetch this device's persistent local node identity.
 */
export async function getOrCreateNodeIdentity(): Promise<NodeIdentity> {
  if (cachedIdentity) {
    return cachedIdentity;
  }

  try {
    const nodeRow = await runQuery<{ value: string }>(
      "SELECT value FROM app_settings WHERE key = 'local_node_id'"
    );
    let nodeId = nodeRow?.value;

    if (!nodeId) {
      nodeId = `node_${crypto.randomBytes(6).toString('hex')}`;
      await runExec(
        "INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES ('local_node_id', ?, datetime('now'))",
        [nodeId]
      );
    }

    const deviceNameRow = await runQuery<{ value: string }>(
      "SELECT value FROM app_settings WHERE key = 'device_name'"
    );
    let deviceName = deviceNameRow?.value;

    if (!deviceName) {
      const hostname = os.hostname() || 'Terminal';
      deviceName = `Bursar (${hostname})`;
      await runExec(
        "INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES ('device_name', ?, datetime('now'))",
        [deviceName]
      );
    }

    const prefixRow = await runQuery<{ value: string }>(
      "SELECT value FROM app_settings WHERE key = 'receipt_node_prefix'"
    );
    let receiptPrefix = prefixRow?.value;

    if (!receiptPrefix) {
      // Pick a clean 2-character uppercase prefix from nodeId
      receiptPrefix = nodeId.slice(-2).toUpperCase();
      await runExec(
        "INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES ('receipt_node_prefix', ?, datetime('now'))",
        [receiptPrefix]
      );
    }

    const schoolRow = await runQuery<{ value: string }>(
      "SELECT value FROM app_settings WHERE key = 'school_name'"
    );
    const schoolName = schoolRow?.value || 'School Foundry';

    cachedIdentity = {
      nodeId,
      deviceName,
      receiptPrefix,
      schoolName,
    };

    return cachedIdentity;
  } catch (err) {
    console.error('[NodeIdentity] Error retrieving node identity:', err);
    return {
      nodeId: 'node_fallback',
      deviceName: 'Bursar Terminal',
      receiptPrefix: 'SF',
      schoolName: 'School Foundry',
    };
  }
}

/**
 * Update the friendly name of this device.
 */
export async function updateDeviceName(newName: string): Promise<void> {
  const cleanName = newName.trim() || 'Bursar Terminal';
  await runExec(
    "INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES ('device_name', ?, datetime('now'))",
    [cleanName]
  );
  if (cachedIdentity) {
    cachedIdentity.deviceName = cleanName;
  }
}
