import React, { useState, useEffect, useRef } from 'react';
import { 
  Cpu, 
  Zap, 
  Activity, 
  Wifi, 
  WifiOff, 
  AlertTriangle, 
  Power, 
  Sliders,
  ShieldCheck
} from 'lucide-react';
import '../styles/HardwareMonitor.css';
import { 
  fetchHardwareStatus, 
  sendMotorControlCommand, 
  connectHardwareWebSocket 
} from '../services/hardwareService';

export default function HardwareMonitor() {
  // Mode Selector: 'SIMULATION' | 'HARDWARE'
  const [mode, setMode] = useState('SIMULATION');

  // Real Hardware State
  const [hwConnected, setHwConnected] = useState(false);
  const [hwStatusText, setHwStatusText] = useState('DISCONNECTED');
  const [hwMessage, setHwMessage] = useState('Checking ESP32 hardware connection...');
  const [hwData, setHwData] = useState({
    m1_measured_mA: 0.00,
    m2_measured_mA: 0.00,
    total_measured_mA: 0.00,
    device_id: null,
    sensor_type: 'ACS712'
  });

  // Motor 1 Simulation State
  const [m1Target, setM1Target] = useState(false); // Switch active
  const [m1Status, setM1Status] = useState('OFF'); // 'OFF' | 'STARTING' | 'ON'
  const [m1Progress, setM1Progress] = useState(2); // Countdown seconds
  const m1TimerRef = useRef(null);
  const m1IntervalRef = useRef(null);

  // Motor 2 Simulation State
  const [m2Target, setM2Target] = useState(false); // Switch active
  const [m2Status, setM2Status] = useState('OFF'); // 'OFF' | 'STARTING' | 'ON'
  const [m2Progress, setM2Progress] = useState(2); // Countdown seconds
  const m2TimerRef = useRef(null);
  const m2IntervalRef = useRef(null);

  // Clean up all timers on unmount
  useEffect(() => {
    return () => {
      if (m1TimerRef.current) clearTimeout(m1TimerRef.current);
      if (m1IntervalRef.current) clearInterval(m1IntervalRef.current);
      if (m2TimerRef.current) clearTimeout(m2TimerRef.current);
      if (m2IntervalRef.current) clearInterval(m2IntervalRef.current);
    };
  }, []);

  // Poll or WebSocket connect in Hardware Mode
  useEffect(() => {
    let ws = null;
    let pollInterval = null;

    if (mode === 'HARDWARE') {
      const checkStatus = async () => {
        const res = await fetchHardwareStatus();
        if (res.connected) {
          setHwConnected(true);
          setHwStatusText('CONNECTED');
          setHwMessage(`ESP32 Connected (${res.device_id || 'DevKit'}) - ${res.sensor_type}`);
          setHwData({
            m1_measured_mA: res.m1_measured_mA || 0.00,
            m2_measured_mA: res.m2_measured_mA || 0.00,
            total_measured_mA: res.total_measured_mA || 0.00,
            device_id: res.device_id,
            sensor_type: res.sensor_type || 'ACS712'
          });
          setM1Target(!!res.m1_state);
          setM2Target(!!res.m2_state);
        } else {
          setHwConnected(false);
          setHwStatusText('DISCONNECTED');
          setHwMessage('Physical ESP32 hardware is not connected. Connect device or switch to Simulation Mode.');
        }
      };

      checkStatus();
      pollInterval = setInterval(checkStatus, 3000);

      ws = connectHardwareWebSocket(
        (data) => {
          if (data.connected || data.status === 'CONNECTED') {
            setHwConnected(true);
            setHwStatusText('CONNECTED');
            setHwMessage(`ESP32 Telemetry Active (${data.device_id || 'Device'})`);
            setHwData({
              m1_measured_mA: data.m1_measured_mA || 0.00,
              m2_measured_mA: data.m2_measured_mA || 0.00,
              total_measured_mA: data.total_measured_mA || 0.00,
              device_id: data.device_id,
              sensor_type: data.sensor_type || 'ACS712'
            });
          }
        },
        (err) => {}
      );
    } else {
      setHwStatusText('DEMO MODE');
      setHwMessage('Simulation Mode active. Displaying browser demonstration readings.');
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
      if (ws) ws.close();
    };
  }, [mode]);

  // Motor 1 Switch Toggle Handler
  const toggleMotor1 = async () => {
    if (mode === 'HARDWARE') {
      const targetState = !m1Target;
      setM1Target(targetState);
      const res = await sendMotorControlCommand('m1', targetState);
      if (res.status === 'ERROR' || !res.connected) {
        setHwMessage(`Hardware Error: ${res.message || 'ESP32 disconnected'}`);
        setHwConnected(false);
        setHwStatusText('DISCONNECTED');
      }
      return;
    }

    // Simulation Mode logic
    if (m1Target) {
      // Switch OFF immediately & cancel pending timer
      if (m1TimerRef.current) clearTimeout(m1TimerRef.current);
      if (m1IntervalRef.current) clearInterval(m1IntervalRef.current);
      m1TimerRef.current = null;
      m1IntervalRef.current = null;

      setM1Target(false);
      setM1Status('OFF');
      setM1Progress(2);
    } else {
      // Switch ON immediately (animations start right away, reading reveals after 2s)
      if (m1TimerRef.current) clearTimeout(m1TimerRef.current);
      if (m1IntervalRef.current) clearInterval(m1IntervalRef.current);

      setM1Target(true);
      setM1Status('STARTING');
      setM1Progress(2);

      m1IntervalRef.current = setInterval(() => {
        setM1Progress(prev => Math.max(0, prev - 1));
      }, 1000);

      m1TimerRef.current = setTimeout(() => {
        if (m1IntervalRef.current) clearInterval(m1IntervalRef.current);
        setM1Status('ON');
        setM1Progress(0);
        m1TimerRef.current = null;
      }, 2000);
    }
  };

  // Motor 2 Switch Toggle Handler
  const toggleMotor2 = async () => {
    if (mode === 'HARDWARE') {
      const targetState = !m2Target;
      setM2Target(targetState);
      const res = await sendMotorControlCommand('m2', targetState);
      if (res.status === 'ERROR' || !res.connected) {
        setHwMessage(`Hardware Error: ${res.message || 'ESP32 disconnected'}`);
        setHwConnected(false);
        setHwStatusText('DISCONNECTED');
      }
      return;
    }

    // Simulation Mode logic
    if (m2Target) {
      // Switch OFF immediately & cancel pending timer
      if (m2TimerRef.current) clearTimeout(m2TimerRef.current);
      if (m2IntervalRef.current) clearInterval(m2IntervalRef.current);
      m2TimerRef.current = null;
      m2IntervalRef.current = null;

      setM2Target(false);
      setM2Status('OFF');
      setM2Progress(2);
    } else {
      // Switch ON immediately
      if (m2TimerRef.current) clearTimeout(m2TimerRef.current);
      if (m2IntervalRef.current) clearInterval(m2IntervalRef.current);

      setM2Target(true);
      setM2Status('STARTING');
      setM2Progress(2);

      m2IntervalRef.current = setInterval(() => {
        setM2Progress(prev => Math.max(0, prev - 1));
      }, 1000);

      m2TimerRef.current = setTimeout(() => {
        if (m2IntervalRef.current) clearInterval(m2IntervalRef.current);
        setM2Status('ON');
        setM2Progress(0);
        m2TimerRef.current = null;
      }, 2000);
    }
  };

  // Calculate Display Currents & Status
  let displayM1Current = 0.00;
  let displayM2Current = 0.00;
  let displayTotalCurrent = 0.00;
  let overallStatus = 'IDLE';

  if (mode === 'SIMULATION') {
    displayM1Current = m1Status === 'ON' ? 20.31 : 0.00;
    displayM2Current = m2Status === 'ON' ? 13.10 : 0.00;
    displayTotalCurrent = displayM1Current + displayM2Current;

    if (m1Status === 'ON' && m2Status === 'ON') {
      overallStatus = 'BOTH ON';
    } else if (m1Status === 'STARTING' && m2Status === 'ON') {
      overallStatus = 'M1 STARTING / M2 ON';
    } else if (m2Status === 'STARTING' && m1Status === 'ON') {
      overallStatus = 'M1 ON / M2 STARTING';
    } else if (m1Status === 'STARTING' && m2Status === 'STARTING') {
      overallStatus = 'STARTING...';
    } else if (m1Status === 'STARTING') {
      overallStatus = 'M1 STARTING...';
    } else if (m2Status === 'STARTING') {
      overallStatus = 'M2 STARTING...';
    } else if (m1Status === 'ON') {
      overallStatus = 'M1 ON';
    } else if (m2Status === 'ON') {
      overallStatus = 'M2 ON';
    } else {
      overallStatus = 'IDLE';
    }
  } else {
    // Real Hardware Mode
    displayM1Current = hwData.m1_measured_mA;
    displayM2Current = hwData.m2_measured_mA;
    displayTotalCurrent = hwData.total_measured_mA;
    overallStatus = hwConnected ? (m1Target && m2Target ? 'BOTH ON' : m1Target ? 'M1 ON' : m2Target ? 'M2 ON' : 'IDLE') : 'DISCONNECTED';
  }

  return (
    <div className="hardware-monitor-container">
      {/* Top Header Navigation & Mode Selector */}
      <header className="hm-header">
        <div className="hm-title-section">
          <h1>
            <Zap style={{ color: 'var(--accent-cyan)' }} size={28} />
            AR DC Motor Current Monitor
          </h1>
          <p>Real-time electronic circuit visualization, animated current flow, and hardware telemetry.</p>
        </div>

        {/* Operating Mode Selector */}
        <div className="hm-mode-selector">
          <button 
            className={`hm-mode-btn ${mode === 'SIMULATION' ? 'active' : ''}`}
            onClick={() => setMode('SIMULATION')}
          >
            <Sliders size={16} />
            Simulation Mode
          </button>
          <button 
            className={`hm-mode-btn ${mode === 'HARDWARE' ? 'active hardware-mode' : ''}`}
            onClick={() => setMode('HARDWARE')}
          >
            <Cpu size={16} />
            Real Hardware Mode
          </button>
        </div>
      </header>

      {/* Mode & Status Indicator Banner */}
      <div className={`hm-status-banner ${mode === 'SIMULATION' ? 'simulation' : hwConnected ? 'connected' : 'disconnected'}`}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          {mode === 'SIMULATION' ? (
            <ShieldCheck size={18} />
          ) : hwConnected ? (
            <Wifi size={18} />
          ) : (
            <WifiOff size={18} />
          )}
          <span>
            <strong>{mode === 'SIMULATION' ? 'DEMONSTRATION SIMULATION MODE' : `HARDWARE STATUS: ${hwStatusText}`}</strong> — {hwMessage}
          </span>
        </div>
        {mode === 'SIMULATION' && (
          <span className="code-pill" style={{ background: 'rgba(56, 189, 248, 0.2)', color: 'var(--accent-cyan)' }}>
            DEMO READINGS
          </span>
        )}
        {mode === 'HARDWARE' && hwConnected && (
          <span className="code-pill" style={{ background: 'rgba(52, 211, 153, 0.2)', color: 'var(--accent-emerald)' }}>
            LIVE SENSOR
          </span>
        )}
      </div>

      {/* Main SVG Interactive Schematic Overlay */}
      <section className="hm-stage">
        <div className="hm-stage-badge-left">
          <Activity size={13} /> LIVE AR HARDWARE OVERLAY
        </div>
        <div className="hm-stage-badge-right">
          <span style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: mode === 'SIMULATION' ? 'var(--accent-cyan)' : hwConnected ? 'var(--accent-emerald)' : 'var(--accent-rose)',
            boxShadow: `0 0 8px ${mode === 'SIMULATION' ? 'var(--accent-cyan)' : hwConnected ? 'var(--accent-emerald)' : 'var(--accent-rose)'}`
          }} />
          {mode === 'SIMULATION' ? '● SIMULATED DEMO DATA' : hwConnected ? '● REAL SENSOR TELEMETRY' : '● ESP32 DISCONNECTED'}
        </div>

        {/* Total Current Floating Badge */}
        <div className="hm-total-badge">
          <span>TOTAL CURRENT:</span>
          <span style={{ fontFamily: 'var(--font-mono)' }}>{displayTotalCurrent.toFixed(2)} mA</span>
        </div>

        {/* SVG Schematic Canvas */}
        <svg className="hm-svg" viewBox="0 0 1200 470">
          <defs>
            <linearGradient id="motorGrad" x1="0" x2="1">
              <stop stopColor="#45565d" />
              <stop offset="0.28" stopColor="#c6e7eb" />
              <stop offset="0.6" stopColor="#587078" />
              <stop offset="1" stopColor="#25363d" />
            </linearGradient>
          </defs>

          {/* Main Power Rail & GND Wires */}
          <text x="58" y="92" className="hm-label">+VIN</text>
          <path id="top" className={`hm-wire ${m1Target || m2Target ? 'power' : ''}`} d="M82 106 H1120" />
          <path id="topFlow" className={`hm-flow ${m1Target || m2Target ? 'live' : ''}`} d="M82 106 H1120" />

          <path className="hm-wire" d="M82 398 H1120" />
          <text x="55" y="425" className="hm-label">GND</text>

          {/* ESP32 Controller Microcontroller Board */}
          <g className="hm-component">
            <rect x="950" y="166" width="150" height="118" rx="8" className="hm-pcb" />
            <path className="hm-boardline" d="M968 190h45v24h55m-98 30h78m-60-55v70" />
            <circle cx="1070" cy="190" r="7" fill="#2e3029" />
            <circle cx="1070" cy="244" r="7" fill="#d7ac35" />
            <text x="994" y="218" className="hm-label">ESP32</text>
            <text x="976" y="265" className="hm-small">DevKit / ADC</text>
            <path className="hm-wire" d="M1025 106V166M1025 284V398" />
          </g>

          {/* 7805 Voltage Regulator */}
          <g className="hm-component">
            <rect x="822" y="170" width="91" height="83" rx="7" fill="#202b30" stroke="#e2f6fa" strokeWidth="2" />
            <rect x="839" y="153" width="16" height="18" className="hm-metal" />
            <rect x="880" y="153" width="16" height="18" className="hm-metal" />
            <text x="838" y="203" className="hm-label">7805</text>
            <text x="832" y="224" className="hm-small">5V REG.</text>
            <path className="hm-wire" d="M868 106V153M868 253V398M913 211H950" />
          </g>

          {/* Capacitor C1 & Current Sense Resistor R1 */}
          <g className="hm-component">
            <path className="hm-wire" d="M214 106v72m-24 12h48m-48 15h48m-24 0v96" />
            <text x="177" y="167" className="hm-small">C1</text>
            <path d="M100 302h52l10-15 12 30 12-30 12 30 12-30 12 15h68" fill="none" stroke="#deb876" strokeWidth="6" />
            <text x="150" y="337" className="hm-small">R1 CURRENT SENSE</text>
            <path className="hm-wire" d="M100 302v96" />
          </g>

          {/* Motor 1 Wires & Flows */}
          <path id="m1line" className={`hm-wire ${m1Target ? 'power' : ''}`} d="M405 106v76m0 102v18H280v96" />
          <path id="m1flow" className={`hm-flow ${m1Target ? 'live' : ''}`} d="M405 106v76m0 102v18H280v96" />

          {/* Motor 2 Wires & Flows */}
          <path id="m2line" className={`hm-wire ${m2Target ? 'power' : ''}`} d="M660 106v76m0 102v18H280v96" />
          <path id="m2flow" className={`hm-flow ${m2Target ? 'live' : ''}`} d="M660 106v76m0 102v18H280v96" />

          {/* Switch 1 Representation */}
          <path d={m1Target ? "M387 170h37" : "M387 170l37 13"} stroke={m1Target ? "#43e7ff" : "#eaffff"} strokeWidth="4" />
          <text x="368" y="153" className="hm-small">SW1</text>

          {/* Switch 2 Representation */}
          <path d={m2Target ? "M642 170h37" : "M642 170l37 13"} stroke={m2Target ? "#43e7ff" : "#eaffff"} strokeWidth="4" />
          <text x="623" y="153" className="hm-small">SW2</text>

          {/* Motor 1 Physical Graphic */}
          <g id="motor1" className={`hm-motor hm-component ${m1Target ? 'spin' : 'off'} ${m1Target ? (m1Status === 'STARTING' ? 'starting' : 'on') : ''}`}>
            <rect x="349" y="182" width="111" height="102" rx="44" className="hm-motorcase" />
            <rect x="447" y="206" width="45" height="54" rx="5" className="hm-motorend" />
            <rect x="486" y="216" width="13" height="12" className="hm-terminal" />
            <rect x="486" y="239" width="13" height="12" className="hm-terminal" />
            <circle cx="405" cy="233" r="31" className="hm-metal" />
            <g className="hm-fan">
              <path d="M405 202c28 5 29 22 4 29-15-15-16-23-4-29m31 31c-5 28-22 29-29 4 15-15 23-16 29-4m-31 31c-28-5-29-22-4-29 15 15 16 23 4 29m-31-31c5-28 22-29 29-4-15 15-23 16-29 4" fill="#e9fcff" stroke="#1c4858" />
              <circle cx="405" cy="233" r="7" fill="#303c40" />
            </g>
            <text x="380" y="320" className="hm-label">M1 — DC MOTOR</text>
            <rect x="343" y="335" width="124" height="28" rx="6" className="hm-tag" />
            <text id="m1tag" x="352" y="354" className={`hm-read ${m1Status === 'STARTING' ? 'starting' : ''}`}>
              {mode === 'SIMULATION' ? (
                m1Status === 'STARTING' ? `STARTING (${m1Progress}s)...` : m1Status === 'ON' ? `ON • ${displayM1Current.toFixed(2)} mA` : 'OFF • 0.00 mA'
              ) : (
                m1Target ? `ON • ${displayM1Current.toFixed(2)} mA` : 'OFF • 0.00 mA'
              )}
            </text>
          </g>

          {/* Motor 2 Physical Graphic */}
          <g id="motor2" className={`hm-motor hm-component ${m2Target ? 'spin' : 'off'} ${m2Target ? (m2Status === 'STARTING' ? 'starting' : 'on') : ''}`}>
            <rect x="604" y="182" width="111" height="102" rx="44" className="hm-motorcase" />
            <rect x="702" y="206" width="45" height="54" rx="5" className="hm-motorend" />
            <rect x="741" y="216" width="13" height="12" className="hm-terminal" />
            <rect x="741" y="239" width="13" height="12" className="hm-terminal" />
            <circle cx="660" cy="233" r="31" className="hm-metal" />
            <g className="hm-fan">
              <path d="M660 202c28 5 29 22 4 29-15-15-16-23-4-29m31 31c-5 28-22 29-29 4 15-15 23-16 29-4m-31 31c-28-5-29-22-4-29 15 15 16 23 4 29m-31-31c5-28 22-29 29-4-15 15-23 16-29 4" fill="#e9fcff" stroke="#1c4858" />
              <circle cx="660" cy="233" r="7" fill="#303c40" />
            </g>
            <text x="635" y="320" className="hm-label">M2 — DC MOTOR</text>
            <rect x="598" y="335" width="124" height="28" rx="6" className="hm-tag" />
            <text id="m2tag" x="607" y="354" className={`hm-read ${m2Status === 'STARTING' ? 'starting' : ''}`}>
              {mode === 'SIMULATION' ? (
                m2Status === 'STARTING' ? `STARTING (${m2Progress}s)...` : m2Status === 'ON' ? `ON • ${displayM2Current.toFixed(2)} mA` : 'OFF • 0.00 mA'
              ) : (
                m2Target ? `ON • ${displayM2Current.toFixed(2)} mA` : 'OFF • 0.00 mA'
              )}
            </text>
          </g>
        </svg>
      </section>

      {/* Control Panel and Telemetry Grid */}
      <section className="hm-grid">
        {/* Left: Motor Controls */}
        <div className="hm-panel">
          <h2>
            <Power size={18} style={{ color: 'var(--accent-cyan)' }} />
            Motor Controls ({mode === 'SIMULATION' ? 'Browser Simulation' : 'ESP32 Control'})
          </h2>

          {/* Motor 1 Control Box */}
          <div className="hm-control-card">
            <div>
              <div className="hm-control-name">Motor 1 (M1)</div>
              <div className="hm-control-sub">
                {mode === 'SIMULATION' ? 'Demo Reading: 20.31 mA (2s startup delay)' : 'ESP32 Pin GPIO25 Current Sensor Channel 1'}
              </div>
            </div>
            <button 
              className={`hm-btn ${m1Target ? 'on' : ''}`}
              onClick={toggleMotor1}
            >
              <Power size={16} />
              {m1Target ? 'TURN OFF' : 'TURN ON'}
            </button>
          </div>

          {/* Motor 2 Control Box */}
          <div className="hm-control-card">
            <div>
              <div className="hm-control-name">Motor 2 (M2)</div>
              <div className="hm-control-sub">
                {mode === 'SIMULATION' ? 'Demo Reading: 13.10 mA (2s startup delay)' : 'ESP32 Pin GPIO26 Current Sensor Channel 2'}
              </div>
            </div>
            <button 
              className={`hm-btn ${m2Target ? 'on' : ''}`}
              onClick={toggleMotor2}
            >
              <Power size={16} />
              {m2Target ? 'TURN OFF' : 'TURN ON'}
            </button>
          </div>

          <p className="hm-note">
            💡 <strong>Operating Behavior:</strong> Turning Motor ON immediately activates rotation and current flow animation. In Simulation Mode, the current reading reveals after an exact 2-second startup delay.
          </p>
        </div>

        {/* Right: Telemetry & Readouts */}
        <div className="hm-panel">
          <h2>
            <Activity size={18} style={{ color: 'var(--accent-emerald)' }} />
            Current Telemetry Readouts
          </h2>

          <div className="hm-cards">
            <div className="hm-card">
              <span>Motor 1 Current</span>
              {mode === 'SIMULATION' && m1Status === 'STARTING' ? (
                <strong className="starting">STARTING...</strong>
              ) : (
                <strong>{displayM1Current.toFixed(2)} mA</strong>
              )}
            </div>

            <div className="hm-card">
              <span>Motor 2 Current</span>
              {mode === 'SIMULATION' && m2Status === 'STARTING' ? (
                <strong className="starting">STARTING...</strong>
              ) : (
                <strong>{displayM2Current.toFixed(2)} mA</strong>
              )}
            </div>

            <div className="hm-card totalcard">
              <span>Total Active Current</span>
              <strong>{displayTotalCurrent.toFixed(2)} mA</strong>
            </div>

            <div className="hm-card">
              <span>System Status</span>
              <strong style={{ fontSize: '1.15rem', color: overallStatus === 'BOTH ON' ? 'var(--accent-emerald)' : 'var(--accent-cyan)' }}>
                {overallStatus}
              </strong>
            </div>
          </div>

          <p className="hm-note">
            {mode === 'SIMULATION' ? (
              'Note: These values are demonstration readings (20.31 mA & 13.10 mA) with exact 2-second startup delays, not actual physical sensor measurements.'
            ) : (
              'Note: Communicating with physical ESP32 current sensor over HTTP/WebSocket API endpoints.'
            )}
          </p>
        </div>
      </section>

      {/* Hardware Safety Notice */}
      <section className="hm-hardware-notice">
        <h4>
          <AlertTriangle size={18} />
          Hardware Connection Notice
        </h4>
        <p>
          Do NOT connect a DC motor directly to ESP32 GPIO pins! GPIO pins can only deliver up to 40mA, which will damage the microcontroller. 
          Use a dedicated motor driver module (e.g., L298N, DRV8833, or MOSFET switch) with a separate motor power supply and an ACS712 or INA219 current sensor connected to the ESP32 ADC pin.
        </p>
      </section>
    </div>
  );
}
