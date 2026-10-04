import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Scan, 
  Activity, 
  Box, 
  Calculator, 
  FileCheck2, 
  GraduationCap, 
  Zap, 
  Cpu, 
  ShieldCheck, 
  ArrowRight,
  Sparkles
} from 'lucide-react';

export default function Home() {

  const features = [
    {
      title: 'Breadboard Scanner',
      desc: 'Capture or upload breadboard images for instant netlist identification.',
      icon: Scan,
      link: '/scanner',
      badge: 'Phase 2 Enhanced'
    },
    {
      title: 'Schematic Analyzer',
      desc: 'Inspect detected vs override component values, node topologies, and netlists.',
      icon: Activity,
      link: '/analysis',
      badge: 'Phase 2 Enhanced'
    },
    {
      title: '3D/2D Simulator',
      desc: 'Interactive 2D SVG breadboard workspace with voltage probe readouts.',
      icon: Box,
      link: '/simulator',
      badge: 'Phase 2 Enhanced'
    },
    {
      title: 'Electronics Calculators',
      desc: 'Working 4/5-band resistor decoders, Ohm’s Law, and LED current limiters.',
      icon: Calculator,
      link: '/calculator',
      badge: 'Interactive'
    },
    {
      title: 'Diagnostic Reports',
      desc: 'View comprehensive node voltages, thermal safety, and test point logs.',
      icon: FileCheck2,
      link: '/results',
      badge: 'Phase 2 Enhanced'
    },
    {
      title: 'Learning Modules',
      desc: 'Interactive electronics guides, component cheat sheets, and breadboard pinouts.',
      icon: GraduationCap,
      link: '/learn',
      badge: 'Interactive'
    }
  ];

  return (
    <div>
      {/* Hero Banner Section */}
      <section style={{ textAlign: 'center', padding: '2rem 1rem 3rem' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.35rem 0.85rem',
          background: 'rgba(56, 189, 248, 0.1)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          borderRadius: '9999px',
          color: 'var(--accent-cyan)',
          fontSize: '0.85rem',
          fontWeight: '600',
          marginBottom: '1.25rem'
        }}>
          <Zap size={14} /> Phase 2: Static UI & Interactive Mockup Workspace
        </div>
        
        <h1 style={{ fontSize: '2.5rem', fontWeight: '800', letterSpacing: '-0.03em', marginBottom: '1rem' }}>
          AI-Powered Electronics <span style={{ color: 'var(--accent-cyan)' }}>Circuit Platform</span>
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', maxWidth: '680px', margin: '0 auto 2rem' }}>
          SmartBreadboard 3D simplifies physical circuit recognition, node-by-node electrical analysis, 2D/3D breadboard simulation, and component math calculation.
        </p>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/scanner" className="btn btn-primary">
            <Scan size={18} /> Launch Scanner
          </Link>
          <Link to="/simulator" className="btn btn-secondary">
            <Box size={18} /> Open 2D Simulator
          </Link>
          <Link to="/calculator" className="btn btn-secondary">
            <Calculator size={18} /> Resistor / Ohm Calculator
          </Link>
        </div>
      </section>

      {/* Platform Quick Stats Widget */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2.5rem' }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="logo-icon" style={{ background: 'rgba(52, 211, 153, 0.1)', borderColor: 'var(--accent-emerald)', color: 'var(--accent-emerald)' }}>
            <Cpu size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>Live AI</div>
            <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>Webcam 3D Digital Twin</div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="logo-icon" style={{ background: 'rgba(56, 189, 248, 0.1)', borderColor: 'var(--accent-cyan)', color: 'var(--accent-cyan)' }}>
            <ShieldCheck size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>MNA Solver</div>
            <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>DC & Transient Analysis</div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="logo-icon" style={{ background: 'rgba(251, 191, 36, 0.1)', borderColor: 'var(--accent-amber)', color: 'var(--accent-amber)' }}>
            <Sparkles size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>Separate</div>
            <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>Detected vs Override Data</div>
          </div>
        </div>
      </section>


      {/* Platform Core Modules Grid */}
      <section>
        <h2 style={{ fontSize: '1.4rem', fontWeight: '700', marginBottom: '1.25rem' }}>Platform Workstation Modules</h2>
        <div className="card-grid">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <div key={i} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div className="logo-icon">
                    <Icon size={20} />
                  </div>
                  <span className="code-pill">{f.badge}</span>
                </div>
                <h3 style={{ fontSize: '1.15rem', marginBottom: '0.5rem' }}>{f.title}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
                  {f.desc}
                </p>
                <Link to={f.link} className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
                  Open Module &rarr;
                </Link>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
