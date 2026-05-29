import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';

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
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

  // Load machine ID on mount
  useEffect(() => {
    const loadMachineId = async () => {
      try {
        const id = await window.api.getMachineId();
        if (id) {
          setMachineId(id);
          try {
            const url = await QRCode.toDataURL(id, {
              errorCorrectionLevel: 'H',
              margin: 2,
              color: {
                dark: '#111827',
                light: '#FFFFFF'
              }
            });
            setQrCodeDataUrl(url);
          } catch (err) {
            console.error('Failed to generate QR code:', err);
          }
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
        width: '100%',
        backgroundColor: 'var(--background)',
        color: 'var(--text-primary)',
        display: 'grid',
        placeItems: 'center',
        position: 'relative',
        overflow: 'hidden',
        padding: 'clamp(24px, 4vw, 40px)',
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
          width: 'min(100%, 1200px)',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'clamp(32px, 5vw, 60px)',
            flexWrap: 'wrap',
          }}
        >
          {/* Left Column - Activation Form */}
          <div style={{ flex: '0 1 460px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ width: '100%', maxWidth: '460px' }}>
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
                    fontSize: '36px',
                    fontWeight: 800,
                    margin: 0,
                    color: 'var(--text-primary)',
                    lineHeight: 1.2,
                  }}
                >
                  System Activation
                </h2>
                <p style={{ color: 'var(--text-secondary)', marginTop: '16px', fontSize: '16px', lineHeight: 1.5 }}>
                  Welcome to <span style={{ fontWeight: 700 }}>School</span>Foundry. To start using the platform, please activate your license.
                  Send the Machine ID (or take a photo of the QR code) to our support team to receive your license key.
                </p>
              </div>

              {/* License Key Form */}
              <form onSubmit={handleActivate} style={{ marginTop: '24px' }}>
                <div style={{ marginBottom: '24px' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: 600,
                      marginBottom: '12px',
                      color: 'var(--text-primary)',
                    }}
                  >
                    ENTER LICENSE KEY
                  </label>
                  <input
                    type="text"
                    value={licenseKey}
                    onChange={e => {
                      const val = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                      const parts = [];
                      for (let i = 0; i < val.length; i += 4) {
                        parts.push(val.substring(i, i + 4));
                      }
                      setLicenseKey(parts.join('-').substring(0, 19));
                    }}
                    placeholder="XXXX-XXXX-XXXX-XXXX"
                    disabled={loading}
                    required
                    style={{
                      width: '100%',
                      padding: '16px',
                      borderRadius: '12px',
                      border: '2px solid var(--border)',
                      fontSize: '18px',
                      letterSpacing: '1px',
                      textAlign: 'center',
                      fontFamily: 'var(--font-mono)',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                      boxSizing: 'border-box',
                      backgroundColor: 'var(--surface)',
                    }}
                    onFocus={e => (e.target.style.borderColor = 'var(--primary)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                  />
                </div>

                {error && (
                  <div style={{ color: '#dc2626', marginBottom: '16px', fontWeight: 500 }}>
                    {error}
                  </div>
                )}

                {success && (
                  <div
                    style={{
                      color: '#059669',
                      backgroundColor: '#d1fae5',
                      padding: '16px',
                      borderRadius: '8px',
                      fontSize: '15px',
                      fontWeight: 600,
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
                    padding: '18px',
                    borderRadius: '12px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                    color: 'white',
                    fontSize: '18px',
                    fontWeight: 700,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.7 : 1,
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    boxShadow: '0 4px 14px rgba(249, 115, 22, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px',
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
                        width="20"
                        height="20"
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
            </div>
          </div>

          {/* Right Column - BIG Machine ID & QR Code */}
          <div
            style={{
              flex: '0 1 480px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <div 
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '24px',
                padding: '40px',
                boxShadow: '0 20px 40px -10px rgba(0,0,0,0.1)',
                border: '1px solid var(--border)',
                width: '100%',
                maxWidth: '480px',
                textAlign: 'center'
              }}
            >
              <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
                Your Machine ID
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '32px' }}>
                Please take a clear photo of this QR code or copy the text ID and send it to our support team.
              </p>

              {loadingMachineId ? (
                 <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px' }}>
                    <div className="animate-spin w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full mb-4" />
                    <span style={{ color: 'var(--text-secondary)' }}>Generating hardware fingerprint...</span>
                 </div>
              ) : (
                <>
                  {qrCodeDataUrl && (
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '32px' }}>
                      <div style={{ padding: '16px', backgroundColor: '#FFFFFF', borderRadius: '16px', border: '2px solid var(--border)', display: 'inline-block' }}>
                        <img 
                          src={qrCodeDataUrl} 
                          alt="Machine ID QR Code" 
                          style={{ width: '280px', height: '280px', display: 'block' }} 
                        />
                      </div>
                    </div>
                  )}

                  <div 
                    style={{ 
                      backgroundColor: 'var(--background)', 
                      padding: '20px', 
                      borderRadius: '12px',
                      border: '2px solid var(--border)',
                      position: 'relative'
                    }}
                  >
                    <code 
                      style={{ 
                        display: 'block',
                        fontSize: '18px', 
                        fontWeight: 600,
                        fontFamily: 'var(--font-mono)', 
                        color: 'var(--text-primary)',
                        wordBreak: 'break-all',
                        lineHeight: 1.4
                      }}
                    >
                      {machineId || 'Unable to generate Machine ID'}
                    </code>
                    
                    <button
                      type="button"
                      onClick={copyMachineId}
                      disabled={!machineId}
                      style={{
                        marginTop: '16px',
                        width: '100%',
                        padding: '14px 16px',
                        backgroundColor: '#FFFFFF',
                        border: '2px solid var(--border)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        transition: 'all 0.2s',
                        fontSize: '15px'
                      }}
                      onMouseOver={e => (e.currentTarget.style.borderColor = 'var(--primary)', e.currentTarget.style.color = 'var(--primary)')}
                      onMouseOut={e => (e.currentTarget.style.borderColor = 'var(--border)', e.currentTarget.style.color = 'var(--text-primary)')}
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
                      Copy Machine ID
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: '24px',
          left: 0,
          right: 0,
          textAlign: 'center',
          zIndex: 11,
        }}
      >
        <span
          style={{
            fontSize: '11px',
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            fontFamily: 'monospace',
          }}
        >
          <span style={{ fontWeight: 700 }}>School</span>
          <span style={{ fontWeight: 400 }}>Foundry</span> | &copy; Jiggabyte Technology Limited
        </span>
      </div>
    </div>
  );
}

