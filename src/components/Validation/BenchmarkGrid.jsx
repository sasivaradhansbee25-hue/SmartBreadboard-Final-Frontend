import React, { useState } from 'react';
import BenchmarkCard from './BenchmarkCard';
import { Search, Filter, Layers } from 'lucide-react';

export default function BenchmarkGrid({ benchmarks, onInspectCase }) {
  const [filter, setFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = benchmarks.filter((b) => {
    // Category filtering
    if (filter === 'CIRCUITS' && !['PHYS-001', 'PHYS-002', 'PHYS-003', 'PHYS-004', 'PHYS-005'].includes(b.case_id)) return false;
    if (filter === 'FAULTS' && !['PHYS-006', 'PHYS-007'].includes(b.case_id)) return false;
    if (filter === 'ROBUSTNESS' && !['PHYS-008', 'PHYS-009', 'PHYS-010'].includes(b.case_id)) return false;

    // Search query
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchId = b.case_id.toLowerCase().includes(q);
      const matchName = b.circuit_name.toLowerCase().includes(q);
      const matchDesc = b.description.toLowerCase().includes(q);
      return matchId || matchName || matchDesc;
    }
    return true;
  });

  return (
    <div style={{ padding: '1.5rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Controls Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.75rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          {[
            { id: 'ALL', label: 'All Cases (10)' },
            { id: 'CIRCUITS', label: 'Standard Circuits (1-5)' },
            { id: 'FAULTS', label: 'Fault Injections (6-7)' },
            { id: 'ROBUSTNESS', label: 'Camera Robustness (8-10)' }
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFilter(cat.id)}
              style={{
                background: filter === cat.id ? '#1e293b' : 'transparent',
                border: filter === cat.id ? '1px solid #38bdf8' : '1px solid #334155',
                color: filter === cat.id ? '#38bdf8' : '#94a3b8',
                borderRadius: '6px',
                padding: '0.35rem 0.65rem',
                fontSize: '0.74rem',
                fontWeight: filter === cat.id ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.45rem',
          background: '#0c1322',
          border: '1px solid #1e293b',
          borderRadius: '6px',
          padding: '0.35rem 0.65rem',
          minWidth: '220px'
        }}>
          <Search size={14} color="#64748b" />
          <input
            type="text"
            placeholder="Search benchmark cases..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#f8fafc',
              fontSize: '0.75rem',
              width: '100%'
            }}
          />
        </div>
      </div>

      {/* Grid */}
      {filtered.length > 0 ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '1.25rem'
        }}>
          {filtered.map((bm) => (
            <BenchmarkCard
              key={bm.case_id}
              benchmark={bm}
              onInspect={onInspectCase}
            />
          ))}
        </div>
      ) : (
        <div style={{
          padding: '3rem',
          textAlign: 'center',
          background: '#0c1322',
          border: '1px dashed #334155',
          borderRadius: '10px',
          color: '#94a3b8',
          fontSize: '0.85rem'
        }}>
          No benchmark cases matched your filter criteria.
        </div>
      )}
    </div>
  );
}
