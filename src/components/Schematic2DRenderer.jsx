import React, { useState } from 'react';
import { Download, ZoomIn, ZoomOut, Maximize2, Info, Layers } from 'lucide-react';

export default function Schematic2DRenderer({ circuit, onSelectComponent }) {
  const [selectedCompId, setSelectedCompId] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  if (!circuit || !circuit.components) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        No circuit dataset available for schematic rendering.
      </div>
    );
  }

  const handleComponentClick = (comp) => {
    setSelectedCompId(comp.id);
    if (onSelectComponent) onSelectComponent(comp);
  };

  const handleDownloadSvg = () => {
    const svgElement = document.getElementById(`schematic-svg-${circuit.id}`);
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);

    const downloadLink = document.createElement('a');
    downloadLink.href = svgUrl;
    downloadLink.download = `${circuit.id}_schematic_2d.svg`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  return (
    <div style={{ background: '#040711', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '1rem' }}>
      {/* Controls & Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="code-pill">source: {circuit.source || 'real'}</span>
          <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--accent-cyan)' }}>

            IEEE 2D Schematic Canvas
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <button
            onClick={() => setZoomLevel(Math.min(1.5, zoomLevel + 0.1))}
            className="btn btn-secondary"
            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
            title="Zoom In"
          >
            <ZoomIn size={14} />
          </button>
          <button
            onClick={() => setZoomLevel(Math.max(0.7, zoomLevel - 0.1))}
            className="btn btn-secondary"
            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
            title="Zoom Out"
          >
            <ZoomOut size={14} />
          </button>
          <button
            onClick={() => setZoomLevel(1)}
            className="btn btn-secondary"
            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
            title="Reset Zoom"
          >
            <Maximize2 size={14} />
          </button>
          <button
            onClick={handleDownloadSvg}
            className="btn btn-primary"
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
          >
            <Download size={14} /> Export SVG
          </button>
        </div>
      </div>

      {/* SVG Canvas Viewport */}
      <div style={{ overflowX: 'auto', textAlign: 'center', background: '#02040a', borderRadius: '8px', padding: '1rem', border: '1px solid rgba(56, 189, 248, 0.1)' }}>
        <svg
          id={`schematic-svg-${circuit.id}`}
          viewBox="0 0 700 360"
          style={{
            maxWidth: '100%',
            height: 'auto',
            transform: `scale(${zoomLevel})`,
            transformOrigin: 'center center',
            transition: 'transform 0.2s ease'
          }}
        >
          {/* Grid Background Lines */}
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(56, 189, 248, 0.05)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* MAIN CIRCUIT SCHEMATIC RENDERING (IEEE STANDARD SYMBOLS) */}
          
          {/* 1. DC Power Supply (V1: 9V / 5V) */}
          <g transform="translate(80, 160)" style={{ cursor: 'pointer' }}>
            <line x1="0" y1="-70" x2="0" y2="70" stroke="#38bdf8" strokeWidth="2.5" />
            {/* Long & Short Battery Plates */}
            <line x1="-15" y1="-15" x2="15" y2="-15" stroke="#38bdf8" strokeWidth="3" />
            <line x1="-8" y1="-5" x2="8" y2="-5" stroke="#94a3b8" strokeWidth="3" />
            <line x1="-15" y1="5" x2="15" y2="5" stroke="#38bdf8" strokeWidth="3" />
            <line x1="-8" y1="15" x2="8" y2="15" stroke="#94a3b8" strokeWidth="3" />

            <text x="-30" y="-25" fill="#38bdf8" fontSize="14" fontWeight="bold">+</text>
            <text x="-30" y="30" fill="#94a3b8" fontSize="14" fontWeight="bold">-</text>
            <text x="-50" y="5" fill="#f8fafc" fontSize="12" fontWeight="bold">V1</text>
            <text x="-65" y="20" fill="#94a3b8" fontSize="11">{circuit.power_supply?.voltage || 9}V</text>
          </g>

          {/* Wire Power Top Rail */}
          <path d="M 80 90 L 320 90" fill="none" stroke="#38bdf8" strokeWidth="2.5" />

          {/* 2. Component 1: Resistor R1 */}
          {circuit.components[0] && (
            <g
              transform="translate(320, 90)"
              onClick={() => handleComponentClick(circuit.components[0])}
              style={{ cursor: 'pointer' }}
            >
              {/* Zigzag Resistor Symbol */}
              <polyline
                points="0,0 15,0 20,-12 30,12 40,-12 50,12 60,-12 70,12 75,0 90,0"
                fill="none"
                stroke={selectedCompId === circuit.components[0].id ? '#fbbf24' : '#38bdf8'}
                strokeWidth={selectedCompId === circuit.components[0].id ? "3.5" : "2.5"}
              />
              <text x="45" y="-20" fill="#f8fafc" fontSize="13" fontWeight="bold" textAnchor="middle">
                {circuit.components[0].designator}
              </text>
              <text x="45" y="30" fill="#38bdf8" fontSize="11" fontFamily="JetBrains Mono" textAnchor="middle">
                {circuit.components[0].user_override_value || circuit.components[0].detected_value}
              </text>
            </g>
          )}

          {/* Wire Junction connecting R1 to Output / D1 / C1 */}
          <path d="M 410 90 L 520 90 L 520 140" fill="none" stroke="#38bdf8" strokeWidth="2.5" />
          <circle cx="520" cy="90" r="4" fill="#38bdf8" />

          {/* 3. Component 2: LED D1 or Resistor R2 or Capacitor C1 */}
          {circuit.components[1] && (
            <g
              transform="translate(520, 180)"
              onClick={() => handleComponentClick(circuit.components[1])}
              style={{ cursor: 'pointer' }}
            >
              {circuit.components[1].type.includes('LED') ? (
                // LED Symbol (Triangle + Anode/Cathode Line + Light Arrows)
                <g>
                  <line x1="0" y1="-40" x2="0" y2="-15" stroke="#38bdf8" strokeWidth="2.5" />
                  <polygon points="-15,-15 15,-15 0,15" fill="#f87171" stroke="#ef4444" strokeWidth="2" />
                  <line x1="-15" y1="15" x2="15" y2="15" stroke="#ef4444" strokeWidth="3" />
                  <line x1="0" y1="15" x2="0" y2="40" stroke="#38bdf8" strokeWidth="2.5" />

                  {/* Light Emission Arrows */}
                  <line x1="18" y1="-10" x2="28" y2="-20" stroke="#fbbf24" strokeWidth="2" />
                  <polygon points="28,-20 23,-17 26,-13" fill="#fbbf24" />
                  <line x1="22" y1="-2" x2="32" y2="-12" stroke="#fbbf24" strokeWidth="2" />
                  <polygon points="32,-12 27,-9 30,-5" fill="#fbbf24" />

                  <text x="35" y="0" fill="#f8fafc" fontSize="13" fontWeight="bold">{circuit.components[1].designator}</text>
                  <text x="35" y="15" fill="#f87171" fontSize="11">{circuit.components[1].user_override_value || circuit.components[1].detected_value}</text>
                </g>
              ) : circuit.components[1].type.includes('Capacitor') ? (
                // Capacitor Symbol (Parallel Plates)
                <g>
                  <line x1="0" y1="-40" x2="0" y2="-10" stroke="#38bdf8" strokeWidth="2.5" />
                  <line x1="-20" y1="-10" x2="20" y2="-10" stroke="#818cf8" strokeWidth="3.5" />
                  <line x1="-20" y1="10" x2="20" y2="10" stroke="#818cf8" strokeWidth="3.5" />
                  <line x1="0" y1="10" x2="0" y2="40" stroke="#38bdf8" strokeWidth="2.5" />

                  <text x="30" y="0" fill="#f8fafc" fontSize="13" fontWeight="bold">{circuit.components[1].designator}</text>
                  <text x="30" y="15" fill="#818cf8" fontSize="11">{circuit.components[1].user_override_value || circuit.components[1].detected_value}</text>
                </g>
              ) : (
                // Resistor R2 Symbol
                <g>
                  <line x1="0" y1="-40" x2="0" y2="-30" stroke="#38bdf8" strokeWidth="2.5" />
                  <polyline
                    points="0,-30 -12,-22 12,-14 -12,-6 12,2 -12,10 12,18 0,26"
                    fill="none"
                    stroke={selectedCompId === circuit.components[1].id ? '#fbbf24' : '#38bdf8'}
                    strokeWidth="2.5"
                  />
                  <line x1="0" y1="26" x2="0" y2="40" stroke="#38bdf8" strokeWidth="2.5" />

                  <text x="25" y="0" fill="#f8fafc" fontSize="13" fontWeight="bold">{circuit.components[1].designator}</text>
                  <text x="25" y="15" fill="#38bdf8" fontSize="11">{circuit.components[1].user_override_value || circuit.components[1].detected_value}</text>
                </g>
              )}
            </g>
          )}

          {/* Wire Return to Ground Rail */}
          <path d="M 520 220 L 520 260 L 80 260 L 80 230" fill="none" stroke="#38bdf8" strokeWidth="2.5" />
          <circle cx="520" cy="260" r="4" fill="#38bdf8" />
          <circle cx="80" cy="260" r="4" fill="#38bdf8" />

          {/* 4. Ground Symbol (3 Horizontal Decreasing Lines) */}
          <g transform="translate(300, 260)" style={{ cursor: 'pointer' }}>
            <line x1="0" y1="0" x2="0" y2="15" stroke="#38bdf8" strokeWidth="2.5" />
            <line x1="-20" y1="15" x2="20" y2="15" stroke="#34d399" strokeWidth="3" />
            <line x1="-12" y1="22" x2="12" y2="22" stroke="#34d399" strokeWidth="2.5" />
            <line x1="-5" y1="29" x2="5" y2="29" stroke="#34d399" strokeWidth="2" />
            <text x="28" y="20" fill="#34d399" fontSize="11" fontWeight="bold">GND (0V)</text>
          </g>
        </svg>
      </div>

      {/* Component Details Footer */}
      {selectedCompId && (
        <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(56, 189, 248, 0.05)', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--accent-cyan)' }}>
              Selected: {circuit.components.find(c => c.id === selectedCompId)?.designator}
            </span>
            <span style={{ marginLeft: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Value: {circuit.components.find(c => c.id === selectedCompId)?.user_override_value || circuit.components.find(c => c.id === selectedCompId)?.detected_value}
            </span>
          </div>
          <span className="code-pill">IEEE Symbol Valid</span>
        </div>
      )}
    </div>
  );
}
