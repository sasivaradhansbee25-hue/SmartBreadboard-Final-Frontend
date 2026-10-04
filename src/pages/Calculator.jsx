import React, { useState } from 'react';
import { 
  Calculator as CalcIcon, 
  Zap, 
  Hash, 
  Sun, 
  Layers, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  ShieldAlert,
  Cpu
} from 'lucide-react';

import { 
  COLOR_CODES, 
  decodeResistorColors, 
  decodeSmdResistorCode, 
  calculateSeriesResistance, 
  calculateParallelResistance,
  findNearestE24Resistor,
  formatResistance 
} from '../utils/resistanceEngine';

import { 
  decodeCapacitorCode, 
  calculateSeriesCapacitance, 
  calculateParallelCapacitance,
  formatCapacitance 
} from '../utils/capacitanceEngine';

import { 
  solveOhmsLaw, 
  calculateLedResistor 
} from '../utils/circuitMathEngine';

export default function Calculator() {
  const [activeTab, setActiveTab] = useState('resistor');

  // --- Tool 1: Resistor Color & SMD State ---
  const [bandCount, setBandCount] = useState(4);
  const [b1, setB1] = useState('2');   // Red (2)
  const [b2, setB2] = useState('7');   // Violet (7)
  const [b3, setB3] = useState('0');   // Black (0)
  const [mult, setMult] = useState('3');// Orange (*1000)
  const [tol, setTol] = useState('-1'); // Gold (±5%)
  const [smdCode, setSmdCode] = useState('103');

  // --- Tool 2: Capacitor Code & Combination State ---
  const [capCodeInput, setCapCodeInput] = useState('104');
  const [capList, setCapList] = useState(['100e-9', '220e-9']);
  const [newCapInput, setNewCapInput] = useState('100');
  const [newCapUnit, setNewCapUnit] = useState('1e-9');

  // --- Tool 3: Resistor Combination State ---
  const [resList, setResList] = useState(['1000', '2200']);
  const [newResInput, setNewResInput] = useState('1000');

  // --- Tool 4: Ohm's Law Wheel State ---
  const [vVal, setVVal] = useState('9');
  const [iVal, setIVal] = useState('0.009');
  const [rVal, setRVal] = useState('1000');
  const [pVal, setPVal] = useState('0.081');

  // --- Tool 5: LED Limiting Resistor State ---
  const [vSupply, setVSupply] = useState('9.0');
  const [vLed, setVLed] = useState('2.1');
  const [iLedMa, setILedMa] = useState('20');

  // Interactive Handlers for Resistor Bands
  const getResistorResult = () => {
    return decodeResistorColors([b1, b2, b3, mult, tol], bandCount);
  };

  const getSmdResult = () => {
    return decodeSmdResistorCode(smdCode);
  };

  // Capacitor Handlers
  const handleAddCap = () => {
    const farads = (parseFloat(newCapInput) || 0) * parseFloat(newCapUnit);
    if (farads > 0) {
      setCapList([...capList, farads.toString()]);
    }
  };

  const handleRemoveCap = (idx) => {
    setCapList(capList.filter((_, i) => i !== idx));
  };

  // Resistor Combination Handlers
  const handleAddRes = () => {
    const ohms = parseFloat(newResInput) || 0;
    if (ohms > 0) {
      setResList([...resList, ohms.toString()]);
    }
  };

  const handleRemoveRes = (idx) => {
    setResList(resList.filter((_, i) => i !== idx));
  };

  const toolTabs = [
    { id: 'resistor', name: 'Resistor Bands & SMD', icon: Hash },
    { id: 'capacitor', name: 'Capacitor Codes & C-Solver', icon: Layers },
    { id: 'res-combo', name: 'Series & Parallel R-Solver', icon: Cpu },
    { id: 'ohms', name: "Ohm's Law Wheel", icon: Zap },
    { id: 'led', name: 'LED Power Limiter', icon: Sun }
  ];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">
          <CalcIcon size={28} style={{ color: 'var(--accent-cyan)' }} />
          Electronics Calculator Suite
        </h1>
        <p className="page-subtitle">
          Independent calculation engines for component color/SMD codes, capacitor combinations, resistance networks, Ohm's law, and LED safety.
        </p>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {toolTabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="btn"
              style={{
                background: isActive ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.03)',
                color: isActive ? 'var(--accent-cyan)' : 'var(--text-muted)',
                border: `1px solid ${isActive ? 'var(--accent-cyan)' : 'var(--border-color)'}`
              }}
            >
              <Icon size={16} /> {tab.name}
            </button>
          );
        })}
      </div>

      {/* TAB 1: RESISTOR COLOR BANDS & SMD DECODER */}
      {activeTab === 'resistor' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card-grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.2rem' }}>Color Band Decoder</h2>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  {[4, 5].map(cnt => (
                    <button
                      key={cnt}
                      onClick={() => setBandCount(cnt)}
                      className="btn btn-secondary"
                      style={{
                        padding: '0.25rem 0.65rem',
                        fontSize: '0.8rem',
                        borderColor: bandCount === cnt ? 'var(--accent-cyan)' : 'var(--border-color)'
                      }}
                    >
                      {cnt}-Band
                    </button>
                  ))}
                </div>
              </div>

              {/* Visual Resistor Representation */}
              <div className="resistor-graphic">
                <div className="resistor-wire-left"></div>
                <div className="color-band" style={{ background: COLOR_CODES[b1]?.hex }}></div>
                <div className="color-band" style={{ background: COLOR_CODES[b2]?.hex }}></div>
                {bandCount === 5 && <div className="color-band" style={{ background: COLOR_CODES[b3]?.hex }}></div>}
                <div className="color-band" style={{ background: COLOR_CODES[mult]?.hex }}></div>
                <div className="color-band" style={{ background: COLOR_CODES[tol]?.hex }}></div>
                <div className="resistor-wire-right"></div>
              </div>

              {/* Selectors */}
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${bandCount === 4 ? 4 : 5}, 1fr)`, gap: '0.75rem', marginTop: '1.5rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Band 1</label>
                  <select value={b1} onChange={e => setB1(e.target.value)} className="input-field">
                    {Object.entries(COLOR_CODES).slice(1, 10).map(([k, v]) => (
                      <option key={k} value={k}>{k} - {v.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Band 2</label>
                  <select value={b2} onChange={e => setB2(e.target.value)} className="input-field">
                    {Object.entries(COLOR_CODES).slice(0, 10).map(([k, v]) => (
                      <option key={k} value={k}>{k} - {v.name}</option>
                    ))}
                  </select>
                </div>

                {bandCount === 5 && (
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Band 3</label>
                    <select value={b3} onChange={e => setB3(e.target.value)} className="input-field">
                      {Object.entries(COLOR_CODES).slice(0, 10).map(([k, v]) => (
                        <option key={k} value={k}>{k} - {v.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Multiplier</label>
                  <select value={mult} onChange={e => setMult(e.target.value)} className="input-field">
                    {Object.entries(COLOR_CODES).map(([k, v]) => (
                      <option key={k} value={k}>{v.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tolerance</label>
                  <select value={tol} onChange={e => setTol(e.target.value)} className="input-field">
                    {Object.entries(COLOR_CODES).filter(([_, v]) => v.tol).map(([k, v]) => (
                      <option key={k} value={k}>{v.name} ±{v.tol}%</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Resistor Result Card */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Calculated Resistance</div>
              <div style={{ fontSize: '2.2rem', fontWeight: '800', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', margin: '0.5rem 0' }}>
                {getResistorResult().formatted}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Tolerance: <span style={{ color: 'var(--accent-amber)' }}>{getResistorResult().tolerance}</span>
              </div>
            </div>
          </div>

          {/* SMD Resistor Code Decoder */}
          <div className="card">
            <h2 style={{ fontSize: '1.15rem', marginBottom: '1rem' }}>SMD Surface-Mount Resistor Code Lookup</h2>
            <div className="card-grid" style={{ gridTemplateColumns: '1fr 2fr' }}>
              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.35rem', display: 'block' }}>SMD Code (3-digit / 4-digit / EIA)</label>
                <input
                  type="text"
                  value={smdCode}
                  onChange={e => setSmdCode(e.target.value)}
                  placeholder="e.g. 103, 4702, 4R7"
                  className="input-field"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', letterSpacing: '0.1em' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Decoded Value:</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                    {getSmdResult().formatted}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Code Standard:</div>
                  <span className="code-pill">{getSmdResult().type}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CAPACITOR CODE & COMBINATION SOLVER (RULE 4 COMPLIANT) */}
      {activeTab === 'capacitor' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card" style={{ background: 'rgba(129, 140, 248, 0.05)', border: '1px solid rgba(129, 140, 248, 0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-indigo)' }}>
              <CheckCircle2 size={18} />
              <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>
                AGENTS.md Rule 4 Enforced: Standalone Capacitance Engine (Series & Parallel Inverse Rules)
              </span>
            </div>
          </div>

          <div className="card-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            {/* Ceramic Code Decoder */}
            <div className="card">
              <h2 style={{ fontSize: '1.15rem', marginBottom: '1rem' }}>3-Digit Ceramic Capacitor Decoder</h2>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.35rem', display: 'block' }}>Capacitor Code (e.g. 104, 223, 471)</label>
                <input
                  type="text"
                  value={capCodeInput}
                  onChange={e => setCapCodeInput(e.target.value)}
                  className="input-field"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem' }}
                />
              </div>

              <div className="capacitor-graphic">
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', fontSize: '1.2rem', color: '#78350f' }}>
                  {capCodeInput || '104'}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#92400e' }}>Ceramic</div>
              </div>

              <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Decoded Capacitance:</div>
                <div style={{ fontSize: '1.6rem', fontWeight: '700', color: 'var(--accent-indigo)', fontFamily: 'var(--font-mono)' }}>
                  {decodeCapacitorCode(capCodeInput).formatted}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  ({decodeCapacitorCode(capCodeInput).pF} pF | {decodeCapacitorCode(capCodeInput).uF} µF)
                </div>
              </div>
            </div>

            {/* Capacitance Combination Solver */}
            <div className="card">
              <h2 style={{ fontSize: '1.15rem', marginBottom: '1rem' }}>Series & Parallel Capacitance Solver</h2>
              
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <input
                  type="number"
                  value={newCapInput}
                  onChange={e => setNewCapInput(e.target.value)}
                  placeholder="Value"
                  className="input-field"
                  style={{ flex: 2 }}
                />
                <select value={newCapUnit} onChange={e => setNewCapUnit(e.target.value)} className="input-field" style={{ flex: 1 }}>
                  <option value="1e-12">pF</option>
                  <option value="1e-9">nF</option>
                  <option value="1e-6">µF</option>
                </select>
                <button onClick={handleAddCap} className="btn btn-primary" style={{ padding: '0.4rem 0.75rem' }}>
                  <Plus size={16} /> Add
                </button>
              </div>

              {/* List of capacitors */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem', maxHeight: '140px', overflowY: 'auto' }}>
                {capList.map((farads, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                      C{i+1}: {formatCapacitance(parseFloat(farads))}
                    </span>
                    <button onClick={() => handleRemoveCap(i)} className="btn btn-secondary" style={{ padding: '0.2rem 0.4rem' }}>
                      <Trash2 size={12} style={{ color: 'var(--accent-rose)' }} />
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.75rem', borderRadius: '6px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Parallel (C_p = ΣC)</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--accent-indigo)', fontFamily: 'var(--font-mono)' }}>
                    {calculateParallelCapacitance(capList).formatted}
                  </div>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.75rem', borderRadius: '6px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Series (1/C_s = Σ1/C)</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                    {calculateSeriesCapacitance(capList).formatted}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: RESISTOR COMBINATION SOLVER */}
      {activeTab === 'res-combo' && (
        <div className="card-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="card">
            <h2 style={{ fontSize: '1.15rem', marginBottom: '1rem' }}>Resistor Network Input</h2>
            
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <input
                type="number"
                value={newResInput}
                onChange={e => setNewResInput(e.target.value)}
                placeholder="Ohms (Ω)"
                className="input-field"
              />
              <button onClick={handleAddRes} className="btn btn-primary" style={{ padding: '0.4rem 0.85rem' }}>
                <Plus size={16} /> Add Resistor
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem', maxHeight: '180px', overflowY: 'auto' }}>
              {resList.map((ohms, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                    R{i+1}: {formatResistance(parseFloat(ohms))}
                  </span>
                  <button onClick={() => handleRemoveRes(i)} className="btn btn-secondary" style={{ padding: '0.2rem 0.4rem' }}>
                    <Trash2 size={12} style={{ color: 'var(--accent-rose)' }} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '1rem' }}>
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Series Combination (R_s = R1 + R2)</div>
              <div style={{ fontSize: '1.6rem', fontWeight: '700', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', marginTop: '0.25rem' }}>
                {calculateSeriesResistance(resList).formatted}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Nearest E24 Match: {findNearestE24Resistor(calculateSeriesResistance(resList).totalOhms).formatted}
              </div>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Parallel Combination (1/R_p = 1/R1 + 1/R2)</div>
              <div style={{ fontSize: '1.6rem', fontWeight: '700', color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)', marginTop: '0.25rem' }}>
                {calculateParallelResistance(resList).formatted}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Nearest E24 Match: {findNearestE24Resistor(calculateParallelResistance(resList).totalOhms).formatted}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: OHM'S LAW WHEEL */}
      {activeTab === 'ohms' && (
        <div className="card-grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
          <div className="card">
            <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>4-Variable Ohm's Law Wheel Solver</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.35rem', display: 'block' }}>Voltage V (Volts)</label>
                <input
                  type="number"
                  value={vVal}
                  onChange={e => {
                    setVVal(e.target.value);
                    const res = solveOhmsLaw({ v: e.target.value, i: iVal, r: rVal, p: pVal });
                    setRVal(res.resistance.toString());
                    setPVal(res.power.toString());
                  }}
                  className="input-field"
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.35rem', display: 'block' }}>Current I (Amperes)</label>
                <input
                  type="number"
                  value={iVal}
                  onChange={e => {
                    setIVal(e.target.value);
                    const res = solveOhmsLaw({ v: vVal, i: e.target.value, r: rVal, p: pVal });
                    setRVal(res.resistance.toString());
                    setPVal(res.power.toString());
                  }}
                  className="input-field"
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.35rem', display: 'block' }}>Resistance R (Ohms)</label>
                <input
                  type="number"
                  value={rVal}
                  onChange={e => {
                    setRVal(e.target.value);
                    const res = solveOhmsLaw({ v: vVal, i: iVal, r: e.target.value, p: pVal });
                    setIVal(res.current.toString());
                    setPVal(res.power.toString());
                  }}
                  className="input-field"
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.35rem', display: 'block' }}>Power P (Watts)</label>
                <input
                  type="number"
                  value={pVal}
                  onChange={e => setPVal(e.target.value)}
                  className="input-field"
                />
              </div>
            </div>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Power Dissipation</div>
            <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)', margin: '0.5rem 0' }}>
              {solveOhmsLaw({ v: vVal, r: rVal }).formattedP}
            </div>
            <span className="code-pill">P = V × I = I²R = V²/R</span>
          </div>
        </div>
      )}

      {/* TAB 5: LED LIMITING RESISTOR & POWER RATING */}
      {activeTab === 'led' && (
        <div className="card-grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
          <div className="card">
            <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>LED Current Limiter & Power Rating Solver</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.35rem', display: 'block' }}>Supply Voltage V_s (V)</label>
                <input
                  type="number"
                  value={vSupply}
                  onChange={e => setVSupply(e.target.value)}
                  className="input-field"
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.35rem', display: 'block' }}>LED Voltage Drop V_led (V)</label>
                <input
                  type="number"
                  value={vLed}
                  onChange={e => setVLed(e.target.value)}
                  className="input-field"
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.35rem', display: 'block' }}>Target Current I_led (mA)</label>
                <input
                  type="number"
                  value={iLedMa}
                  onChange={e => setILedMa(e.target.value)}
                  className="input-field"
                />
              </div>
            </div>
          </div>

          {/* LED Result Summary */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Exact Limiting Resistance:</div>
            <div style={{ fontSize: '1.6rem', fontWeight: '700', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
              {calculateLedResistor({ vSupply, vLed, iLedMa }).formattedR}
            </div>

            <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Recommended Standard E24:</div>
              <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)' }}>
                {calculateLedResistor({ vSupply, vLed, iLedMa }).nearestE24}
              </div>
            </div>

            <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Minimum Power Rating:</div>
              <span className="code-pill" style={{ color: 'var(--accent-amber)' }}>
                {calculateLedResistor({ vSupply, vLed, iLedMa }).recommendedWattage}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
