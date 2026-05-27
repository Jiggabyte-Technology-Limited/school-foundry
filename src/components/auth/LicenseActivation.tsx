import React, { useState, useEffect } from 'react';

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 mb-4 shadow-lg shadow-cyan-500/30">
            <svg
              className="w-10 h-10 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.436-5.436A6 6 0 1121 9z"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Activate SchoolFoundry</h1>
          <p className="text-slate-400">Enter your license key to activate the application</p>
        </div>

        {/* Main Card */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden">
          {/* Machine ID Section */}
          <div className="p-6 border-b border-slate-700/50">
            <label className="block text-sm font-medium text-slate-300 mb-3">
              Your Machine ID
            </label>
            {loadingMachineId ? (
              <div className="flex items-center gap-3 p-4 bg-slate-900/50 rounded-lg border border-slate-700/50">
                <div className="animate-spin w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full"></div>
                <span className="text-slate-400">Generating Machine ID...</span>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1 p-3 bg-slate-900/50 rounded-lg border border-slate-700/50 font-mono text-sm text-cyan-400 break-all">
                    {machineId || 'Unable to generate Machine ID'}
                  </div>
                  <button
                    type="button"
                    onClick={copyMachineId}
                    disabled={!machineId}
                    className="shrink-0 p-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg border border-slate-600 transition-colors"
                    title="Copy Machine ID"
                  >
                    <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  Send this Machine ID to receive your license key via SMS or WhatsApp.
                </p>
              </div>
            )}
          </div>

          {/* License Key Input */}
          <form onSubmit={handleActivate} className="p-6">
            <label className="block text-sm font-medium text-slate-300 mb-3">
              License Key
            </label>
            <textarea
              value={licenseKey}
              onChange={e => setLicenseKey(e.target.value)}
              placeholder="Paste your license key here..."
              className="w-full h-32 p-3 bg-slate-900/50 rounded-lg border border-slate-700/50 font-mono text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 resize-none"
              spellCheck={false}
            />

            {/* Error Message */}
            {error && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-red-400 text-sm whitespace-pre-wrap">{error}</p>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                <p className="text-green-400 text-sm">{success}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !licenseKey.trim() || loadingMachineId}
              className="w-full mt-4 py-3 px-6 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg shadow-lg shadow-cyan-500/25 transition-all duration-200 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                  <span>Activating...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Activate License</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-sm text-slate-500">
            Need a license? Contact{' '}
            <span className="text-cyan-400">support@schoolfoundry.app</span>
          </p>
        </div>
      </div>
    </div>
  );
}
