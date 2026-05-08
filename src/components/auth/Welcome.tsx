import React from 'react';
import { useNavigate } from 'react-router-dom';

export const Welcome: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="layout-wrapper">
        <div className="flex flex-col items-center justify-center min-h-screen p-8">
        <div className="max-w-4xl text-center">
            <div style={{ 
                marginBottom: '32px'
            }}>
                <img 
                    src="./img/feesfoundry-logo.svg" 
                    alt="FeesFoundry Logo" 
                    style={{ width: '120px', height: '120px', margin: '0 auto' }} 
                />
            </div>
            
            <h1 className="text-display" style={{ fontSize: '72px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '24px', letterSpacing: '-0.03em', lineHeight: 1 }}>
            FeesFoundry
            </h1>
            <p className="text-display" style={{ fontSize: '20px', color: 'var(--text-secondary)', marginBottom: '48px', maxWidth: '600px', mx: 'auto', lineHeight: 1.6 }}>
            The definitive financial operating system for modern academic institutions. Precision, efficiency, and clarity in every transaction.
            </p>
            
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
            <button 
                onClick={() => navigate('/login')}
                className="btn btn-primary btn-lg"
                style={{ padding: '16px 48px', fontSize: '18px' }}
            >
                Get Started
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '8px' }}>
                    <polyline points="9 18 15 12 9 6" />
                </svg>
            </button>
            <button 
                className="btn btn-outline btn-lg"
                style={{ padding: '16px 48px', fontSize: '18px' }}
            >
                Documentation
            </button>
            </div>
        </div>
        
        <div style={{ position: 'fixed', bottom: '40px', left: 0, right: 0, textAlign: 'center' }}>
            <span className="text-mono" style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                FeesFoundry • v1.2.0 • Build 2026
            </span>
        </div>
        </div>
    </div>
  );
};
