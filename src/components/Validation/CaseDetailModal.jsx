import React, { useState } from 'react';
import { X, ShieldCheck, Camera, Zap, Activity, AlertTriangle, CheckCircle, Clock, Image, FileText, Info } from 'lucide-react';

export default function CaseDetailModal({ caseData, onClose }) {
  if (!caseData) return null;

  const [activeTab, setActiveTab] = useState('SPECS'); // 'SPECS' | 'COMPARISON' | 'EVIDENCE'

  const isTested = caseData.status !== 'NOT_TESTED';
  const pm = caseData.physical_measurements || {};
  const sw = caseData.software_results || {};
  const comp = caseData.comparison || {};
  const tol = caseData.tolerance_spec || {};

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1.5rem'
    }}
    onClick={onClose}
    >
      <div style={{
        background: '#0c1322',
        border: '1px solid #1e293b',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '850px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
        overflow: 'hidden'
      }}
      onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '1rem 1.25rem',
          background: 'linear-gradient(90deg, #0f172a 0%, #1e1b4b 100%)',
          borderBottom: '1px solid #334155',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{
              background: '#38bdf8',
              color: '#090d16',
              fontSize: '0.75rem',
              fontWeight: 800,
              padding: '0.2rem 0.5rem',
              borderRadius: '4px'
            }}>
              {caseData.case_id}
            </span>
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#f8fafc' }}>
                {caseData.circuit_name.replace(/_/g, ' ')}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                Benchmark Reliability & Ground Truth Specification
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{
              fontSize: '0.70rem',
              fontWeight: 700,
              padding: '0.2rem 0.55rem',
              borderRadius: '4px',
              background: caseData.status === 'PASS' 
                ? 'rgba(52, 211, 153, 0.2)' 
                : caseData.status === 'FAIL' 
                  ? 'rgba(239, 68, 68, 0.2)' 
                  : 'rgba(245, 158, 11, 0.2)',
              color: caseData.status === 'PASS' 
                ? '#34d399' 
                : caseData.status === 'FAIL' 
                  ? '#f87171' 
                  : '#fbbf24',
              border: '1px solid currentColor'
            }}>
              STATUS: {caseData.status}
            </span>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '0.3rem',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Subtabs */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          padding: '0.5rem 1.25rem',
          background: '#090d16',
          borderBottom: '1px solid #1e293b'
        }}>
          {[
            { id: 'SPECS', label: 'Circuit & Camera Setup', icon: Info },
            { id: 'COMPARISON', label: 'Multimeter vs MNA Comparison', icon: Zap },
            { id: 'EVIDENCE', label: 'Evidence & Discrepancies', icon: Image }
          ].map((tab) => {
            const Icon = tab.icon;
            const isAct = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  background: isAct ? '#1e293b' : 'transparent',
                  border: isAct ? '1px solid #38bdf8' : '1px solid transparent',
                  color: isAct ? '#38bdf8' : '#94a3b8',
                  borderRadius: '6px',
                  padding: '0.35rem 0.65rem',
                  fontSize: '0.74rem',
                  fontWeight: isAct ? 700 : 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                <Icon size={13} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div style={{
          padding: '1.25rem',
          overflowY: 'auto',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          fontSize: '0.80rem',
          color: '#cbd5e1'
        }}>
          {activeTab === 'SPECS' && (
            <>
              {/* Description */}
              <div style={{
                background: '#090d16',
                border: '1px solid #1e293b',
                borderRadius: '8px',
                padding: '0.75rem 1rem'
              }}>
                <div style={{ fontWeight: 700, color: '#f8fafc', marginBottom: '0.25rem' }}>Description:</div>
                <div style={{ color: '#cbd5e1', lineHeight: 1.45 }}>{caseData.description}</div>
              </div>

              {/* Components Table */}
              <div>
                <div style={{ fontWeight: 700, color: '#f8fafc', marginBottom: '0.45rem' }}>Physical Components Under Test:</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8' }}>
                      <th style={{ padding: '0.4rem' }}>Designator</th>
                      <th style={{ padding: '0.4rem' }}>Type</th>
                      <th style={{ padding: '0.4rem' }}>Nominal Value</th>
                      <th style={{ padding: '0.4rem' }}>Multimeter Measured</th>
                      <th style={{ padding: '0.4rem' }}>Breadboard Holes</th>
                      <th style={{ padding: '0.4rem' }}>Tolerance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(caseData.components || []).map((c) => (
                      <tr key={c.id} style={{ borderBottom: '1px solid #1e293b' }}>
                        <td style={{ padding: '0.4rem', fontWeight: 700, color: '#38bdf8' }}>{c.id}</td>
                        <td style={{ padding: '0.4rem' }}>{c.type}</td>
                        <td style={{ padding: '0.4rem' }}>{c.nominal_value != null ? `${c.nominal_value} ${c.unit || 'Ω'}` : 'N/A'}</td>
                        <td style={{ padding: '0.4rem', color: c.measured_value != null ? '#34d399' : '#94a3b8' }}>
                          {c.measured_value != null ? `${c.measured_value} ${c.unit || 'Ω'}` : 'N/A (Not recorded)'}
                        </td>
                        <td style={{ padding: '0.4rem', fontFamily: 'monospace' }}>{c.start_hole} → {c.end_hole}</td>
                        <td style={{ padding: '0.4rem' }}>±{c.tolerance_percent}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Power and Camera Config */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ background: '#090d16', border: '1px solid #1e293b', borderRadius: '8px', padding: '0.75rem' }}>
                  <div style={{ fontWeight: 700, color: '#f8fafc', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Zap size={13} color="#fbbf24" /> Power Source Configuration
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', lineHeight: 1.6 }}>
                    <div>• Supply Type: <strong style={{ color: '#cbd5e1' }}>{caseData.power_source?.type || 'DC'}</strong></div>
                    <div>• Nominal Voltage: <strong style={{ color: '#cbd5e1' }}>{caseData.power_source?.nominal_voltage_v} V</strong></div>
                    <div>• Measured Voltage: <strong style={{ color: caseData.power_source?.measured_voltage_v != null ? '#34d399' : '#94a3b8' }}>
                      {caseData.power_source?.measured_voltage_v != null ? `${caseData.power_source.measured_voltage_v} V` : 'N/A (Not recorded)'}
                    </strong></div>
                    <div>• Current Limit: <strong style={{ color: '#cbd5e1' }}>{caseData.power_source?.current_limit_ma || 500} mA</strong></div>
                  </div>
                </div>

                <div style={{ background: '#090d16', border: '1px solid #1e293b', borderRadius: '8px', padding: '0.75rem' }}>
                  <div style={{ fontWeight: 700, color: '#f8fafc', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Camera size={13} color="#818cf8" /> Camera Environment Telemetry
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', lineHeight: 1.6 }}>
                    <div>• Device: <strong style={{ color: '#cbd5e1' }}>{caseData.camera?.camera_device || '1080p Webcam'}</strong></div>
                    <div>• Viewing Angle: <strong style={{ color: '#cbd5e1' }}>{caseData.camera?.viewing_angle || 'front'}</strong></div>
                    <div>• Lighting: <strong style={{ color: '#cbd5e1' }}>{caseData.camera?.lighting_condition || 'standard'}</strong></div>
                    <div>• Distance: <strong style={{ color: '#cbd5e1' }}>{caseData.camera?.distance_cm || 25} cm</strong></div>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'COMPARISON' && (
            <>
              {/* Notice Banner */}
              <div style={{
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '8px',
                padding: '0.65rem 0.85rem',
                fontSize: '0.74rem',
                color: '#fef3c7',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem'
              }}>
                <AlertTriangle size={15} color="#fbbf24" />
                <span>
                  Physical measurements remain <strong>NOT_TESTED</strong> until calibrated multimeter bench readings are captured. MNA simulation values serve as mathematical reference.
                </span>
              </div>

              {/* Comparison Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8' }}>
                    <th style={{ padding: '0.4rem' }}>Telemetry Metric</th>
                    <th style={{ padding: '0.4rem' }}>Physical Measured (DMM)</th>
                    <th style={{ padding: '0.4rem' }}>MNA Simulated Prediction</th>
                    <th style={{ padding: '0.4rem' }}>Absolute Error</th>
                    <th style={{ padding: '0.4rem' }}>Percentage Error</th>
                    <th style={{ padding: '0.4rem' }}>Allowable Tolerance</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #1e293b' }}>
                    <td style={{ padding: '0.4rem', fontWeight: 700 }}>Supply Voltage (V)</td>
                    <td style={{ padding: '0.4rem', color: pm.v_supply_measured_v != null ? '#34d399' : '#94a3b8' }}>
                      {pm.v_supply_measured_v != null ? `${pm.v_supply_measured_v.toFixed(3)} V` : 'N/A — Not recorded'}
                    </td>
                    <td style={{ padding: '0.4rem' }}>{caseData.power_source?.nominal_voltage_v?.toFixed(3) || '5.000'} V</td>
                    <td style={{ padding: '0.4rem' }}>{comp.v_error_abs_v != null ? `${comp.v_error_abs_v.toFixed(4)} V` : 'N/A'}</td>
                    <td style={{ padding: '0.4rem' }}>{comp.v_error_pct != null ? `${comp.v_error_pct}%` : 'N/A'}</td>
                    <td style={{ padding: '0.4rem' }}>±{tol.power_supply_tolerance_percent || 2.0}%</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #1e293b' }}>
                    <td style={{ padding: '0.4rem', fontWeight: 700 }}>Loop Current (mA)</td>
                    <td style={{ padding: '0.4rem', color: pm.i_circuit_measured_ma != null ? '#34d399' : '#94a3b8' }}>
                      {pm.i_circuit_measured_ma != null ? `${pm.i_circuit_measured_ma.toFixed(2)} mA` : 'N/A — Not recorded'}
                    </td>
                    <td style={{ padding: '0.4rem' }}>
                      {sw.mna_branch_currents_ma?.R1 != null ? `${sw.mna_branch_currents_ma.R1.toFixed(2)} mA` : '13.04 mA (est)'}
                    </td>
                    <td style={{ padding: '0.4rem' }}>{comp.i_error_abs_ma != null ? `${comp.i_error_abs_ma.toFixed(3)} mA` : 'N/A'}</td>
                    <td style={{ padding: '0.4rem' }}>{comp.i_error_pct != null ? `${comp.i_error_pct}%` : 'N/A'}</td>
                    <td style={{ padding: '0.4rem' }}>±{tol.resistor_tolerance_percent || 5.0}%</td>
                  </tr>
                </tbody>
              </table>

              {/* Netlist Matching */}
              <div style={{ background: '#090d16', border: '1px solid #1e293b', borderRadius: '8px', padding: '0.75rem' }}>
                <div style={{ fontWeight: 700, color: '#f8fafc', marginBottom: '0.35rem' }}>Netlist Topology Verification:</div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                  <div>• Netlist Graph Match: <strong style={{ color: comp.netlist_match ? '#34d399' : '#fbbf24' }}>{comp.netlist_match ? 'MATCH (Verified)' : 'QUEUED (Physical graph match pending)'}</strong></div>
                  <div>• Terminal Mapping Accuracy: <strong style={{ color: '#cbd5e1' }}>{comp.terminal_mapping_accuracy || 'INSUFFICIENT DATA'}</strong></div>
                  <div>• AR Alignment Status: <strong style={{ color: '#a5b4fc' }}>{sw.ar_alignment_status || 'NOT_MEASURED'}</strong></div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'EVIDENCE' && (
            <>
              <div style={{ fontWeight: 700, color: '#f8fafc' }}>Laboratory Evidence Repository:</div>

              {/* Evidence Placeholders */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{
                  background: '#090d16',
                  border: '1px dashed #334155',
                  borderRadius: '8px',
                  padding: '1.5rem 1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  textAlign: 'center'
                }}>
                  <Image size={24} color="#64748b" />
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8' }}>Physical Breadboard Photo</div>
                  <div style={{ fontSize: '0.68rem', color: '#64748b' }}>Awaiting lab camera snapshot</div>
                </div>

                <div style={{
                  background: '#090d16',
                  border: '1px dashed #334155',
                  borderRadius: '8px',
                  padding: '1.5rem 1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  textAlign: 'center'
                }}>
                  <Camera size={24} color="#64748b" />
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8' }}>YOLO Detection Overlay Frame</div>
                  <div style={{ fontSize: '0.68rem', color: '#64748b' }}>Awaiting real-time stream capture</div>
                </div>
              </div>

              {/* Discrepancies Log */}
              <div style={{ background: '#090d16', border: '1px solid #1e293b', borderRadius: '8px', padding: '0.75rem' }}>
                <div style={{ fontWeight: 700, color: '#f8fafc', marginBottom: '0.35rem' }}>Discrepancy & Tolerance Notes:</div>
                {comp.tolerance_notes && comp.tolerance_notes.length > 0 ? (
                  <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.72rem', color: '#cbd5e1' }}>
                    {comp.tolerance_notes.map((n, idx) => <li key={idx}>{n}</li>)}
                  </ul>
                ) : (
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>No discrepancy notes recorded yet.</div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
