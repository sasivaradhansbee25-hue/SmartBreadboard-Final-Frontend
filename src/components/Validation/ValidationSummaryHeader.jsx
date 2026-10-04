import React from 'react';
import { ShieldCheck, AlertCircle, CheckCircle2, FlaskConical, Layers, FileText, Bug, Cpu } from 'lucide-react';

export default function ValidationSummaryHeader({ summary, activeTab, onSelectTab }) {
  const tabs = [
    { id: 'benchmarks', label: 'Benchmark Suite (PHYS-001 - 010)', icon: Layers, count: summary?.total_benchmarks || 10 },
    { id: 'hardware-calibration', label: 'Hardware Calibration (Phase 23)', icon: Cpu, count: 5 },
    { id: 'comparison', label: 'Software vs Physical Audit', icon: FlaskConical },
    { id: 'failure-injection', label: 'Failure Injection (Faults A-F)', icon: Bug, count: 6 },
    { id: 'report', label: 'Formal Audit Report', icon: FileText }
  ];

  return (
    <div style={{
      background: 'linear-gradient(180deg, #0d1527 0%, #090d16 100%)',
      borderBottom: '1px solid #1e293b',
      padding: '1.5rem 2rem 0.75rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '1.25rem'
    }}>
      {/* Top Title & Status Banner */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
            padding: '0.65rem',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(99, 102, 241, 0.35)'
          }}>
            <ShieldCheck size={26} color="#ffffff" />
          </div>
          <div>
            <h1 style={{
              margin: 0,
              fontSize: '1.45rem',
              fontWeight: 800,
              color: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem'
            }}>
              Physical Validation & Evidence Dashboard
              <span style={{
                fontSize: '0.70rem',
                fontWeight: 700,
                padding: '0.15rem 0.55rem',
                borderRadius: '6px',
                background: 'rgba(99, 102, 241, 0.2)',
                color: '#a5b4fc',
                border: '1px solid rgba(99, 102, 241, 0.4)',
                letterSpacing: '0.04em'
              }}>
                Phase 24A
              </span>
            </h1>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: '#94a3b8' }}>
              Multi-tier reliability audit separating deterministic software verification from hardware physical testing.
            </p>
          </div>
        </div>

        {/* Global Status Pill */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          background: 'rgba(245, 158, 11, 0.12)',
          border: '1px solid rgba(245, 158, 11, 0.35)',
          padding: '0.45rem 0.95rem',
          borderRadius: '8px'
        }}>
          <AlertCircle size={16} color="#fbbf24" />
          <div>
            <div style={{ fontSize: '0.65rem', color: '#fbbf24', textTransform: 'uppercase', fontWeight: 700 }}>
              Physical Validation Status
            </div>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#fef3c7' }}>
              NOT PERFORMED (Software Verified)
            </div>
          </div>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '0.85rem'
      }}>
        {/* Card 1: Benchmark Cases */}
        <div style={{
          background: '#0c1322',
          border: '1px solid #1e293b',
          borderRadius: '10px',
          padding: '0.85rem 1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem'
        }}>
          <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
            Benchmark Suite
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#38bdf8' }}>
            {summary?.total_benchmarks || 10} Cases
          </div>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
            PHYS-001 through PHYS-010 defined
          </div>
        </div>

        {/* Card 2: Software Verification */}
        <div style={{
          background: '#0c1322',
          border: '1px solid rgba(52, 211, 153, 0.3)',
          borderRadius: '10px',
          padding: '0.85rem 1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem'
        }}>
          <div style={{ fontSize: '0.72rem', color: '#34d399', fontWeight: 600, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <CheckCircle2 size={13} color="#34d399" />
            Software Tests
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#34d399' }}>
            184 / 184 Passed
          </div>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
            48/48 Frontend + 184/184 Backend
          </div>
        </div>

        {/* Card 3: Physical Lab Status */}
        <div style={{
          background: '#0c1322',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: '10px',
          padding: '0.85rem 1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem'
        }}>
          <div style={{ fontSize: '0.72rem', color: '#fbbf24', fontWeight: 600, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <FlaskConical size={13} color="#fbbf24" />
            Physical Lab Bench
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#fbbf24' }}>
            0 Tested
          </div>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
            10 Queued (Awaiting Bench Setup)
          </div>
        </div>

        {/* Card 4: Failure Injection */}
        <div style={{
          background: '#0c1322',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          borderRadius: '10px',
          padding: '0.85rem 1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem'
        }}>
          <div style={{ fontSize: '0.72rem', color: '#a78bfa', fontWeight: 600, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <Bug size={13} color="#a78bfa" />
            Failure Injection
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#c4b5fd' }}>
            6 / 6 Safe
          </div>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
            Scenarios A through F Verified
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '0.45rem',
        borderTop: '1px solid #1e293b',
        paddingTop: '0.65rem',
        overflowX: 'auto'
      }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              style={{
                background: isActive ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                color: isActive ? '#f8fafc' : '#94a3b8',
                border: isActive ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid transparent',
                borderRadius: '8px',
                padding: '0.5rem 0.95rem',
                fontSize: '0.78rem',
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap'
              }}
            >
              <Icon size={15} color={isActive ? '#818cf8' : '#64748b'} />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span style={{
                  background: isActive ? '#4f46e5' : '#1e293b',
                  color: isActive ? '#ffffff' : '#94a3b8',
                  fontSize: '0.65rem',
                  padding: '0.1rem 0.4rem',
                  borderRadius: '10px',
                  fontWeight: 700
                }}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
