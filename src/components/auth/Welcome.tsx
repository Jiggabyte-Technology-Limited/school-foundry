import React from 'react';
import { useNavigate } from 'react-router-dom';

export const Welcome: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--background)] p-8">
      <div className="max-w-4xl text-center">
        <h1 className="text-[64px] font-bold text-[var(--text-primary)] mb-8 tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
          Intelligence Scaled.
        </h1>
        <p className="text-xl text-[var(--text-secondary)] mb-12 max-w-2xl mx-auto">
          Manage your school's financial landscape with precision, efficiency, and clarity.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button 
            onClick={() => navigate('/login')}
            className="px-8 py-4 bg-[var(--primary)] text-white font-medium rounded-lg hover:opacity-90 transition-opacity"
          >
            Get Started
          </button>
          <button className="px-8 py-4 bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border)] font-medium rounded-lg hover:bg-[var(--secondary)] transition-colors">
            Learn More
          </button>
        </div>
      </div>
    </div>
  );
};
