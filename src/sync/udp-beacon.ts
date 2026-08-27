import * as dgram from 'dgram';
import * as os from 'os';
import { getOrCreateNodeIdentity } from './node-identity';

export interface DiscoveredPeer {
  nodeId: string;
  deviceName: string;
  schoolName: string;
  ipAddress: string;
  syncPort: number;
  lastSeen: number;
  status: 'online' | 'stale';
}

export const UDP_PORT = 51741;
export const DEFAULT_SYNC_PORT = 51740;

type PeerListener = (peers: DiscoveredPeer[]) => void;

class UdpBeaconService {
  private socket: dgram.Socket | null = null;
  private broadcastInterval: NodeJS.Timeout | null = null;
  private pruneInterval: NodeJS.Timeout | null = null;
  private peers: Map<string, DiscoveredPeer> = new Map();
  private listeners: Set<PeerListener> = new Set();
  private syncPort = DEFAULT_SYNC_PORT;
  private isRunning = false;

  public setSyncPort(port: number) {
    this.syncPort = port;
  }

  public getPeers(): DiscoveredPeer[] {
    return Array.from(this.peers.values());
  }

  public onPeersChanged(listener: PeerListener): () => void {
    this.listeners.add(listener);
    // Immediately emit current peers
    listener(this.getPeers());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    const list = this.getPeers();
    for (const listener of this.listeners) {
      try {
        listener(list);
      } catch (err) {
        console.error('[UdpBeacon] Listener error:', err);
      }
    }
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    const identity = await getOrCreateNodeIdentity();

    try {
      this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

      this.socket.on('error', err => {
        console.warn('[UdpBeacon] Socket error:', err.message);
      });

      this.socket.on('message', (msg, rinfo) => {
        try {
          const data = JSON.parse(msg.toString('utf8'));
          if (data.app === 'school-foundry-peer' && data.nodeId && data.nodeId !== identity.nodeId) {
            const peerKey = data.nodeId;
            const updated: DiscoveredPeer = {
              nodeId: data.nodeId,
              deviceName: data.deviceName || 'Peer Terminal',
              schoolName: data.schoolName || '',
              ipAddress: rinfo.address,
              syncPort: data.syncPort || DEFAULT_SYNC_PORT,
              lastSeen: Date.now(),
              status: 'online',
            };

            const existing = this.peers.get(peerKey);
            const isNew = !existing;
            this.peers.set(peerKey, updated);

            if (isNew || existing.deviceName !== updated.deviceName) {
              console.log(`[UdpBeacon] Discovered peer: ${updated.deviceName} (${rinfo.address}:${updated.syncPort})`);
              this.notifyListeners();
            }
          }
        } catch (e) {
          // Ignore invalid non-JSON UDP packets
        }
      });

      this.socket.bind(UDP_PORT, () => {
        if (!this.socket) return;
        try {
          this.socket.setBroadcast(true);
          console.log(`[UdpBeacon] Listening on UDP port ${UDP_PORT}`);
        } catch (e) {
          console.warn('[UdpBeacon] Failed to setBroadcast:', e);
        }
      });

      // Broadcast beacon every 3 seconds
      this.broadcastInterval = setInterval(() => {
        this.sendBeacon();
      }, 3000);

      // Prune inactive peers every 5 seconds (prune if > 10 seconds inactive)
      this.pruneInterval = setInterval(() => {
        this.pruneStalePeers();
      }, 5000);

      // Send initial beacon
      this.sendBeacon();
    } catch (err) {
      console.error('[UdpBeacon] Failed to start UDP beacon:', err);
    }
  }

  private async sendBeacon() {
    if (!this.socket) return;
    try {
      const identity = await getOrCreateNodeIdentity();
      const payload = Buffer.from(
        JSON.stringify({
          app: 'school-foundry-peer',
          version: '1.0',
          nodeId: identity.nodeId,
          deviceName: identity.deviceName,
          schoolName: identity.schoolName,
          syncPort: this.syncPort,
          timestamp: Date.now(),
        }),
        'utf8'
      );

      // Broadcast to standard broadcast address
      this.socket.send(payload, 0, payload.length, UDP_PORT, '255.255.255.255', err => {
        if (err && (err as any).code !== 'ENETUNREACH') {
          // ignore common unreachable errors if offline without interface
        }
      });

      // Also broadcast to each active network interface's broadcast address (especially hotspot 192.168.137.255)
      const interfaces = os.networkInterfaces();
      for (const name of Object.keys(interfaces)) {
        const netList = interfaces[name];
        if (!netList) continue;
        for (const net of netList) {
          if (net.family === 'IPv4' && !net.internal) {
            // Generate subnet broadcast address (e.g. 192.168.137.255)
            const parts = net.address.split('.');
            if (parts.length === 4) {
              const broadcast = `${parts[0]}.${parts[1]}.${parts[2]}.255`;
              this.socket.send(payload, 0, payload.length, UDP_PORT, broadcast, () => {});
            }
          }
        }
      }
    } catch (err) {
      // ignore transient broadcast errors
    }
  }

  private pruneStalePeers() {
    const now = Date.now();
    let changed = false;

    for (const [nodeId, peer] of this.peers.entries()) {
      if (now - peer.lastSeen > 12000) {
        this.peers.delete(nodeId);
        changed = true;
        console.log(`[UdpBeacon] Peer disconnected/timed out: ${peer.deviceName} (${nodeId})`);
      } else if (now - peer.lastSeen > 7000 && peer.status === 'online') {
        peer.status = 'stale';
        changed = true;
      }
    }

    if (changed) {
      this.notifyListeners();
    }
  }

  public stop() {
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
      this.broadcastInterval = null;
    }
    if (this.pruneInterval) {
      clearInterval(this.pruneInterval);
      this.pruneInterval = null;
    }
    if (this.socket) {
      try {
        this.socket.close();
      } catch (e) {}
      this.socket = null;
    }
    this.peers.clear();
    this.isRunning = false;
  }
}

export const udpBeacon = new UdpBeaconService();
