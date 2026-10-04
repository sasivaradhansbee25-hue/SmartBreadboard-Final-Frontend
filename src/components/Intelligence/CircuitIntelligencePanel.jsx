import React, { useState } from 'react';
import { useCircuit } from '../../context/CircuitContext';
import WaveformCanvas from './WaveformCanvas';
import {
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Zap,
  Activity,
  BookOpen,
  HelpCircle,
  Layers,
  ChevronRight,
  Info,
  CheckCircle2,
  XCircle
} from 'lucide-react';

export default function CircuitIntelligencePanel({ className = '' }) {
  const {
    activeCircuit,
    circuitIntelligence,
    selectedComponent,
    setSelectedComponent,
    simulationResult
  } = useCircuit();

  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'parameters', 'waveform', 'lesson', 'topology'

  if (!circuitIntelligence) {
    return (
      <div className={`bg-slate-900/90 border border-slate-800 rounded-2xl p-5 text-slate-400 backdrop-blur-xl ${className}`}>
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 text-cyan-400 animate-spin" />
          <span>Analyzing circuit topology & electrical intelligence...</span>
        </div>
      </div>
    );
  }

  const { classification, electricalBehaviour, visualizationState, explanation } = circuitIntelligence;
  const isVerified = classification.verificationState === 'VERIFIED';
  const isPartiallyVerified = classification.verificationState === 'PARTIALLY_VERIFIED';
  const isUnsupported = classification.verificationState === 'UNSUPPORTED';
  const p = electricalBehaviour?.parameters || {};
  const waveforms = electricalBehaviour?.waveforms || [];

  return (
    <div className={`bg-slate-900/95 border border-slate-800/90 rounded-2xl shadow-2xl backdrop-blur-xl overflow-hidden flex flex-col ${className}`}>
      {/* Header Banner */}
      <div className="p-4 border-b border-slate-800/80 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white text-base tracking-tight">
                {classification.displayName}
              </h3>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {classification.category}
              </span>
            </div>
            <p className="text-xs text-slate-400 line-clamp-1">
              {explanation?.summary || 'Context-Aware Circuit Intelligence & AR Learning Engine'}
            </p>
          </div>
        </div>

        {/* Verification State Badge */}
        <div>
          {isVerified && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <ShieldCheck className="w-3.5 h-3.5" />
              TOPOLOGY VERIFIED
            </span>
          )}
          {isPartiallyVerified && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <AlertTriangle className="w-3.5 h-3.5" />
              PARTIALLY VERIFIED
            </span>
          )}
          {isUnsupported && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/30">
              <Info className="w-3.5 h-3.5" />
              UNSUPPORTED MODEL
            </span>
          )}
          {!isVerified && !isPartiallyVerified && !isUnsupported && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
              <XCircle className="w-3.5 h-3.5" />
              NOT VERIFIED
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800/80 bg-slate-950/60 px-4 text-xs font-medium">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-3 py-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'overview'
              ? 'border-cyan-400 text-cyan-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Overview & Roles
        </button>
        <button
          onClick={() => setActiveTab('parameters')}
          className={`px-3 py-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'parameters'
              ? 'border-cyan-400 text-cyan-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          Theoretical vs MNA
        </button>
        {waveforms.length > 0 && (
          <button
            onClick={() => setActiveTab('waveform')}
            className={`px-3 py-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'waveform'
                ? 'border-cyan-400 text-cyan-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Waveforms ({waveforms.length})
          </button>
        )}
        <button
          onClick={() => setActiveTab('lesson')}
          className={`px-3 py-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'lesson'
              ? 'border-cyan-400 text-cyan-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          Educational Guide
        </button>
      </div>

      {/* Tab Content Body */}
      <div className="p-4 overflow-y-auto max-h-[420px] space-y-4">
        {/* Warning Banner if Unverified */}
        {!isVerified && (
          <div className="bg-amber-950/30 border border-amber-500/40 rounded-xl p-3 text-xs text-amber-300 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-amber-200">
                {isUnsupported ? 'Unsupported Electrical Solver Model' : 'Circuit Topology Not Fully Verified'}
              </div>
              <p className="text-amber-300/90 mt-0.5">
                {classification.warnings?.[0] || 'Educational animations remain suspended to prevent simulated inaccuracies.'}
              </p>
              {classification.missingRequirements?.length > 0 && (
                <ul className="list-disc list-inside mt-1.5 space-y-0.5 text-amber-400/90 font-mono text-[11px]">
                  {classification.missingRequirements.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* TAB 1: OVERVIEW & COMPONENT ROLES */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5">
              <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-cyan-400" />
                Circuit Function & Role
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {explanation?.purpose || 'Electronic signal and power processing topology.'}
              </p>
              {explanation?.formulaSummary && (
                <div className="mt-2.5 p-2 rounded-lg bg-slate-900 border border-slate-700/80 font-mono text-cyan-300 text-xs text-center font-bold">
                  {explanation.formulaSummary}
                </div>
              )}
            </div>

            {/* Component Roles Breakdown */}
            <div>
              <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Component Circuit Roles
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {explanation?.keyComponents?.map((kc, idx) => (
                  <div key={idx} className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 hover:border-cyan-500/40 transition-colors">
                    <div className="font-semibold text-cyan-300 text-xs mb-1 flex items-center justify-between">
                      <span>{kc.name}</span>
                      <span className="text-[10px] font-mono bg-cyan-950 text-cyan-400 px-1.5 py-0.5 rounded border border-cyan-800/60">
                        Active Role
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {kc.role}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Visual Guide Cue */}
            {explanation?.visualGuide && (
              <div className="bg-cyan-950/20 border border-cyan-500/30 rounded-xl p-3 text-xs text-cyan-300/90 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-cyan-200">AR & 3D Visual Cues: </span>
                  {explanation.visualGuide}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: THEORETICAL VS SIMULATED PARAMETERS */}
        {activeTab === 'parameters' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
              <span>Deterministic Theoretical Calculation</span>
              <span className="font-mono text-cyan-400">Zero Synthetic Measurements</span>
            </div>

            <div className="border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800/80 bg-slate-950/60">
              {Object.entries(p).map(([key, item]) => {
                if (!item || typeof item !== 'object' || item.value === undefined) return null;
                return (
                  <div key={key} className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-900/50">
                    <div>
                      <div className="font-medium text-slate-200">{item.label || key}</div>
                      <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1.5 mt-0.5">
                        <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                          {item.source}
                        </span>
                        <span>• is_measured: false</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-cyan-300 text-sm">
                        {item.formatted || `${item.value} ${item.unit || ''}`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="bg-slate-950/40 border border-slate-800/60 rounded-xl p-3 text-[11px] text-slate-400">
              <span className="font-semibold text-slate-300">Scientific Integrity Notice: </span>
              {explanation?.measurementDisclaimer || 'All parameters shown are purely theoretical or MNA simulated.'}
            </div>
          </div>
        )}

        {/* TAB 3: WAVEFORMS */}
        {activeTab === 'waveform' && waveforms.length > 0 && (
          <div className="space-y-3">
            {waveforms.map((wf, idx) => (
              <WaveformCanvas key={idx} waveform={wf} width={450} height={180} />
            ))}
          </div>
        )}

        {/* TAB 4: EDUCATIONAL GUIDE & WHAT-IF */}
        {activeTab === 'lesson' && (
          <div className="space-y-4 text-xs">
            {/* Governing Equations */}
            <div className="space-y-2">
              <div className="font-semibold text-slate-300 uppercase tracking-wider">
                Governing Equations & Calculations
              </div>
              {explanation?.governingEquations?.map((eq, idx) => (
                <div key={idx} className="bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono">
                  <div className="text-cyan-400 font-bold mb-1">{eq.equation}</div>
                  <div className="text-slate-400 text-[11px]">{eq.substituted}</div>
                </div>
              ))}
            </div>

            {/* What-If Sensitivity Prediction */}
            {explanation?.whatIfAnalysis && (
              <div className="bg-purple-950/20 border border-purple-500/30 rounded-xl p-3.5">
                <div className="font-semibold text-purple-300 uppercase tracking-wider text-[11px] mb-1 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  What-If Sensitivity Analysis
                </div>
                <p className="text-purple-200/90 leading-relaxed text-xs">
                  {explanation.whatIfAnalysis}
                </p>
              </div>
            )}

            {/* Real World Applications */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
              <div className="font-semibold text-slate-300 uppercase tracking-wider text-[11px] mb-1">
                Real-World Applications
              </div>
              <p className="text-slate-400 text-xs">
                {explanation?.application || 'Everyday electronic instrumentation and consumer products.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
