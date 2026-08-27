import React, { useState, useEffect } from 'react';
import { useToast } from '../Toast';
import { DiscoveredPeer, NodeIdentityInfo, SyncOperationResult } from '../../declarations';

export const LocalSyncIndicator: React.FC = () => {
  const { showToast } = useToast();
  const [peers, setPeers] = useState<DiscoveredPeer[]>([]);
  const [identity, setIdentity] = useState<NodeIdentityInfo | null>(null);
  const [syncPort, setSyncPort] = useState<number>(51740);
  const [isOpen, setIsOpen] = useState(false);
  const [syncingPeerId, setSyncingPeerId] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [deviceNameInput, setDeviceNameInput] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  useEffect(() => {
    loadIdentity();
    loadPeers();

    if (window.api && window.api.onPeersUpdated) {
      const unsubscribe = window.api.onPeersUpdated((updatedPeers: DiscoveredPeer[]) => {
        setPeers(updatedPeers);
      });
      return () => unsubscribe();
    }
  }, []);

  const loadIdentity = async () => {
    try {
      const res = await window.api.syncGetIdentity();
      if (res.success && res.identity) {
        setIdentity(res.identity);
        setDeviceNameInput(res.identity.deviceName);
        if (res.syncPort) setSyncPort(res.syncPort);
      }
    } catch (err) {
      console.error('Failed to load sync identity:', err);
    }
  };

  const loadPeers = async () => {
    try {
      const res = await window.api.syncGetPeers();
      if (res.success && res.peers) {
        setPeers(res.peers);
      }
    } catch (err) {
      console.error('Failed to load peers:', err);
    }
  };

  const handleSaveDeviceName = async () => {
    if (!deviceNameInput.trim()) return;
    setIsSavingName(true);
    try {
      const res = await window.api.syncUpdateDeviceName(deviceNameInput.trim());
      if (res.success) {
        showToast('success', 'Device Name Updated', `This terminal is now named "${deviceNameInput.trim()}"`);
        loadIdentity();
      }
    } catch (err) {
      showToast('error', 'Failed to update device name');
    } finally {
      setIsSavingName(false);
    }
  };

  const handleSyncWithPeer = async (peer: DiscoveredPeer) => {
    setSyncingPeerId(peer.nodeId);
    try {
      const res: SyncOperationResult = await window.api.syncWithPeer(peer.ipAddress, peer.syncPort);
      if (res.success) {
        showToast('success', `Synced with ${peer.deviceName}`, `Received ${res.localApplied} records, sent ${res.remoteApplied} records.`);
        setLastSyncTime(new Date().toLocaleTimeString());
      } else {
        showToast('error', 'Sync Failed', res.error || 'Connection refused');
      }
    } catch (err: any) {
      showToast('error', 'Sync Error', err.message);
    } finally {
      setSyncingPeerId(null);
    }
  };

  const handleSyncAll = async () => {
    setSyncingAll(true);
    try {
      const res = await window.api.syncAllPeers();
      if (res.success) {
        let totalLocal = 0;
        let totalRemote = 0;
        for (const item of res.results) {
          if (item.result.success) {
            totalLocal += item.result.localApplied;
            totalRemote += item.result.remoteApplied;
          }
        }
        showToast('success', 'All Terminals Synchronized', `Synchronized with ${res.results.length} peers (+${totalLocal} records received).`);
        setLastSyncTime(new Date().toLocaleTimeString());
      }
    } catch (err: any) {
      showToast('error', 'Sync Error', err.message);
    } finally {
      setSyncingAll(false);
    }
  };

  const onlinePeers = peers.filter(p => p.status === 'online');

  return (
    <>
      {/* TopBar Status Pill */}
      <button
        onClick={() => setIsOpen(true)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          borderRadius: '9999px',
          border: '1px solid var(--border)',
          backgroundColor: onlinePeers.length > 0 ? 'rgba(16, 185, 129, 0.1)' : 'var(--surface)',
          color: onlinePeers.length > 0 ? '#059669' : 'var(--text-secondary)',
          fontSize: '12px',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
        title="Local Hotspot & Multi-Device Sync"
      >
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: onlinePeers.length > 0 ? '#10b981' : '#9ca3af',
            boxShadow: onlinePeers.length > 0 ? '0 0 8px #10b981' : 'none',
            display: 'inline-block',
          }}
        />
        {onlinePeers.length > 0 ? (
          <span>
            Hotspot Sync: <strong>{onlinePeers.length} {onlinePeers.length === 1 ? 'Peer' : 'Peers'}</strong>
          </span>
        ) : (
          <span>Standalone (Offline)</span>
        )}
      </button>

      {/* Modal Details / Sync Manager */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--surface)',
              color: 'var(--text-primary)',
              borderRadius: '16px',
              border: '1px solid var(--border)',
              width: '100%',
              maxWidth: '650px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>
                  📡 Local Hotspot & Multi-Device Sync
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Zero-internet synchronization across multiple laptops over Wi-Fi or Windows Hotspot.
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* This Device Card */}
              <div
                style={{
                  backgroundColor: 'var(--background)',
                  padding: '16px',
                  borderRadius: '12px',
                  border: '1px solid var(--border)',
                }}
              >
                <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  This Terminal Identity
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    value={deviceNameInput}
                    onChange={e => setDeviceNameInput(e.target.value)}
                    placeholder="e.g. Bursar Laptop 1"
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      backgroundColor: 'var(--surface)',
                      color: 'var(--text-primary)',
                      fontWeight: 600,
                    }}
                  />
                  <button
                    onClick={handleSaveDeviceName}
                    disabled={isSavingName}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: 'var(--primary)',
                      color: 'white',
                      borderRadius: '8px',
                      fontWeight: 600,
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    Rename
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '16px', marginTop: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <div>Node ID: <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{identity?.nodeId || 'Loading...'}</strong></div>
                  <div>Receipt Prefix: <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{identity?.receiptPrefix}</strong></div>
                  <div>Port: <strong style={{ color: 'var(--text-primary)' }}>{syncPort}</strong></div>
                </div>
              </div>

              {/* Discovered Peers Section */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700 }}>
                    Discovered Peers on Local Network ({onlinePeers.length})
                  </div>
                  {onlinePeers.length > 0 && (
                    <button
                      onClick={handleSyncAll}
                      disabled={syncingAll}
                      style={{
                        padding: '6px 14px',
                        backgroundColor: '#10b981',
                        color: 'white',
                        borderRadius: '6px',
                        fontWeight: 700,
                        fontSize: '12px',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      {syncingAll ? '🔄 Syncing All...' : '🔄 Sync All Now'}
                    </button>
                  )}
                </div>

                {onlinePeers.length === 0 ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '24px',
                      border: '1px dashed var(--border)',
                      borderRadius: '12px',
                      color: 'var(--text-secondary)',
                      fontSize: '13px',
                    }}
                  >
                    <div style={{ fontSize: '24px', marginBottom: '8px' }}>📡</div>
                    <div>Scanning local network for other School Foundry terminals...</div>
                    <div style={{ marginTop: '8px', fontSize: '12px', color: '#f59e0b' }}>
                      💡 Make sure all laptops are connected to the same Wi-Fi router or Windows Mobile Hotspot.
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {onlinePeers.map(peer => (
                      <div
                        key={peer.nodeId}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '12px 16px',
                          borderRadius: '8px',
                          border: '1px solid var(--border)',
                          backgroundColor: 'var(--background)',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '14px' }}>
                            💻 {peer.deviceName}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            IP: {peer.ipAddress}:{peer.syncPort} • School: {peer.schoolName || 'School Foundry'}
                          </div>
                        </div>

                        <button
                          onClick={() => handleSyncWithPeer(peer)}
                          disabled={syncingPeerId === peer.nodeId}
                          style={{
                            padding: '8px 16px',
                            backgroundColor: 'var(--primary)',
                            color: 'white',
                            borderRadius: '8px',
                            fontWeight: 700,
                            fontSize: '12px',
                            border: 'none',
                            cursor: 'pointer',
                          }}
                        >
                          {syncingPeerId === peer.nodeId ? '🔄 Syncing...' : 'Sync Now'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {lastSyncTime && (
                <div style={{ fontSize: '12px', color: '#10b981', textAlign: 'center', fontWeight: 600 }}>
                  ✓ Last synchronized at {lastSyncTime}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '16px 24px',
                borderTop: '1px solid var(--border)',
                backgroundColor: 'var(--background)',
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  padding: '8px 20px',
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
