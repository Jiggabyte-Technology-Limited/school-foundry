import React from 'react';
import { useNavigate } from 'react-router-dom';
import SphereCanvas from '../SphereCanvas';
import { FeatureCards } from '../FeatureCards';

interface WelcomeProps {
  isSetup?: boolean;
}

export const Welcome: React.FC<WelcomeProps> = ({ isSetup = true }) => {
  const navigate = useNavigate();

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        backgroundColor: 'var(--background)',
        color: 'var(--text-primary)',
        display: 'flex',
        justifyContent: 'center',
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
          {/* Left Column - Hero Text */}
          <div
            style={{
              flex: 1,
              textAlign: 'right',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '9999px',
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--primary)',
                marginBottom: '24px',
                fontSize: '13px',
                fontFamily: 'monospace',
                boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--primary)',
                  animation: 'pulse 2s infinite',
                }}
              ></span>
              Built for African Schools
            </div>

            <h2
              style={{
                fontSize: '32px',
                fontWeight: 500,
                margin: '0 0 8px 0',
                color: 'var(--text-secondary)',
              }}
            >
              Welcome to
            </h2>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '20px',
                marginBottom: '32px',
                width: '100%',
              }}
            >
              <img
                src="./img/schoolfoundry-logo.svg"
                alt="SchoolFoundry"
                style={{ height: '72px', width: 'auto' }}
              />
              <h1
                style={{
                  fontSize: '84px',
                  fontWeight: 800,
                  margin: 0,
                  letterSpacing: '-2px',
                  lineHeight: 1,
                }}
              >
                School<span style={{ fontWeight: 400 }}>Foundry</span>
              </h1>
            </div>

            <p
              style={{
                fontSize: '20px',
                color: 'var(--text-secondary)',
                marginBottom: '48px',
                maxWidth: '580px',
                lineHeight: 1.6,
              }}
            >
              Replace your receipt books and filing cabinets with a simple desktop system. Pull up
              any learner's full school fees history in seconds and record a payment.
            </p>

            <div style={{ display: 'flex', gap: '16px' }}>
              <button
                onClick={() => navigate('/login')}
                style={{
                  padding: '18px 40px',
                  backgroundColor: 'var(--primary)',
                  color: 'white',
                  borderRadius: '9999px',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(249, 115, 22, 0.3)',
                  transition: 'transform 0.2s, background-color 0.2s',
                }}
                onMouseOver={e => {
                  e.currentTarget.style.backgroundColor = '#ea580c';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseOut={e => {
                  e.currentTarget.style.backgroundColor = 'var(--primary)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {isSetup ? 'Sign In to Dashboard' : 'Sign Up'}
              </button>
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
          <span style={{ fontWeight: 700 }}>School</span>
          <span style={{ fontWeight: 400 }}>Foundry</span> • v1.2.0 • Build 2026
        </span>
      </div>
    </div>
  );
};
