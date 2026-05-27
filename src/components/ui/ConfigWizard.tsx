import React, { useState, useEffect } from 'react';
import { db } from '../../lib/db-client';
import { useToast } from '../Toast';
import AcademicYearTab from './AcademicYearTab';
import GradeTab from './GradeTab';
import PaymentPeriodWizard from './PaymentPeriodWizard';

interface AcademicYear {
  id: number;
  label: string;
}

interface Term {
  id: number;
  year_id: number;
  term_number: number;
  label: string;
  start_date: string | null;
  end_date: string | null;
  period_type?: string;
}

interface Grade {
  id: number;
  label: string;
}

interface ConfigWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onDataChange: () => void;
}

type TabType = 'years' | 'grades' | 'periods';

const ConfigWizard: React.FC<ConfigWizardProps> = ({
  isOpen,
  onClose,
  onDataChange,
}) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabType>('years');
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<number | null>(null);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [showPeriodWizard, setShowPeriodWizard] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedYearId) {
      loadTerms(selectedYearId);
    }
  }, [selectedYearId]);

  const loadData = async () => {
    const [yearList, gradeList] = await Promise.all([
      db.all('SELECT * FROM academic_years ORDER BY label DESC'),
      db.all('SELECT * FROM grades ORDER BY id'),
    ]);
    setYears(yearList);
    setGrades(gradeList);
    if (yearList.length > 0 && !selectedYearId) {
      setSelectedYearId(yearList[0].id);
    }
  };

  const loadTerms = async (yearId: number) => {
    const termList = await db.all('SELECT * FROM terms WHERE year_id = ? ORDER BY term_number', [yearId]);
    setTerms(termList);
  };

  const handleYearsChange = () => {
    loadData();
    onDataChange();
  };

  const handleGradesChange = () => {
    loadData();
    onDataChange();
  };

  const handlePeriodsComplete = () => {
    if (selectedYearId) {
      loadTerms(selectedYearId);
    }
    setShowPeriodWizard(false);
    onDataChange();
  };

  const selectedYear = years.find(y => y.id === selectedYearId);

  const tabs = [
    { id: 'years' as TabType, label: 'Academic Years', icon: 'calendar' },
    { id: 'grades' as TabType, label: 'Grades / Forms', icon: 'users' },
    { id: 'periods' as TabType, label: 'Payment Periods', icon: 'clock' },
  ];

  const renderIcon = (icon: string) => {
    switch (icon) {
      case 'calendar':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        );
      case 'users':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        );
      case 'clock':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        );
      default:
        return null;
    }
  };

  if (!isOpen) return null;

  if (showPeriodWizard && selectedYear) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content modal-lg" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h2 style={{ margin: 0 }}>Setup Payment Periods</h2>
            <button className="modal-close" onClick={() => setShowPeriodWizard(false)}>×</button>
          </div>
          <div className="modal-body">
            <PaymentPeriodWizard
              yearId={selectedYearId!}
              yearLabel={selectedYear.label}
              existingTerms={terms}
              onComplete={handlePeriodsComplete}
              onCancel={() => setShowPeriodWizard(false)}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-lg" onClick={e => e.stopPropagation()} style={{ maxWidth: 800 }}>
        <div className="modal-header">
          <h2 style={{ margin: 0 }}>Configuration</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        
        <div style={{ display: 'flex', borderBottom: '1px solid var(--color-sage-border)' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                padding: '16px 24px',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab.id ? '3px solid var(--primary)' : '3px solid transparent',
                color: activeTab === tab.id ? 'var(--primary)' : 'var(--color-sage-placeholder)',
                fontWeight: activeTab === tab.id ? 600 : 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'all 0.2s',
              }}
            >
              {renderIcon(tab.icon)}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {activeTab === 'years' && (
            <AcademicYearTab
              years={years}
              selectedYearId={selectedYearId}
              onYearsChange={handleYearsChange}
              onSelectYear={setSelectedYearId}
            />
          )}

          {activeTab === 'grades' && (
            <GradeTab
              grades={grades}
              selectedYearId={selectedYearId}
              onGradesChange={handleGradesChange}
            />
          )}

          {activeTab === 'periods' && (
            <div>
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ marginBottom: 4 }}>Payment Periods</h3>
                <p style={{ color: 'var(--color-sage-placeholder)', margin: '0 0 16px 0' }}>
                  Payment periods define when fees are charged to students. Create periods based on your school's calendar.
                </p>
                
                {selectedYearId && selectedYear ? (
                  <div style={{ 
                    padding: 16, 
                    background: 'var(--color-sage-cream)', 
                    borderRadius: 8,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>Current Year: {selectedYear.label}</div>
                      <div style={{ fontSize: 13, color: 'var(--color-sage-placeholder)' }}>
                        {terms.length} payment period(s) configured
                      </div>
                    </div>
                    <button className="btn btn-primary" onClick={() => setShowPeriodWizard(true)}>
                      {terms.length > 0 ? 'Edit Periods' : 'Create Periods'}
                    </button>
                  </div>
                ) : (
                  <div style={{ padding: 24, textAlign: 'center', background: 'var(--background)', borderRadius: 8 }}>
                    <p style={{ color: 'var(--color-sage-placeholder)', margin: 0 }}>
                      Please select an academic year first to manage payment periods.
                    </p>
                  </div>
                )}
              </div>

              {terms.length > 0 && (
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 12 }}>Current Periods</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {terms.map((term, i) => (
                      <div
                        key={term.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: 12,
                          background: 'var(--background)',
                          borderRadius: 8,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: '50%',
                            background: 'var(--primary)', color: 'white',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 600
                          }}>
                            {i + 1}
                          </div>
                          <div>
                            <div style={{ fontWeight: 500 }}>{term.label}</div>
                            <div style={{ fontSize: 12, color: 'var(--color-sage-placeholder)' }}>
                              {term.start_date ? new Date(term.start_date).toLocaleDateString() : 'No start'} - {term.end_date ? new Date(term.end_date).toLocaleDateString() : 'No end'}
                            </div>
                          </div>
                        </div>
                        <button 
                          className="btn btn-sage" 
                          onClick={() => setShowPeriodWizard(true)}
                          style={{ fontSize: 13 }}
                        >
                          Edit
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConfigWizard;
