import * as http from 'http';
import { getOrCreateNodeIdentity } from './node-identity';
import { getDeltasSince, applyRemoteDeltas, SyncDelta } from './sync-engine';
import { udpBeacon, DEFAULT_SYNC_PORT } from './udp-beacon';

export interface SyncResult {
  success: boolean;
  localApplied: number;
  remoteApplied: number;
  error?: string;
}

class SyncServerService {
  private server: http.Server | null = null;
  private port: number = DEFAULT_SYNC_PORT;
  private isRunning: boolean = false;

  public getPort(): number {
    return this.port;
  }

  public async start(): Promise<number> {
    if (this.isRunning && this.server) {
      return this.port;
    }

    return new Promise((resolve, reject) => {
      this.server = http.createServer(async (req, res) => {
        // Set CORS headers so local requests are never blocked
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.writeHead(200);
          res.end();
          return;
        }

        const url = req.url || '/';

        try {
          if (req.method === 'GET' && url === '/api/sync/info') {
            const identity = await getOrCreateNodeIdentity();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                app: 'school-foundry-peer',
                version: '1.0',
                nodeId: identity.nodeId,
                deviceName: identity.deviceName,
                schoolName: identity.schoolName,
                receiptPrefix: identity.receiptPrefix,
                timestamp: new Date().toISOString(),
              })
            );
            return;
          }

          if (req.method === 'POST' && url === '/api/sync/pull') {
            let body = '';
            req.on('data', chunk => (body += chunk));
            req.on('end', async () => {
              try {
                const parsed = body ? JSON.parse(body) : {};
                const since = parsed.since || '1970-01-01T00:00:00.000Z';
                const deltas = await getDeltasSince(since);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, deltas }));
              } catch (err: any) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: err.message }));
              }
            });
            return;
          }

          if (req.method === 'POST' && url === '/api/sync/push') {
            let body = '';
            req.on('data', chunk => (body += chunk));
            req.on('end', async () => {
              try {
                const parsed = JSON.parse(body);
                const deltas: SyncDelta[] = parsed.deltas || [];
                const result = await applyRemoteDeltas(deltas);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, ...result }));
              } catch (err: any) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: err.message }));
              }
            });
            return;
          }

          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Not found' }));
        } catch (err: any) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });

      const tryListen = (attemptPort: number) => {
        this.server?.listen(attemptPort, '0.0.0.0', () => {
          this.port = attemptPort;
          this.isRunning = true;
          udpBeacon.setSyncPort(attemptPort);
          console.log(`[SyncServer] HTTP sync server listening on port ${attemptPort}`);
          resolve(attemptPort);
        });

        this.server?.on('error', (err: any) => {
          if (err.code === 'EADDRINUSE' && attemptPort < DEFAULT_SYNC_PORT + 10) {
            console.log(`[SyncServer] Port ${attemptPort} busy, trying ${attemptPort + 1}`);
            tryListen(attemptPort + 1);
          } else {
            console.error('[SyncServer] Server listen error:', err);
            reject(err);
          }
        });
      };

      tryListen(DEFAULT_SYNC_PORT);
    });
  }

  public stop() {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
    this.isRunning = false;
  }
}

export const syncServer = new SyncServerService();

/**
 * Perform a full bi-directional sync cycle with a peer terminal.
 */
export async function syncWithPeerNode(peerIp: string, peerPort: number): Promise<SyncResult> {
  const baseUrl = `http://${peerIp}:${peerPort}`;

  try {
    // 1. Fetch info from remote peer
    const infoRes = await fetch(`${baseUrl}/api/sync/info`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });

    if (!infoRes.ok) {
      throw new Error(`Peer handshake failed with status ${infoRes.status}`);
    }

    // 2. Fetch local changes since beginning of time and push to remote
    const localDeltas = await getDeltasSince('1970-01-01T00:00:00.000Z');
    let remoteApplied = 0;

    if (localDeltas.length > 0) {
      const pushRes = await fetch(`${baseUrl}/api/sync/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deltas: localDeltas }),
        signal: AbortSignal.timeout(10000),
      });

      if (pushRes.ok) {
        const pushData = await pushRes.json();
        remoteApplied = pushData.applied || 0;
      }
    }

    // 3. Pull remote changes and apply locally
    const pullRes = await fetch(`${baseUrl}/api/sync/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ since: '1970-01-01T00:00:00.000Z' }),
      signal: AbortSignal.timeout(10000),
    });

    let localApplied = 0;
    if (pullRes.ok) {
      const pullData = await pullRes.json();
      if (pullData.deltas && Array.isArray(pullData.deltas)) {
        const applyResult = await applyRemoteDeltas(pullData.deltas);
        localApplied = applyResult.applied;
      }
    }

    return {
      success: true,
      localApplied,
      remoteApplied,
    };
  } catch (err: any) {
    console.error(`[SyncClient] Error syncing with ${peerIp}:${peerPort}:`, err);
    return {
      success: false,
      localApplied: 0,
      remoteApplied: 0,
      error: err.message,
    };
  }
}
