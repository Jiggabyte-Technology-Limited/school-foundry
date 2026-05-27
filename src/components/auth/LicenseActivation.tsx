import React, { useState, useEffect } from 'react';
import SphereCanvas from '../SphereCanvas';
import { FeatureCards } from '../FeatureCards';

interface LicenseActivationProps {
  onActivated: () => void;
}

interface LicenseResult {
  valid: boolean;
  status: string;
  error?: string;
  expiresAt?: string;
  daysRemaining?: number;
}

export function LicenseActivation({ onActivated }: LicenseActivationProps) {
  const [machineId, setMachineId] = useState<string>('');
  const [licenseKey, setLicenseKey] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingMachineId, setLoadingMachineId] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  // Load machine ID on mount
  useEffect(() => {
    const loadMachineId = async () => {
      try {
        const id = await window.api.getMachineId();
        if (id) {
          setMachineId(id);
        } else {
          setError('Failed to generate Machine ID. Please ensure you are running on Windows.');
        }
      } catch (err) {
        console.error('Failed to get machine ID:', err);
        setError('Failed to generate Machine ID.');
      } finally {
        setLoadingMachineId(false);
      }
    };

    loadMachineId();
  }, []);

  const copyMachineId = async () => {
    try {
      await navigator.clipboard.writeText(machineId);
      setSuccess('Machine ID copied to clipboard!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!licenseKey.trim()) {
      setError('Please enter your license key.');
      return;
    }

    setLoading(true);

    try {
      const result: LicenseResult = await window.api.activateLicense(licenseKey.trim());

      if (result.valid) {
        const msg = result.expiresAt
          ? `License activated successfully! Valid until ${result.expiresAt}.`
          : 'License activated successfully! (Perpetual license)';
        setSuccess(msg);
        setTimeout(() => {
          onActivated();
        }, 1500);
      } else {
        setError(result.error || 'License activation failed. Please check your license key.');
        setLicenseKey('');
      }
    } catch (err) {
      console.error('Activation error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--background)',
        color: 'var(--text-primary)',
        display: 'flex',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background Decorative Elements */}
      <div
        style={{
          position: 'absolute',
          right: '-5%',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '800px',
          height: '800px',
          background: 'radial-gradient(circle, rgba(249,115,22,0.06), transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '-5%',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(20,184,166,0.04), transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '0 60px',
          width: '100%',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '80px' }}
        >
          {/* Left Column - Activation Form */}
          <div
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}
          >
            <div style={{ width: '100%', maxWidth: '420px', textAlign: 'left' }}>
              {/* Header */}
              <div style={{ marginBottom: '32px' }}>
                <img
                  src="./img/schoolfoundry-logo.svg"
                  alt="SchoolFoundry"
                  style={{
                    width: 'auto',
                    height: '56px',
                    maxHeight: '56px',
                    marginBottom: '16px',
                    borderRadius: '12px',
                    objectFit: 'contain',
                  }}
                />
                <h2
                  style={{
                    fontSize: '28px',
                    fontWeight: 800,
                    margin: 0,
                    color: 'var(--text-primary)',
                    lineHeight: 1.2,
                  }}
                >
                  Activate Application
                </h2>
                <p style={{ color: 'var(--text-secondary)', marginTop: '12px', fontSize: '14px' }}>
                  <span style={{ fontWeight: 700 }}>Fees</span>
                  <span style={{ fontWeight: 400 }}>Foundry</span> School Fees Manager
                </p>
                <p
                  style={{
                    color: 'var(--text-secondary)',
                    marginTop: '16px',
                    fontSize: '13px',
                    lineHeight: 1.5,
                  }}
                >
                  Enter your license key below to activate the system. If you do not have a license, send the Machine ID below to FeesFoundry support.
                </p>
              </div>

              {/* Machine ID Section */}
              <div style={{ marginBottom: '20px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 600,
                    marginBottom: '8px',
                    color: 'var(--text-secondary)',
                  }}
                >
                  YOUR MACHINE ID
                </label>
                {loadingMachineId ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '14px 16px',
                      backgroundColor: 'var(--surface)',
                      border: '2px dashed var(--border)',
                      borderRadius: '12px',
                      fontSize: '14px',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <div className="animate-spin w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full" />
                    <span>Generating Machine ID...</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div
                      style={{
                        flex: 1,
                        padding: '14px 16px',
                        backgroundColor: 'var(--secondary)',
                        border: '2px solid var(--border)',
                        borderRadius: '12px',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '13px',
                        color: 'var(--color-accent-teal)',
                        wordBreak: 'break-all',
                      }}
                    >
                      {machineId || 'Unable to generate Machine ID'}
                    </div>
                    <button
                      type="button"
                      onClick={copyMachineId}
                      disabled={!machineId}
                      style={{
                        flexShrink: 0,
                        padding: '12px 16px',
                        backgroundColor: 'var(--surface)',
                        border: '2px solid var(--border)',
                        borderRadius: '12px',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'background-color 0.2s',
                      }}
                      onMouseOver={e => (e.currentTarget.style.backgroundColor = 'var(--secondary)')}
                      onMouseOut={e => (e.currentTarget.style.backgroundColor = 'var(--surface)')}
                      title="Copy Machine ID"
                    >
                      <svg
                        width="18"
                        height="18"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                    </button>
                  </div>
                )}
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                  Send this Machine ID to support to get your license key via WhatsApp or SMS.
                </p>
              </div>

              {/* License Key Form */}
              <form onSubmit={handleActivate}>
                <div style={{ marginBottom: '24px' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 600,
                      marginBottom: '8px',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    LICENSE KEY
                  </label>
                  <textarea
                    value={licenseKey}
                    onChange={e => setLicenseKey(e.target.value)}
                    placeholder="Paste your license key here..."
                    disabled={loading}
                    required
                    style={{
                      width: '100%',
                      height: '110px',
                      padding: '14px 16px',
                      borderRadius: '12px',
                      border: '2px solid var(--border)',
                      fontSize: '14px',
                      fontFamily: 'var(--font-mono)',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                      boxSizing: 'border-box',
                      backgroundColor: 'var(--surface)',
                      resize: 'none',
                    }}
                    onFocus={e => (e.target.style.borderColor = 'var(--primary)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                  />
                </div>

                {error && (
                  <div className="error-message mb-4" style={{ marginBottom: '16px' }}>
                    {error}
                  </div>
                )}

                {success && (
                  <div
                    style={{
                      color: '#059669',
                      backgroundColor: '#d1fae5',
                      padding: '0.75rem',
                      borderRadius: '8px',
                      fontSize: '0.9rem',
                      fontWeight: 500,
                      border: '1px solid #10b981',
                      marginBottom: '16px',
                    }}
                  >
                    {success}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !licenseKey.trim() || loadingMachineId}
                  style={{
                    width: '100%',
                    padding: '16px',
                    borderRadius: '12px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                    color: 'white',
                    fontSize: '16px',
                    fontWeight: 700,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.7 : 1,
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    boxShadow: '0 4px 14px rgba(249, 115, 22, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                  onMouseOver={e =>
                    !loading && (e.currentTarget.style.transform = 'translateY(-2px)')
                  }
                  onMouseOut={e => (e.currentTarget.style.transform = 'translateY(0)')}
                >
                  {loading ? (
                    <>
                      <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                      <span>Activating...</span>
                    </>
                  ) : (
                    <>
                      <svg
                        width="18"
                        height="18"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Activate License</span>
                    </>
                  )}
                </button>
              </form>

              {/* Footer */}
              <div
                style={{
                  marginTop: '32px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                }}
              >
                <div>
                  Need a license? Contact{' '}
                  <span style={{ color: 'var(--primary)', fontWeight: 600 }}>support@schoolfoundry.app</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Secure Activation by{' '}
                  <span style={{ fontWeight: 700, color: 'var(--primary)' }}>Fees</span>
                  <span style={{ fontWeight: 400 }}>Foundry</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Spinning Globe with Feature Cards */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              justifyContent: 'flex-start',
              alignItems: 'center',
              overflow: 'visible',
              position: 'relative',
            }}
          >
            <div
              style={{
                width: '500px',
                height: '500px',
                position: 'relative',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(249,115,22,0.08) 0%, transparent 70%)',
              }}
            >
              <SphereCanvas />
              <FeatureCards position="right" />
            </div>
          </div>
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: '40px', left: 0, right: 0, textAlign: 'center' }}>
        <span
          style={{
            fontSize: '12px',
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            fontFamily: 'monospace',
          }}
        >
          <span style={{ fontWeight: 700 }}>Fees</span>
          <span style={{ fontWeight: 400 }}>Foundry</span> • v1.2.0 • Build 2026
        </span>
      </div>
    </div>
  );
}
