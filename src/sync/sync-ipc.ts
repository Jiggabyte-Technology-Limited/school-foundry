import { ipcMain, BrowserWindow } from 'electron';
import { getOrCreateNodeIdentity, updateDeviceName } from './node-identity';
import { udpBeacon, DiscoveredPeer } from './udp-beacon';
import { syncServer, syncWithPeerNode, SyncResult } from './sync-server';

export function setupSyncIpcHandlers(getMainWindow?: () => BrowserWindow | null): void {
  console.log('[SyncIPC] Setting up Local Hotspot & LAN Sync IPC handlers...');

  // Start beacon and sync HTTP server
  syncServer.start().then(port => {
    udpBeacon.setSyncPort(port);
    udpBeacon.start();
  });

  // Notify renderer whenever peers are discovered or updated
  udpBeacon.onPeersChanged((peers: DiscoveredPeer[]) => {
    const wins = BrowserWindow.getAllWindows();
    for (const win of wins) {
      if (!win.isDestroyed()) {
        win.webContents.send('sync-peers-updated', peers);
      }
    }
  });

  ipcMain.handle('sync-get-identity', async () => {
    try {
      const identity = await getOrCreateNodeIdentity();
      return { success: true, identity, syncPort: syncServer.getPort() };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('sync-update-device-name', async (_event, newName: string) => {
    try {
      await updateDeviceName(newName);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('sync-get-peers', async () => {
    try {
      const peers = udpBeacon.getPeers();
      return { success: true, peers };
    } catch (err: any) {
      return { success: false, error: err.message, peers: [] };
    }
  });

  ipcMain.handle('sync-with-peer', async (_event, peerIp: string, peerPort: number): Promise<SyncResult> => {
    try {
      const result = await syncWithPeerNode(peerIp, peerPort);
      return result;
    } catch (err: any) {
      return { success: false, localApplied: 0, remoteApplied: 0, error: err.message };
    }
  });

  ipcMain.handle('sync-all-peers', async () => {
    const peers = udpBeacon.getPeers();
    const results: { peer: DiscoveredPeer; result: SyncResult }[] = [];

    for (const peer of peers) {
      if (peer.status === 'online') {
        const res = await syncWithPeerNode(peer.ipAddress, peer.syncPort);
        results.push({ peer, result: res });
      }
    }

    return { success: true, results };
  });

  console.log('[SyncIPC] Local Sync IPC handlers initialized');
}
