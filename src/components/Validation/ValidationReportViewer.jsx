import React, { useState } from 'react';
import { FileText, Copy, Download, Check, ShieldCheck } from 'lucide-react';

export default function ValidationReportViewer({ reportData, benchmarks }) {
  const [copied, setCopied] = useState(false);

  const mdText = reportData?.markdown || '# Validation Report Unavailable';

  const handleCopy = () => {
    navigator.clipboard.writeText(mdText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(benchmarks, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `SmartBreadboard3D_Validation_Suite_${Date.now()}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
  };

  return (
    <div style={{ padding: '1.5rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header & Actions */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem'
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={20} color="#38bdf8" />
            Formal Hardware & Reliability Audit Report
          </h2>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.76rem', color: '#94a3b8' }}>
            Generated directly from backend/validation/report_generator.py
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={handleCopy}
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              color: copied ? '#34d399' : '#cbd5e1',
              borderRadius: '6px',
              padding: '0.4rem 0.75rem',
              fontSize: '0.74rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              transition: 'all 0.15s ease'
            }}
          >
            {copied ? <Check size={13} color="#34d399" /> : <Copy size={13} />}
            {copied ? 'Copied Markdown' : 'Copy Markdown'}
          </button>

          <button
            onClick={handleDownloadJson}
            style={{
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              border: 'none',
              color: '#ffffff',
              borderRadius: '6px',
              padding: '0.4rem 0.75rem',
              fontSize: '0.74rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              boxShadow: '0 2px 8px rgba(2, 132, 199, 0.35)'
            }}
          >
            <Download size={13} />
            Download Suite JSON
          </button>
        </div>
      </div>

      {/* Markdown Container */}
      <div style={{
        background: '#0c1322',
        border: '1px solid #1e293b',
        borderRadius: '10px',
        padding: '1.5rem',
        fontSize: '0.80rem',
        color: '#e2e8f0',
        lineHeight: 1.6,
        fontFamily: 'Consolas, Monaco, "Courier New", monospace',
        whiteSpace: 'pre-wrap',
        overflowX: 'auto',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        maxHeight: '650px',
        overflowY: 'auto'
      }}>
        {mdText}
      </div>
    </div>
  );
}
