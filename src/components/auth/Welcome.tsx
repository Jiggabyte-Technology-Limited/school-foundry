import React from 'react';
import { useNavigate } from 'react-router-dom';

export const Welcome: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--background)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: '-10%', top: '50%', transform: 'translateY(-50%)', width: '700px', height: '700px', background: 'radial-gradient(circle, rgba(249,115,22,0.08), transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', left: '-10%', top: '50%', transform: 'translateY(-50%)', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(20,184,166,0.05), transparent 70%)', pointerEvents: 'none' }} />
        
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 40px', width: '100%', position: 'relative', zIndex: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '40px' }}>
                <img src="./img/feesfoundry-logo.svg" alt="FeesFoundry" style={{ height: '40px', width: 'auto' }} />
                <span style={{ fontSize: '24px', fontWeight: 'bold' }}>Fees<span style={{ fontWeight: 'normal' }}>Foundry</span></span>
            </div>

            <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '9999px', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--primary)', marginBottom: '28px', fontSize: '14px', fontFamily: 'monospace', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--primary)', animation: 'pulse 2s infinite' }}></span>
                    School Fees Management. Built for African Schools.
                </div>

                <h1 style={{ fontSize: '72px', fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.02em', margin: '0 auto 24px auto', color: 'var(--text-primary)' }}>
                    Stop Drowning in <br/>
                    <span style={{ color: 'transparent', backgroundClip: 'text', WebkitBackgroundClip: 'text', backgroundImage: 'linear-gradient(to right, #f97316, #fb923c)' }}>School Fees Paperwork</span>
                </h1>

                <p style={{ fontSize: '20px', color: 'var(--text-secondary)', marginBottom: '40px', maxWidth: '600px', margin: '0 auto 40px auto', lineHeight: 1.6 }}>
                    Replace your receipt books and filing cabinets with a simple desktop system. Pull up any student's full school fees history in seconds and record a payment.
                </p>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
                    <button 
                        onClick={() => navigate('/login')}
                        style={{ padding: '16px 32px', backgroundColor: 'var(--primary)', color: 'white', borderRadius: '9999px', fontSize: '18px', fontWeight: 'bold', border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px rgba(249,115,22,0.3)', transition: 'transform 0.2s, background-color 0.2s' }}
                        onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#ea580c'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                        onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'var(--primary)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                    >
                        Sign In to Dashboard
                    </button>
                    <button 
                        style={{ padding: '16px 32px', backgroundColor: 'var(--surface)', color: 'var(--text-primary)', borderRadius: '9999px', fontSize: '18px', fontWeight: 'bold', border: '1px solid var(--border)', cursor: 'pointer', transition: 'background-color 0.2s, transform 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
                        onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'var(--secondary)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                        onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'var(--surface)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                    >
                        Read Documentation
                    </button>
                </div>
            </div>
        </div>

        <div style={{ position: 'absolute', bottom: '40px', left: 0, right: 0, textAlign: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'monospace' }}>
                FeesFoundry • v1.2.0 • Build 2026
            </span>
        </div>
    </div>
  );
};
