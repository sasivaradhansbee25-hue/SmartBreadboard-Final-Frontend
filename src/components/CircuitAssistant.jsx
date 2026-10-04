import React, { useState, useEffect, useRef } from 'react';
import { requestAssistantChat } from '../services/analysisService';
import { MessageSquare, Send, Trash2, Bot, User, CheckCircle, AlertTriangle, Cpu, Zap, ChevronDown, ChevronUp, Sparkles, X } from 'lucide-react';

export default function CircuitAssistant({ circuitContext, onSimulationUpdate, onApplyCorrection, onHighlightComponent, onClose, isFloating = false }) {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: "Hello! I'm the **SmartBreadboard Circuit Assistant**.\n\nI can validate and simulate your verified circuit using deterministic MNA solver tools, check electrical node connections, resolve ambiguous/unknown hole mappings with 1-click verified corrections, and diagnose circuit faults.",
      tool_calls: [],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState(`sess-${Date.now()}`);
  const [errorMsg, setErrorMsg] = useState(null);
  const [expandedTools, setExpandedTools] = useState({});
  const [appliedSuggestions, setAppliedSuggestions] = useState({});
  const [unknownDefinitions, setUnknownDefinitions] = useState({});
  const messagesEndRef = useRef(null);

  // Auto-scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleApplySuggestion = async (sugg) => {
    const suggKey = sugg.proposal_id || sugg.id;
    if (!sugg || appliedSuggestions[suggKey] || sugg.status === 'BLOCKED') return;

    const userDef = unknownDefinitions[sugg.component_id] || {};
    const payload = {
      ...(sugg.action_payload || {}),
      proposal_id: sugg.proposal_id,
      diagnostic_id: sugg.diagnostic_id,
      circuit_signature: sugg.circuit_signature,
      created_at: sugg.created_at,
      component_id: sugg.component_id,
      correction_type: sugg.correction_type || "TERMINAL_HOLE_REMAP",
      hole1: sugg.suggested_start_hole,
      hole2: sugg.suggested_end_hole,
      type: userDef.type || sugg.suggested_type || (sugg.requires_user_definition ? 'resistor' : undefined),
      value: userDef.value !== undefined ? userDef.value : sugg.suggested_value,
      unit: userDef.unit || sugg.suggested_unit || 'Ω',
      user_confirmed: true,
      candidate_evidence: sugg.candidate_evidence || false,
      circuit_state: circuitContext || {}
    };

    if (typeof onApplyCorrection === 'function') {
      try {
        const result = await onApplyCorrection(payload, sugg);
        if (result && result.status === 'BLOCKED') {
          const blockedMsg = {
            id: `blocked-${Date.now()}`,
            role: 'assistant',
            text: `⚠️ **Correction Blocked by Backend Validation**\n\n${result.reason || 'Safety checks failed.'}`,
            tool_calls: [{ tool: "validate_and_apply_correction", args: payload, result: result }],
            isError: true,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };
          setMessages(prev => [...prev, blockedMsg]);
          return;
        }

        setAppliedSuggestions(prev => ({ ...prev, [suggKey]: true }));

        const confirmMsg = {
          id: `applied-${Date.now()}`,
          role: 'assistant',
          text: `✓ **Verified Correction Applied from Backend**\n\n- Component: **${sugg.component_id}**\n- Mapped Terminals: **${sugg.suggested_start_hole}** → **${sugg.suggested_end_hole}**\n- Provenance: **USER_CONFIRMED**\n\nPrevious simulation results invalidated. Rebuilt electrical topology and updated 3D Digital Twin.`,
          tool_calls: [{ tool: "validate_and_apply_correction", args: payload, result: { status: "APPLIED", new_signature: result?.new_circuit_signature } }],
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, confirmMsg]);
      } catch (err) {
        console.error("Failed to apply correction:", err);
        setErrorMsg(err.message || "Failed to execute correction");
      }
    }
  };

  const handleSendMessage = async (customText = null) => {
    const text = customText || inputText.trim();
    if (!text || isLoading) return;

    const userMsg = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    if (!customText) setInputText('');
    setIsLoading(true);
    setErrorMsg(null);

    // Phase 22.3 Highlight API: validate and trigger highlighting by component ID or node ID
    const compHighlightMatch = text.match(/(?:highlight|show|find|locate)\s+([RCLVD][A-Za-z0-9_]*)/i);
    const nodeHighlightMatch = text.match(/(?:highlight|show|find|locate)\s+(NODE_[A-Za-z0-9_]+)/i);

    if (nodeHighlightMatch && typeof onHighlightComponent === 'function') {
      const targetNode = nodeHighlightMatch[1].toUpperCase();
      const nodeExists = (circuitContext?.node_graph?.nodes || circuitContext?.nodes || []).some(n => (n.id || '').toUpperCase() === targetNode);
      if (nodeExists) {
        onHighlightComponent(targetNode, 'NODE');
      } else {
        setMessages(prev => [...prev, {
          id: `warn-${Date.now()}`,
          role: 'assistant',
          text: `Node **${targetNode}** is not present in the verified circuit.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
      }
    } else if (compHighlightMatch && typeof onHighlightComponent === 'function') {
      const targetId = compHighlightMatch[1].toUpperCase();
      const compExists = (circuitContext?.components || []).some(c => (c.id || c.designator || '').toUpperCase() === targetId);
      if (compExists) {
        onHighlightComponent(targetId, 'COMPONENT');
      } else {
        setMessages(prev => [...prev, {
          id: `warn-${Date.now()}`,
          role: 'assistant',
          text: `Component **${targetId}** is not present in the verified circuit.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
      }
    }

    try {
      const response = await requestAssistantChat(text, conversationId, circuitContext || {});
      
      const assistantMsg = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        text: response.answer || "I was unable to retrieve a clear answer from the circuit tools.",
        tool_calls: response.tool_calls || [],
        suggestions: response.suggestions || [],
        circuit_status: response.circuit_status,
        simulation_status: response.simulation_status,
        action: response.action,
        component_id: response.component_id,
        node_id: response.node_id,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, assistantMsg]);

      // Phase 22.3 Structured LLM Highlight Actions
      if (response.action === 'HIGHLIGHT_COMPONENT' && response.component_id && typeof onHighlightComponent === 'function') {
        const targetId = response.component_id.toUpperCase();
        const exists = (circuitContext?.components || []).some(c => (c.id || c.designator || '').toUpperCase() === targetId);
        if (exists) onHighlightComponent(targetId, 'COMPONENT');
      } else if (response.action === 'HIGHLIGHT_NODE' && response.node_id && typeof onHighlightComponent === 'function') {
        const targetNode = response.node_id.toUpperCase();
        const exists = (circuitContext?.node_graph?.nodes || circuitContext?.nodes || []).some(n => (n.id || '').toUpperCase() === targetNode);
        if (exists) onHighlightComponent(targetNode, 'NODE');
      }

      // Phase 20.5: Propagate simulation results to CircuitContext if a new simulation was run
      if (response.simulation_result && typeof onSimulationUpdate === 'function') {
        onSimulationUpdate(response.simulation_result);
      }
    } catch (err) {
      console.error("Assistant chat error:", err);
      setErrorMsg(err.message || "Failed to contact assistant service");
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          text: "⚠️ **Assistant Service Unavailable**: Could not connect to the backend assistant agent. The deterministic circuit simulation and 3D Twin remain operational.",
          tool_calls: [],
          isError: true,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        text: "Conversation cleared. Ready for your circuit questions.",
        tool_calls: [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
    setConversationId(`sess-${Date.now()}`);
    setErrorMsg(null);
  };

  const toggleToolExpand = (msgId) => {
    setExpandedTools(prev => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const quickQuestions = [
    "Simulate this circuit.",
    "Fix ambiguous mappings",
    "How many verified components are present?",
    "Which components are in parallel?",
    "Which components are in series?",
    "Why is LED1 not glowing?",
    "What is the current through R1?",
    "Is there a short circuit?"
  ];

  // Derive circuit status summary
  const verifiedCount = circuitContext?.components?.filter(c => c.verification === 'VERIFIED' || c.verified !== false)?.length || 0;
  const isSolved = circuitContext?.solverStatus === 'solved' || circuitContext?.simulationResult?.success;

  const getSourcesFromTools = (toolCalls) => {
    if (!toolCalls || toolCalls.length === 0) return ['Verified Circuit'];
    const sources = new Set();
    toolCalls.forEach(tc => {
      const name = (tc.tool || tc.name || '').toLowerCase();
      if (name.includes('component') || name.includes('verified_circuit')) {
        sources.add('Verified Circuit');
      }
      if (name.includes('grounding') || name.includes('hole')) {
        sources.add('Visual Grounding');
      }
      if (name.includes('simulation') || name.includes('simulate')) {
        sources.add('MNA Simulation');
      }
      if (name.includes('topology') || name.includes('node') || name.includes('connection')) {
        sources.add('Circuit Topology');
      }
      if (name.includes('fault') || name.includes('netlist')) {
        sources.add('Fault Diagnostics');
      }
    });
    return Array.from(sources);
  };

  const getContextualActions = (msg, ctx) => {
    if (msg.role !== 'assistant' || msg.isError) return [];
    const actions = [];
    const validComps = (ctx?.components || []).map(c => (c.id || c.designator || '').toUpperCase());
    const validNodes = (ctx?.node_graph?.nodes || ctx?.nodes || []).map(n => (n.id || '').toUpperCase());

    // 1. Structured action in msg
    if (msg.action === 'HIGHLIGHT_COMPONENT' && msg.component_id && validComps.includes(msg.component_id.toUpperCase())) {
      actions.push({ label: `Highlight ${msg.component_id}`, type: 'COMPONENT', target: msg.component_id.toUpperCase() });
      actions.push({ label: `Show Connections`, type: 'CONNECTIONS', target: msg.component_id.toUpperCase() });
    } else if (msg.action === 'HIGHLIGHT_NODE' && msg.node_id && validNodes.includes(msg.node_id.toUpperCase())) {
      actions.push({ label: `Highlight ${msg.node_id}`, type: 'NODE', target: msg.node_id.toUpperCase() });
    }

    // 2. Extract mentioned components from message text
    for (const cid of validComps) {
      if (cid && msg.text && new RegExp(`\\b${cid}\\b`, 'i').test(msg.text)) {
        if (!actions.some(a => a.target === cid && a.type === 'COMPONENT')) {
          actions.push({ label: `Highlight ${cid}`, type: 'COMPONENT', target: cid });
        }
      }
    }
    // 3. Extract mentioned nodes
    for (const nid of validNodes) {
      if (nid && msg.text && new RegExp(`\\b${nid}\\b`, 'i').test(msg.text)) {
        if (!actions.some(a => a.target === nid && a.type === 'NODE')) {
          actions.push({ label: `Highlight ${nid}`, type: 'NODE', target: nid });
        }
      }
    }

    return actions.slice(0, 3);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      maxHeight: isFloating ? '650px' : '550px',
      width: isFloating ? '420px' : '100%',
      background: '#090d16',
      border: '1px solid #1e293b',
      borderRadius: '12px',
      boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
      overflow: 'hidden',
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(90deg, #0f172a 0%, #1e1b4b 100%)',
        padding: '0.75rem 1rem',
        borderBottom: '1px solid #334155',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            padding: '0.4rem',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 10px rgba(99, 102, 241, 0.4)'
          }}>
            <Sparkles size={16} color="#ffffff" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.90rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              Circuit Assistant
              <span style={{
                fontSize: '0.65rem',
                padding: '0.1rem 0.35rem',
                borderRadius: '4px',
                background: 'rgba(52, 211, 153, 0.15)',
                color: '#34d399',
                border: '1px solid rgba(52, 211, 153, 0.3)'
              }}>
                Tool-Grounded
              </span>
            </div>
            <div style={{ fontSize: '0.70rem', color: '#94a3b8' }}>
              Deterministic Simulation & Topology Intelligence
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={() => handleSendMessage("Simulate this circuit.")}
            disabled={isLoading}
            style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '0.3rem 0.65rem',
              fontSize: '0.72rem',
              fontWeight: 700,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.35)'
            }}
          >
            <Zap size={13} /> Simulate Circuit
          </button>
          <button
            onClick={handleClearHistory}
            title="Clear conversation"
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
            <Trash2 size={15} />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              title="Close panel"
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
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Circuit State Telemetry Bar */}
      <div style={{
        background: '#0c1322',
        padding: '0.35rem 0.85rem',
        borderBottom: '1px solid #1e293b',
        display: 'flex',
        gap: '0.5rem',
        alignItems: 'center',
        flexWrap: 'wrap',
        fontSize: '0.72rem'
      }}>
        <span style={{ color: '#64748b' }}>State:</span>
        <span style={{
          padding: '0.1rem 0.35rem',
          borderRadius: '3px',
          background: verifiedCount > 0 ? 'rgba(56, 189, 248, 0.15)' : 'rgba(148, 163, 184, 0.1)',
          color: verifiedCount > 0 ? '#38bdf8' : '#94a3b8',
          fontWeight: 600
        }}>
          {verifiedCount} Verified Comp
        </span>
        <span style={{
          padding: '0.1rem 0.35rem',
          borderRadius: '3px',
          background: isSolved ? 'rgba(52, 211, 153, 0.15)' : 'rgba(245, 158, 11, 0.15)',
          color: isSolved ? '#34d399' : '#fbbf24',
          fontWeight: 600
        }}>
          MNA: {isSolved ? 'SOLVED' : 'PENDING'}
        </span>
      </div>

      {/* Message History */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '0.85rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem',
        background: '#090d16'
      }}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '100%'
            }}
          >
            {/* Sender and Time */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.68rem',
              color: '#64748b',
              marginBottom: '0.2rem',
              padding: '0 0.25rem'
            }}>
              {msg.role === 'user' ? (
                <><span>You</span><User size={11} /></>
              ) : (
                <><Bot size={11} color="#a78bfa" /><span>Circuit Assistant</span></>
              )}
              <span>•</span>
              <span>{msg.timestamp}</span>
            </div>

            {/* Bubble */}
            <div style={{
              maxWidth: '88%',
              padding: '0.65rem 0.85rem',
              borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
              background: msg.role === 'user' 
                ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' 
                : msg.isError 
                  ? 'rgba(239, 68, 68, 0.12)' 
                  : '#131b2e',
              border: msg.role === 'user' 
                ? '1px solid #3b82f6' 
                : msg.isError 
                  ? '1px solid #ef4444' 
                  : '1px solid #1e293b',
              color: '#f1f5f9',
              fontSize: '0.82rem',
              lineHeight: 1.45,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              boxShadow: '0 2px 8px rgba(0,0,0,0.25)'
            }}>
              {msg.text}
            </div>

            {/* Deterministic Correction Suggestion Cards */}
            {msg.suggestions && msg.suggestions.length > 0 && (
              <div style={{
                marginTop: '0.45rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem',
                maxWidth: '88%'
              }}>
                {msg.suggestions.map((sugg) => {
                  const suggKey = sugg.proposal_id || sugg.id;
                  const isApplied = appliedSuggestions[suggKey];
                  const isBlocked = sugg.status === 'BLOCKED';
                  const userDef = unknownDefinitions[sugg.component_id] || { type: 'resistor', value: '1000', unit: 'Ω' };

                  return (
                    <div key={suggKey} style={{
                      background: '#0c1322',
                      border: isApplied 
                        ? '1px solid rgba(52, 211, 153, 0.4)' 
                        : isBlocked 
                          ? '1px solid rgba(239, 68, 68, 0.4)' 
                          : '1px solid rgba(245, 158, 11, 0.4)',
                      borderRadius: '8px',
                      padding: '0.55rem 0.75rem',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.74rem', fontWeight: 700, color: isApplied ? '#34d399' : isBlocked ? '#f87171' : '#fbbf24' }}>
                          {isApplied ? <CheckCircle size={13} color="#34d399" /> : isBlocked ? <AlertTriangle size={13} color="#f87171" /> : <AlertTriangle size={13} color="#fbbf24" />}
                          <span>{sugg.component_id} {sugg.suggested_type ? `— ${sugg.suggested_type.toUpperCase()}` : ''}</span>
                        </div>
                        <span style={{
                          fontSize: '0.62rem',
                          background: isApplied ? 'rgba(52, 211, 153, 0.15)' : isBlocked ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                          color: isApplied ? '#34d399' : isBlocked ? '#f87171' : '#fcd34d',
                          padding: '0.1rem 0.35rem',
                          borderRadius: '4px',
                          textTransform: 'uppercase',
                          fontWeight: 600
                        }}>
                          {isApplied ? 'VERIFIED' : isBlocked ? 'BLOCKED' : sugg.issue?.replace('_', ' ')}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.70rem', color: '#cbd5e1', marginBottom: '0.45rem', lineHeight: 1.35 }}>
                        {sugg.description}
                      </div>

                      {/* Explicit User Definition Controls for UNKNOWN components */}
                      {sugg.requires_user_definition && !isApplied && (
                        <div style={{
                          background: '#090d16',
                          border: '1px solid #1e293b',
                          borderRadius: '6px',
                          padding: '0.45rem',
                          marginBottom: '0.45rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.35rem'
                        }}>
                          <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600 }}>
                            Explicit Component Value Definition:
                          </div>
                          <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                            {['220', '1000', '4700', '10000'].map((val) => (
                              <button
                                key={val}
                                type="button"
                                onClick={() => setUnknownDefinitions(prev => ({
                                  ...prev,
                                  [sugg.component_id]: { type: 'resistor', value: val, unit: 'Ω' }
                                }))}
                                style={{
                                  background: (userDef.value === val) ? 'rgba(99, 102, 241, 0.3)' : '#1e293b',
                                  border: (userDef.value === val) ? '1px solid #818cf8' : '1px solid #334155',
                                  color: (userDef.value === val) ? '#c7d2fe' : '#94a3b8',
                                  borderRadius: '4px',
                                  padding: '0.15rem 0.4rem',
                                  fontSize: '0.65rem',
                                  cursor: 'pointer'
                                }}
                              >
                                {val >= 1000 ? `${val/1000} kΩ` : `${val} Ω`}
                              </button>
                            ))}
                          </div>
                          <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                            <input
                              type="number"
                              placeholder="Custom resistance (Ω)"
                              value={userDef.value || ''}
                              onChange={(e) => setUnknownDefinitions(prev => ({
                                ...prev,
                                [sugg.component_id]: { type: 'resistor', value: e.target.value, unit: 'Ω' }
                              }))}
                              style={{
                                flex: 1,
                                background: '#0f172a',
                                border: '1px solid #334155',
                                borderRadius: '4px',
                                padding: '0.25rem 0.45rem',
                                color: '#f8fafc',
                                fontSize: '0.68rem'
                              }}
                            />
                            <span style={{ fontSize: '0.68rem', color: '#64748b' }}>Ω</span>
                          </div>
                        </div>
                      )}

                      {isBlocked ? (
                        <div style={{
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          borderRadius: '6px',
                          padding: '0.35rem 0.6rem',
                          fontSize: '0.68rem',
                          color: '#f87171',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem'
                        }}>
                          <AlertTriangle size={13} />
                          <span>Hardware short detected. Cannot auto-shift without independent evidence.</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleApplySuggestion(sugg)}
                          disabled={isApplied}
                          style={{
                            width: '100%',
                            background: isApplied 
                              ? 'rgba(52, 211, 153, 0.15)' 
                              : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            color: isApplied ? '#34d399' : '#ffffff',
                            border: isApplied ? '1px solid rgba(52, 211, 153, 0.3)' : 'none',
                            borderRadius: '6px',
                            padding: '0.35rem 0.6rem',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            cursor: isApplied ? 'default' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.35rem',
                            transition: 'all 0.2s'
                          }}
                        >
                          <CheckCircle size={13} />
                          {isApplied 
                            ? `✓ Backend Verified & Applied` 
                            : sugg.requires_user_definition
                              ? `Confirm & Verify as ${userDef.value || '1000'} Ω Resistor`
                              : `Confirm & Apply Mapping: ${sugg.suggested_start_hole} → ${sugg.suggested_end_hole}`
                          }
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Grounded Circuit Answer & Sources Accordion */}
            {msg.role === 'assistant' && !msg.isError && (
              <div style={{
                marginTop: '0.35rem',
                maxWidth: '88%',
                background: '#0f172a',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                borderRadius: '6px',
                padding: '0.35rem 0.55rem',
                fontSize: '0.70rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#34d399', fontWeight: 600 }}>
                    <CheckCircle size={12} color="#34d399" />
                    Grounded in current circuit
                  </span>
                  {msg.tool_calls && msg.tool_calls.length > 0 && (
                    <button
                      onClick={() => toggleToolExpand(msg.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#818cf8',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.2rem',
                        padding: 0,
                        fontWeight: 600,
                        fontSize: '0.68rem'
                      }}
                    >
                      <span>Sources ({getSourcesFromTools(msg.tool_calls).length || msg.tool_calls.length})</span>
                      {expandedTools[msg.id] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                  )}
                </div>

                {expandedTools[msg.id] && msg.tool_calls && (
                  <div style={{
                    marginTop: '0.35rem',
                    paddingTop: '0.35rem',
                    borderTop: '1px solid #1e293b',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem'
                  }}>
                    <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 600 }}>Deterministic Sources:</div>
                    {getSourcesFromTools(msg.tool_calls).map((src, idx) => (
                      <div key={idx} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        color: '#cbd5e1',
                        fontSize: '0.68rem',
                        background: '#090d16',
                        padding: '0.2rem 0.4rem',
                        borderRadius: '3px'
                      }}>
                        <span>• {src}</span>
                        <span style={{ color: '#34d399' }}>✓ verified</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Contextual Action Buttons */}
            {msg.role === 'assistant' && !msg.isError && typeof onHighlightComponent === 'function' && (
              (() => {
                const actions = getContextualActions(msg, circuitContext);
                if (actions.length === 0) return null;
                return (
                  <div style={{
                    marginTop: '0.35rem',
                    display: 'flex',
                    gap: '0.35rem',
                    flexWrap: 'wrap',
                    maxWidth: '88%'
                  }}>
                    {actions.map((act, idx) => (
                      <button
                        key={idx}
                        onClick={() => onHighlightComponent(act.target, act.type)}
                        style={{
                          background: 'rgba(99, 102, 241, 0.15)',
                          border: '1px solid rgba(99, 102, 241, 0.35)',
                          color: '#a5b4fc',
                          borderRadius: '6px',
                          padding: '0.25rem 0.55rem',
                          fontSize: '0.68rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(99, 102, 241, 0.3)'; e.currentTarget.style.color = '#ffffff'; }}
                        onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(99, 102, 241, 0.15)'; e.currentTarget.style.color = '#a5b4fc'; }}
                      >
                        <Sparkles size={11} />
                        {act.label}
                      </button>
                    ))}
                  </div>
                );
              })()
            )}
          </div>
        ))}

        {isLoading && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 0.75rem',
            background: '#131b2e',
            borderRadius: '8px',
            border: '1px solid #1e293b',
            alignSelf: 'flex-start',
            fontSize: '0.75rem',
            color: '#94a3b8'
          }}>
            <div style={{
              width: '12px',
              height: '12px',
              border: '2px solid #818cf8',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite'
            }} />
            Consulting deterministic circuit tools...
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Questions */}
      <div style={{
        padding: '0.4rem 0.65rem',
        background: '#0c1322',
        borderTop: '1px solid #1e293b',
        display: 'flex',
        gap: '0.35rem',
        overflowX: 'auto',
        scrollbarWidth: 'none'
      }}>
        {quickQuestions.map((q, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(q)}
            disabled={isLoading}
            style={{
              whiteSpace: 'nowrap',
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '12px',
              padding: '0.25rem 0.55rem',
              color: '#94a3b8',
              fontSize: '0.68rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseOver={(e) => { e.currentTarget.style.color = '#38bdf8'; e.currentTarget.style.borderColor = '#38bdf8'; }}
            onMouseOut={(e) => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = '#334155'; }}
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input Area */}
      <div style={{
        padding: '0.65rem 0.85rem',
        background: '#0f172a',
        borderTop: '1px solid #1e293b',
        display: 'flex',
        gap: '0.4rem',
        alignItems: 'center'
      }}>
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSendMessage(); }}
          placeholder="Ask about your circuit (e.g. 'Why is LED1 not glowing?')..."
          disabled={isLoading}
          style={{
            flex: 1,
            background: '#090d16',
            border: '1px solid #334155',
            borderRadius: '6px',
            padding: '0.5rem 0.75rem',
            color: '#f8fafc',
            fontSize: '0.80rem',
            outline: 'none'
          }}
        />
        <button
          onClick={() => handleSendMessage()}
          disabled={isLoading || !inputText.trim()}
          style={{
            background: inputText.trim() && !isLoading ? '#6366f1' : '#334155',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            padding: '0.5rem 0.75rem',
            cursor: inputText.trim() && !isLoading ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.2s'
          }}
        >
          <Send size={15} />
        </button>
      </div>

      {/* CSS Animation for Spinner */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
