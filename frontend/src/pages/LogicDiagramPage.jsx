// src/pages/LogicDiagramPage.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import ReactFlow, {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  Controls,
  MiniMap,
  Handle,
  ReactFlowProvider,
  useReactFlow
} from "reactflow";
import "reactflow/dist/style.css";

/* =========================
   PROFESSIONAL THEME CONSTANTS
   ========================= */
const THEME = {
  primary: "#dd6f26ff",        // Slate 900 - Deep professional blue-grey
  secondary: "#dd6722ff",      // Slate 800
  accent: "#e98528ff",         // Blue 500 - Professional blue
  accentHover: "#d7eb25ff",    // Blue 600
  success: "#10B981",        // Emerald 500
  danger: "#EF4444",         // Red 500
  warning: "#F59E0B",        // Amber 500
  
  background: "#F8FAFC",     // Slate 50
  surface: "#FFFFFF",
  surfaceAlt: "#F1F5F9",     // Slate 100
  
  border: "#E2E8F0",         // Slate 200
  borderDark: "#CBD5E1",     // Slate 300
  
  text: {
    primary: "#0F172A",      // Slate 900
    secondary: "#475569",    // Slate 600
    tertiary: "#94A3B8",     // Slate 400
    inverse: "#FFFFFF"
  },
  
  node: {
    header: "#e45429ff",       // Blue 800
    headerActive: "#0ee719ff", // Blue 500
    border: "#979797ff",       // Slate 500
    borderActive: "#3cf02cff"  // Emerald 500
  }
};

const API_BASE = "http://localhost:8080/logic";

/* =========================
   HELPERS
   ========================= */
const numberOr = (v, d = 0) => (v === "" || v === undefined || v === null ? d : Number(v));
const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

/* =========================
   STYLED COMPONENTS (NODES)
   ========================= */
const nodeContainerStyle = (isOn, width = 180, minH = 80) => ({
  width,
  minHeight: minH,
  borderRadius: "10px",
  backgroundColor: THEME.surface,
  border: isOn ? `3px solid ${THEME.node.borderActive}` : `2px solid ${THEME.node.border}`,
  boxShadow: isOn 
    ? `0 8px 20px rgba(16, 185, 129, 0.3), 0 0 20px rgba(16, 185, 129, 0.2)` 
    : "0 4px 12px rgba(0, 0, 0, 0.08)",
  fontFamily: "'Inter', -apple-system, sans-serif",
  overflow: "visible",
  position: "relative",
  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
});

const nodeHeaderStyle = {
  background: `linear-gradient(135deg, ${THEME.node.header} 0%, #c06528ff 100%)`,
  padding: "10px 12px",
  borderBottom: `2px solid ${THEME.borderDark}`,
  textAlign: "center",
  fontWeight: "700",
  fontSize: "11px",
  color: THEME.text.inverse,
  textTransform: "uppercase",
  letterSpacing: "0.8px",
  display: "flex", 
  alignItems: "center", 
  justifyContent: "center", 
  gap: "8px",
  borderTopLeftRadius: "8px",
  borderTopRightRadius: "8px"
};

const nodeBodyStyle = { 
  padding: "12px", 
  display: "flex", 
  flexDirection: "column", 
  gap: "10px", 
  fontSize: "12px", 
  color: THEME.text.primary,
  fontWeight: "500"
};

const inputStyle = { 
  width: "100%", 
  padding: "8px 10px", 
  borderRadius: "6px", 
  border: `2px solid ${THEME.border}`, 
  fontSize: "12px", 
  outline: "none", 
  background: THEME.surface,
  fontWeight: "500",
  transition: "all 0.2s ease",
  fontFamily: "'Inter', sans-serif"
};

const handleStyle = { 
  width: 14, 
  height: 14, 
  background: THEME.text.tertiary, 
  border: "3px solid white", 
  zIndex: 10,
  boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
  transition: "all 0.2s ease"
};

const handleActiveStyle = { 
  ...handleStyle, 
  background: THEME.accent,
  boxShadow: "0 0 12px rgba(59, 130, 246, 0.6)",
  transform: "scale(1.1)"
};

/* =========================
   TEXT BOX NODE
   ========================= */
const TextBoxNode = React.memo(({ data }) => {
  const onChange = (newData) => data.onChange?.({ ...data, ...newData });
  const isEditable = data.roleId === 4;
  
  return (
    <div style={{
      minWidth: 200,
      minHeight: 100,
      padding: "16px",
      background: "#FEF3C7",
      border: `2px solid ${THEME.warning}`,
      borderRadius: "8px",
      boxShadow: "0 4px 12px rgba(245, 158, 11, 0.15)",
      fontFamily: "'Inter', sans-serif"
    }}>
      <textarea
        value={data.text || ""}
        onChange={(e) => onChange({ text: e.target.value })}
        placeholder="Add notes here..."
        disabled={!isEditable}
        style={{
          width: "100%",
          minHeight: "80px",
          border: "none",
          background: "transparent",
          fontSize: "13px",
          fontFamily: "'Inter', sans-serif",
          color: THEME.text.primary,
          resize: "both",
          outline: "none",
          lineHeight: "1.6"
        }}
      />
    </div>
  );
});

/* =========================
   NODE COMPONENTS
   ========================= */

// Digital Input
const DigitalInputNode = React.memo(({ data }) => {
  const onChange = (newData) => data.onChange?.({ ...data, ...newData });
  const value = Number(data?.value ?? 0);
  const isOn = value === 1;
  const isEditable = data.roleId === 4;
  
  return (
    <div style={nodeContainerStyle(isOn, 170)}>
      <div style={nodeHeaderStyle}>
        <span>Digital Input</span>
        {isOn && <span style={{ width: 8, height: 8, borderRadius: "50%", background: THEME.success, boxShadow: `0 0 8px ${THEME.success}` }} />}
      </div>
      <div style={nodeBodyStyle}>
        <input 
          placeholder="Tag Name" 
          value={data.desc || ""} 
          onChange={(e) => onChange({ desc: e.target.value })} 
          style={{...inputStyle, borderColor: isOn ? THEME.success : THEME.border}}
          disabled={!isEditable}
        />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
          <span style={{ fontWeight: "600", fontSize: "11px", color: THEME.text.secondary }}>Force:</span>
          <label style={{ display: "flex", alignItems: "center", cursor: "pointer", gap: 8 }}>
            <input 
              type="checkbox" 
              checked={isOn} 
              onChange={(e) => onChange({ value: e.target.checked ? 1 : 0 })} 
              style={{ width: 18, height: 18, cursor: "pointer", accentColor: THEME.success }}
            />
            <span style={{ fontWeight: 700, color: isOn ? THEME.success : THEME.text.tertiary, fontSize: "13px" }}>
              {isOn ? "ON" : "OFF"}
            </span>
          </label>
        </div>
        {data.notes && (
          <div style={{ fontSize: "10px", color: THEME.text.secondary, fontStyle: "italic", marginTop: 4, padding: "6px 8px", background: THEME.surfaceAlt, borderRadius: 6, borderLeft: `3px solid ${THEME.accent}` }}>
            📝 {data.notes}
          </div>
        )}
      </div>
      <Handle type="source" position="right" style={handleActiveStyle} />
    </div>
  );
});

// Analog Input
const AnalogInputNode = React.memo(({ data }) => {
  const onChange = (newData) => data.onChange?.({ ...data, ...newData });
  const val = Number(data?.simValue ?? 0);
  const isOn = val !== 0;
  const isEditable = data.roleId === 4;
  
  return (
    <div style={nodeContainerStyle(isOn, 180)}>
      <div style={nodeHeaderStyle}>
        <span>Analog Input</span>
        {isOn && <span style={{ width: 8, height: 8, borderRadius: "50%", background: THEME.success, boxShadow: `0 0 8px ${THEME.success}` }} />}
      </div>
      <div style={nodeBodyStyle}>
        <input 
          placeholder="Tag Name" 
          value={data.desc || ""} 
          onChange={(e) => onChange({ desc: e.target.value })} 
          style={{...inputStyle, borderColor: isOn ? THEME.success : THEME.border}}
          disabled={!isEditable}
        />
        <div>
          <label style={{ fontWeight: "600", display: "block", marginBottom: 6, fontSize: "11px", color: THEME.text.secondary }}>Value:</label>
          <input 
            type="number" 
            value={val} 
            onChange={(e) => onChange({ simValue: e.target.value })} 
            style={{...inputStyle, fontWeight: "700", color: THEME.accent}}
          />
        </div>
        {data.notes && (
          <div style={{ fontSize: "10px", color: THEME.text.secondary, fontStyle: "italic", marginTop: 4, padding: "6px 8px", background: THEME.surfaceAlt, borderRadius: 6, borderLeft: `3px solid ${THEME.accent}` }}>
            📝 {data.notes}
          </div>
        )}
      </div>
      <Handle type="source" position="right" style={handleActiveStyle} />
    </div>
  );
});

// Multi Input Gates
const MultiInputNode = React.memo(({ data }) => {
  const inputCount = Math.max(2, Math.min(8, Number(data.inputCount || 2)));
  const label = data.label || "GATE";
  const isOn = Number(data?.value ?? 0) === 1;
  const boxHeight = 50 + (inputCount * 30) + 20;

  return (
    <div style={nodeContainerStyle(isOn, 160, boxHeight)}>
      <div style={nodeHeaderStyle}>
        <span>{label} Gate</span>
        {isOn && <span style={{ width: 8, height: 8, borderRadius: "50%", background: THEME.success, boxShadow: `0 0 8px ${THEME.success}` }} />}
      </div>
      
      <div style={{ position: "absolute", top: 50, bottom: 0, left: 0, width: "100%" }}>
        {Array.from({ length: inputCount }).map((_, i) => (
          <div key={i} style={{
             position: "absolute",
             left: 0,
             top: `${((i + 1) / (inputCount + 1)) * 100}%`,
             transform: "translateY(-50%)"
          }}>
             <span style={{ fontSize: "9px", color: THEME.text.secondary, position: "absolute", left: 16, top: -7, fontWeight: "700", background: THEME.surface, padding: "2px 4px", borderRadius: 3 }}>In{i+1}</span>
             <Handle 
               type="target" 
               id={`in-${i}`}
               position="left" 
               style={{ ...handleStyle, left: -8 }} 
             />
          </div>
        ))}
      </div>

      <div style={{ 
        ...nodeBodyStyle, 
        alignItems: 'center', 
        justifyContent:'center', 
        height: '100%', 
        opacity: 0.12, 
        fontSize: 56, 
        fontWeight: 900, 
        pointerEvents:'none',
        color: THEME.primary
      }}>
        {label === "AND" ? "&" : label === "OR" ? "≥1" : label === "XOR" ? "=1" : label === "2oo3" ? "2/3" : "?"}
      </div>
      
      {data.notes && (
        <div style={{ position: "absolute", bottom: 10, left: 10, right: 10, fontSize: "9px", color: THEME.text.secondary, fontStyle: "italic", padding: "5px 8px", background: THEME.surfaceAlt, borderRadius: 6, zIndex: 5, borderLeft: `3px solid ${THEME.accent}` }}>
          📝 {data.notes}
        </div>
      )}
      
      <Handle type="source" id="out" position="right" style={{...handleActiveStyle, right: -8}} />
    </div>
  );
});

// Single IO (NOT, Coil, Relay)
const SingleIONode = React.memo(({ data }) => {
  const label = data.label || "NODE";
  const isOn = Number(data?.value ?? 0) === 1;
  
  return (
    <div style={nodeContainerStyle(isOn, 130, 80)}>
      <div style={nodeHeaderStyle}>
        <span>{label}</span>
        {isOn && <span style={{ width: 8, height: 8, borderRadius: "50%", background: THEME.success, boxShadow: `0 0 8px ${THEME.success}` }} />}
      </div>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: 45, 
        fontSize: 13, 
        fontWeight: "700",
        color: isOn ? THEME.success : THEME.text.tertiary,
        background: isOn ? "rgba(16, 185, 129, 0.05)" : "transparent",
        margin: "0 8px 8px 8px",
        borderRadius: 6
      }}>
        {isOn ? "⚡ HIGH" : "LOW"}
      </div>
      {data.notes && (
        <div style={{ fontSize: "9px", color: THEME.text.secondary, fontStyle: "italic", padding: "5px 8px", background: THEME.surfaceAlt, margin: "0 8px 8px 8px", borderRadius: 6, borderLeft: `3px solid ${THEME.accent}` }}>
          📝 {data.notes}
        </div>
      )}
      <Handle type="target" position="left" style={{ ...handleStyle, left: -8 }} />
      <Handle type="source" position="right" style={{...handleActiveStyle, right: -8}} />
    </div>
  );
});

// Comparators
const ComparatorNode = React.memo(({ data, typeLabel }) => {
  const sp = numberOr(data.setpoint, 0);
  const hyst = numberOr(data.hysteresis, 0);
  const isOn = Number(data?.value ?? 0) === 1;
  const onChange = (newData) => data.onChange?.({ ...data, ...newData });
  const isEditable = data.roleId === 4;
  
  return (
    <div style={nodeContainerStyle(isOn, 180)}>
      <div style={nodeHeaderStyle}>
        <span>{typeLabel} Comparator</span>
        {isOn && <span style={{ width: 8, height: 8, borderRadius: "50%", background: THEME.success, boxShadow: `0 0 8px ${THEME.success}` }} />}
      </div>
      <div style={nodeBodyStyle}>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontWeight: "600", display: "block", marginBottom: 6, fontSize: "11px", color: THEME.text.secondary }}>Setpoint</label>
            <input 
              type="number" 
              value={sp} 
              onChange={(e) => onChange({ setpoint: e.target.value })} 
              style={inputStyle}
              disabled={!isEditable}
            />
          </div>
          <div style={{ width: 70 }}>
            <label style={{ fontWeight: "600", display: "block", marginBottom: 6, fontSize: "11px", color: THEME.text.secondary }}>Hyst</label>
            <input 
              type="number" 
              value={hyst} 
              onChange={(e) => onChange({ hysteresis: e.target.value })} 
              style={inputStyle}
              disabled={!isEditable}
            />
          </div>
        </div>
        {data.notes && (
          <div style={{ fontSize: "10px", color: THEME.text.secondary, fontStyle: "italic", marginTop: 4, padding: "6px 8px", background: THEME.surfaceAlt, borderRadius: 6, borderLeft: `3px solid ${THEME.accent}` }}>
            📝 {data.notes}
          </div>
        )}
      </div>
      <Handle type="target" position="left" style={{ ...handleStyle, left: -8 }} />
      <Handle type="source" position="right" style={{...handleActiveStyle, right: -8}} />
    </div>
  );
});

// Timers
const TimerNode = React.memo(({ data, typeLabel }) => {
  const delay = numberOr(data.delay, 1);
  const isOn = Number(data?.value ?? 0) === 1;
  const onChange = (newData) => data.onChange?.({ ...data, ...newData });
  const isEditable = data.roleId === 4;
  
  return (
    <div style={nodeContainerStyle(isOn, 160)}>
      <div style={nodeHeaderStyle}>
        <span>{typeLabel} Timer</span>
        {isOn && <span style={{ width: 8, height: 8, borderRadius: "50%", background: THEME.success, boxShadow: `0 0 8px ${THEME.success}` }} />}
      </div>
      <div style={nodeBodyStyle}>
        <label style={{ fontWeight: "600", fontSize: "11px", color: THEME.text.secondary }}>Delay (seconds)</label>
        <input 
          type="number" 
          min="0" 
          value={delay} 
          onChange={(e) => onChange({ delay: e.target.value })} 
          style={{...inputStyle, fontWeight: "700", color: THEME.accent}}
          disabled={!isEditable}
        />
        {data.notes && (
          <div style={{ fontSize: "10px", color: THEME.text.secondary, fontStyle: "italic", marginTop: 4, padding: "6px 8px", background: THEME.surfaceAlt, borderRadius: 6, borderLeft: `3px solid ${THEME.accent}` }}>
            📝 {data.notes}
          </div>
        )}
      </div>
      <Handle type="target" position="left" style={{ ...handleStyle, left: -8 }} />
      <Handle type="source" position="right" style={{...handleActiveStyle, right: -8}} />
    </div>
  );
});

/* =========================
   SIMULATION ENGINE 
   ========================= */
function initSimulation({ nodesRef, edgesRef, setNodes, setEdges, runtimeRef }) {
  let simTimer = null;
  
  const start = () => {
    if (simTimer) return;
    
    simTimer = setInterval(() => {
      const nodesLocal = nodesRef.current || [];
      const edgesLocal = edgesRef.current || [];
      const incoming = {};
      
      edgesLocal.forEach((e) => { 
        if (!incoming[e.target]) incoming[e.target] = []; 
        incoming[e.target].push({ source: e.source, handle: e.targetHandle }); 
      });
      
      const nextValues = {};

      const readVal = (id) => {
        const n = nodesLocal.find(x => x.id === id);
        if (!n) return 0;
        return n.type === 'analogInputNode' ? numberOr(n.data?.simValue, 0) : numberOr(n.data?.value, 0);
      };

      // Snapshot Inputs
      nodesLocal.forEach(n => {
        if (n.type === 'digitalInputNode' || n.type === 'analogInputNode') {
          nextValues[n.id] = readVal(n.id);
        }
      });

      // Logic Processing
      nodesLocal.forEach(n => {
        const srcs = incoming[n.id] || [];
        const inputs = srcs.map(s => nextValues[s.source] ?? readVal(s.source));
        
        if (["andNode", "orNode", "xorNode", "notNode", "coilNode", "relayNode"].includes(n.type)) {
          const bins = inputs.map(v => v > 0 ? 1 : 0);
          if (n.type === 'andNode') {
            nextValues[n.id] = bins.length > 0 && bins.every(b => b) ? 1 : 0;
          } else if (n.type === 'orNode') {
            nextValues[n.id] = bins.some(b => b) ? 1 : 0;
          } else if (n.type === 'xorNode') {
            nextValues[n.id] = (bins.filter(b => b).length % 2 !== 0) ? 1 : 0;
          } else if (n.type === 'notNode') {
            nextValues[n.id] = bins[0] ? 0 : 1;
          } else {
            nextValues[n.id] = bins[0] ? 1 : 0;
          }
        } else if (n.type === 'ltNode') {
          const hyst = numberOr(n.data.hysteresis, 0);
          const sp = numberOr(n.data.setpoint, 0);
          const currentState = numberOr(n.data.value, 0);
          const inputVal = inputs[0] || 0;
          
          if (currentState === 0) {
            nextValues[n.id] = inputVal < (sp - hyst/2) ? 1 : 0;
          } else {
            nextValues[n.id] = inputVal < (sp + hyst/2) ? 1 : 0;
          }
        } else if (n.type === 'gtNode') {
          const hyst = numberOr(n.data.hysteresis, 0);
          const sp = numberOr(n.data.setpoint, 0);
          const currentState = numberOr(n.data.value, 0);
          const inputVal = inputs[0] || 0;
          
          if (currentState === 0) {
            nextValues[n.id] = inputVal > (sp + hyst/2) ? 1 : 0;
          } else {
            nextValues[n.id] = inputVal > (sp - hyst/2) ? 1 : 0;
          }
        } else if (n.type === '2oo3Node') {
          const sum = inputs.slice(0, 3).map(v => v > 0 ? 1 : 0).reduce((a, b) => a + b, 0);
          nextValues[n.id] = sum >= 2 ? 1 : 0;
        } else if (n.type === 'tonNode') {
          const inActive = (inputs[0] || 0) > 0;
          const delay = numberOr(n.data.delay, 1) * 5; 
          let st = (runtimeRef.current.ton || {})[n.id] || { count: 0 };
          
          if(inActive) {
             st.count = Math.min(st.count + 1, delay + 1);
             nextValues[n.id] = st.count > delay ? 1 : 0;
          } else {
             st.count = 0;
             nextValues[n.id] = 0;
          }
          
          runtimeRef.current.ton = runtimeRef.current.ton || {};
          runtimeRef.current.ton[n.id] = st;
        } else if (n.type === 'toffNode') {
           const inActive = (inputs[0] || 0) > 0;
           const delay = numberOr(n.data.delay, 1) * 5; 
           let st = (runtimeRef.current.toff || {})[n.id] || { count: 0, state: 0 };
           
           if (inActive) {
               st.state = 1;
               st.count = 0; 
               nextValues[n.id] = 1;
           } else {
               if(st.state === 1) {
                   st.count = Math.min(st.count + 1, delay + 1);
                   if (st.count > delay) { 
                     st.state = 0; 
                     nextValues[n.id] = 0; 
                   } else { 
                     nextValues[n.id] = 1; 
                   }
               } else {
                   nextValues[n.id] = 0;
               }
           }
           
           runtimeRef.current.toff = runtimeRef.current.toff || {};
           runtimeRef.current.toff[n.id] = st;
        }
      });

      // Update State
      setNodes(nds => nds.map(n => {
        const v = nextValues[n.id] ?? n.data.value;
        return n.data.value !== v ? { ...n, data: { ...n.data, value: v } } : n;
      }));
      
      setEdges(eds => eds.map(e => {
        const active = (nextValues[e.source] ?? readVal(e.source)) ? 1 : 0;
        return (e.data?.active ?? 0) !== active ? { 
          ...e, 
          data: { ...e.data, active }, 
          style: { 
            stroke: active ? THEME.accent : THEME.borderDark, 
            strokeWidth: active ? 3 : 2 
          }, 
          animated: !!active 
        } : e;
      }));
    }, 200);
  };
  
  const stop = () => { 
    if (simTimer) {
      clearInterval(simTimer);
      simTimer = null;
    }
    
    runtimeRef.current = { ton: {}, toff: {} };
    
    setNodes(ns => ns.map(n => ({ 
      ...n, 
      data: { ...n.data, value: 0 } 
    })));
    
    setEdges(es => es.map(e => ({ 
      ...e, 
      data: { ...e.data, active: 0 },
      style: { stroke: THEME.borderDark, strokeWidth: 2 }, 
      animated: false 
    })));
  };
  
  return { start, stop };
}

/* =========================
   UI MODALS
   ========================= */

// Folder Context Menu
const FolderContextMenu = ({ visible, x, y, folder, onAddFile, onEdit, onDelete, onClose, roleId }) => {
  if (!visible || roleId !== 4) return null;
  
  return (
    <div 
      style={{ 
        position: "fixed", 
        top: y, 
        left: x, 
        zIndex: 2000, 
        background: THEME.surface, 
        border: `2px solid ${THEME.border}`, 
        boxShadow: "0 8px 24px rgba(15, 23, 42, 0.12)", 
        borderRadius: "10px", 
        padding: "8px", 
        minWidth: "180px" 
      }} 
      onClick={e => e.stopPropagation()}
    >
      <div style={{ 
        padding: "10px 12px", 
        fontSize: "10px", 
        fontWeight: "700", 
        color: THEME.text.tertiary, 
        borderBottom: `1px solid ${THEME.border}`,
        textTransform: "uppercase",
        letterSpacing: "1px"
      }}>
        Folder Options
      </div>
      
      <button 
        onClick={onAddFile} 
        style={{ 
          width: "100%", 
          textAlign: "left", 
          padding: "10px 12px", 
          background: `linear-gradient(135deg, ${THEME.accent} 0%, ${THEME.accentHover} 100%)`, 
          color: THEME.text.inverse, 
          border: "none", 
          cursor: "pointer", 
          fontSize: "13px", 
          fontWeight: "600",
          marginTop: "6px",
          marginBottom: "4px",
          borderRadius: "6px",
          transition: "all 0.2s ease"
        }}
        onMouseEnter={(e) => e.target.style.transform = "translateY(-1px)"}
        onMouseLeave={(e) => e.target.style.transform = "translateY(0)"}
      >
        📄 New File
      </button>
      
      <button 
        onClick={onEdit} 
        style={{ 
          width: "100%", 
          textAlign: "left", 
          padding: "10px 12px", 
          background: THEME.surfaceAlt, 
          color: THEME.text.primary, 
          border: "none", 
          cursor: "pointer", 
          fontSize: "13px", 
          fontWeight: "600",
          marginBottom: "4px",
          borderRadius: "6px"
        }}
      >
        ✏️ Edit Folder
      </button>
      
      <button 
        onClick={onDelete} 
        style={{ 
          width: "100%", 
          textAlign: "left", 
          padding: "10px 12px", 
          background: "#FEF2F2", 
          color:THEME.danger,
border: "none",
cursor: "pointer",
fontSize: "13px",
fontWeight: "600",
marginBottom: "4px",
borderRadius: "6px"
}}
>
🗑️ Delete Folder
</button>
  <button 
    onClick={onClose} 
    style={{ 
      width: "100%", 
      textAlign: "left", 
      padding: "10px 12px", 
      background: THEME.surfaceAlt, 
      color: THEME.text.secondary, 
      border: "none", 
      cursor: "pointer", 
      fontSize: "13px",
      borderRadius: "6px"
    }}
  >
    ✕ Cancel
  </button>
</div>
);
};
// Node/Edge Context Menu
const ContextMenu = ({ visible, x, y, type, onDelete, onAddNote, onClose, roleId }) => {
if (!visible) return null;
return (
<div
style={{
position: "fixed",
top: y,
left: x,
zIndex: 2000,
background: THEME.surface,
border: '2px solid ${THEME.border}',
boxShadow: "0 8px 24px rgba(15, 23, 42, 0.12)",
borderRadius: "10px",
padding: "8px",
minWidth: "170px"
}}
onClick={e => e.stopPropagation()}
>
<div style={{
padding: "10px 12px",
fontSize: "10px",
fontWeight: "700",
color: THEME.text.tertiary,
borderBottom: '1px solid ${THEME.border}',
textTransform: "uppercase",
letterSpacing: "1px"
}}>
Options
</div>
  {roleId === 4 && (
    <button 
      onClick={onAddNote} 
      style={{ 
        width: "100%", 
        textAlign: "left", 
        padding: "10px 12px", 
        background: "#EFF6FF", 
        color: THEME.accent, 
        border: "none", 
        cursor: "pointer", 
        fontSize: "13px", 
        fontWeight: "600",
        marginTop: "6px",
        marginBottom: "4px",
        borderRadius: "6px"
      }}
    >
      📝 Add Note
    </button>
  )}
  
  {roleId === 4 && (
    <button 
      onClick={onDelete} 
      style={{ 
        width: "100%", 
        textAlign: "left", 
        padding: "10px 12px", 
        background: "#FEF2F2", 
        color: THEME.danger, 
        border: "none", 
        cursor: "pointer", 
        fontSize: "13px", 
        fontWeight: "600",
        marginBottom: "4px",
        borderRadius: "6px"
      }}
    >
      🗑️ Delete {type}
    </button>
  )}
  
  <button 
    onClick={onClose} 
    style={{ 
      width: "100%", 
      textAlign: "left", 
      padding: "10px 12px", 
      background: THEME.surfaceAlt, 
      color: THEME.text.secondary, 
      border: "none", 
      cursor: "pointer", 
      fontSize: "13px",
      borderRadius: "6px"
    }}
  >
    ✕ Cancel
  </button>
</div>
);
};
const ConfirmModal = ({ isOpen, msg, onConfirm, onCancel }) => {
if (!isOpen) return null;
return (
<div style={{
position: "fixed",
inset: 0,
background: "rgba(15, 23, 42, 0.7)",
backdropFilter: "blur(4px)",
zIndex: 3000,
display: "flex",
alignItems: "center",
justifyContent: "center"
}}>
<div style={{
background: THEME.surface,
padding: "32px",
borderRadius: "16px",
width: "420px",
boxShadow: "0 25px 50px rgba(15, 23, 42, 0.25)"
}}>
<h3 style={{
margin: "0 0 16px 0",
color: THEME.primary,
fontSize: "20px",
fontWeight: "700"
}}>
⚠️ Confirm Action
</h3>
<p style={{
fontSize: "14px",
color: THEME.text.secondary,
marginBottom: "28px",
lineHeight: "1.6"
}}>
{msg}
</p>
<div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
<button
onClick={onCancel}
style={{
padding: "10px 20px",
border: '2px solid ${THEME.border}',
background: THEME.surface,
borderRadius: 8,
cursor: "pointer",
fontSize: "14px",
fontWeight: "600",
color: THEME.text.primary,
transition: "all 0.2s ease"
}}
>
Cancel
</button>
<button
onClick={onConfirm}
style={{
padding: "10px 20px",
border: "none",
background: THEME.danger,
color: THEME.text.inverse,
borderRadius: 8,
cursor: "pointer",
fontSize: "14px",
fontWeight: "700",
boxShadow: "0 4px 12px ${THEME.danger}40"
}}
>
Confirm
</button>
</div>
</div>
</div>
);
};
const GateInputModal = ({ isOpen, type, onConfirm, onCancel }) => {
const [count, setCount] = useState(2);
if (!isOpen) return null;
return (
<div style={{
position: "fixed",
inset: 0,
background: "rgba(15, 23, 42, 0.7)",
backdropFilter: "blur(4px)",
zIndex: 3000,
display: "flex",
alignItems: "center",
justifyContent: "center"
}}>
<div style={{
background: THEME.surface,
padding: "32px",
borderRadius: "16px",
width: "380px",
boxShadow: "0 25px 50px rgba(15, 23, 42, 0.25)"
}}>
<h3 style={{
margin: "0 0 24px 0",
color: THEME.accent,
borderBottom:'2px solid ${THEME.border}',
paddingBottom: 16,
fontSize: "18px",
fontWeight: "700"
}}>
Configure {type.replace("Node","").toUpperCase()} Gate
</h3>
<div style={{ marginBottom: 28 }}>
<label style={{
fontSize: "13px",
color: THEME.text.primary,
display:"block",
marginBottom: 12,
fontWeight: "600"
}}>
Number of Inputs (2-8):
</label>
<input
type="number"
min="2"
max="8"
value={count}
onChange={(e) => setCount(Math.min(8, Math.max(2, parseInt(e.target.value)||2)))}
style={{
width: "100%",
padding: "14px",
border: '2px solid ${THEME.border}',
borderRadius: "8px",
fontSize: "18px",
outlineColor: THEME.accent,
fontWeight: "700",
textAlign: "center",
color: THEME.accent
}}
/>
<p style={{
fontSize: "11px",
color: THEME.text.tertiary,
marginTop: 10,
lineHeight: "1.5"
}}>
Choose between 2 to 8 input pins for this logic gate.
</p>
</div>
<div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
<button
onClick={onCancel}
style={{
padding: "12px 22px",
border: '2px solid ${THEME.border}',
background: THEME.surface,
borderRadius: 8,
cursor: "pointer",
fontSize: "14px",
fontWeight: "600"
}}
>
Cancel
</button>
<button
onClick={() => onConfirm(count)}
style={{
padding: "12px 22px",
border: "none",
background: "linear-gradient(135deg, ${THEME.accent} 0%, ${THEME.accentHover} 100%)",
color: THEME.text.inverse,
borderRadius: 8,
cursor: "pointer",
fontWeight: "700",
fontSize: "14px",
boxShadow: "0 4px 12px ${THEME.accent}40"
}}
>
Add Node
</button>
</div>
</div>
</div>
);
};
const NoteModal = ({ isOpen, currentNote, onSave, onCancel }) => {
const [note, setNote] = useState(currentNote || "");
useEffect(() => {
setNote(currentNote || "");
}, [currentNote]);
if (!isOpen) return null;
return (
<div style={{
position: "fixed",
inset: 0,
background: "rgba(15, 23, 42, 0.7)",
backdropFilter: "blur(4px)",
zIndex: 3000,
display: "flex",
alignItems: "center",
justifyContent: "center"
}}>
<div style={{
background: THEME.surface,
padding: "32px",
borderRadius: "16px",
width: "480px",
boxShadow: "0 25px 50px rgba(15, 23, 42, 0.25)"
}}>
<h3 style={{
margin: "0 0 20px 0",
color: THEME.primary,
fontSize: "18px",
fontWeight: "700"
}}>
📝 Add/Edit Note
</h3>
<textarea
value={note}
onChange={(e) => setNote(e.target.value)}
placeholder="Enter description or notes..."
style={{
width: "100%",
minHeight: "140px",
padding: "14px",
border: '2px solid ${THEME.border}',
borderRadius: "8px",
fontSize: "14px",
fontFamily: "'Inter', sans-serif",
resize: "vertical",
outline: "none",
marginBottom: "24px",
lineHeight: "1.6"
}}
/>
<div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
<button
onClick={onCancel}
style={{
padding: "12px 22px",
border: '2px solid ${THEME.border}',
background: THEME.surface,
borderRadius: 8,
cursor: "pointer",
fontSize: "14px",
fontWeight: "600"
}}
>
Cancel
</button>
<button
onClick={() => onSave(note)}
style={{
padding: "12px 22px",
border: "none",
background: "linear-gradient(135deg, ${THEME.accent} 0%, ${THEME.accentHover} 100%)",
color: THEME.text.inverse,
borderRadius: 8,
cursor: "pointer",
fontWeight: "700",
fontSize: "14px",
boxShadow: "0 4px 12px ${THEME.accent}40"
}}
>
Save Note
</button>
</div>
</div>
</div>
);
};
const FolderModal = ({ isOpen, onConfirm, onCancel, editFolder }) => {
const [name, setName] = useState(editFolder?.name || "");
useEffect(() => {
setName(editFolder?.name || "");
}, [editFolder]);
if (!isOpen) return null;
return (
<div style={{
position: "fixed",
inset: 0,
background: "rgba(15, 23, 42, 0.7)",
backdropFilter: "blur(4px)",
zIndex: 3000,
display: "flex",
alignItems: "center",
justifyContent: "center"
}}>
<div style={{
background: THEME.surface,
padding: "32px",
borderRadius: "16px",
width: "400px",
boxShadow: "0 25px 50px rgba(15, 23, 42, 0.25)"
}}>
<h3 style={{
margin: "0 0 24px 0",
color: THEME.accent,
fontSize: "18px",
fontWeight: "700"
}}>
{editFolder ? "📁 Edit Folder" : "📁 New Folder"}
</h3>
<input
type="text"
value={name}
onChange={(e) => setName(e.target.value)}
placeholder="Folder Name (e.g., ID FAN Logic)"
style={{
width: "100%",
padding: "14px",
border: '2px solid ${THEME.border}',
borderRadius: "8px",
fontSize: "14px",
outline: "none",
marginBottom: "24px",
fontWeight: "500"
}}
/>
<div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
<button
onClick={onCancel}
style={{
padding: "12px 22px",
border: '2px solid ${THEME.border}',
background: THEME.surface,
borderRadius: 8,
cursor: "pointer",
fontSize: "14px",
fontWeight: "600"
}}
>
Cancel
</button>
<button
onClick={() => { onConfirm(name); setName(""); }}
style={{
padding: "12px 22px",
border: "none",
background: "linear-gradient(135deg, ${THEME.accent} 0%, ${THEME.accentHover} 100%)",
color: THEME.text.inverse,
borderRadius: 8,
cursor: "pointer",
fontWeight: "700",
fontSize: "14px",
boxShadow: "0 4px 12px ${THEME.accent}40"
}}
disabled={!name.trim()}
>
{editFolder ? "Update" : "Create"}
</button>
</div>
</div>
</div>
);
};
const FileNameModal = ({ isOpen, onConfirm, onCancel }) => {
  const [name, setName] = useState("");
  
  useEffect(() => {
    if (isOpen) {
      setName(""); // Reset name when modal opens
    }
  }, [isOpen]);
  
  if (!isOpen) return null;
  
  const handleSubmit = () => {
    if (name.trim()) {
      onConfirm(name.trim());
      setName("");
    }
  };
  
  return (
    <div style={{ 
      position: "fixed", 
      inset: 0, 
      background: "rgba(15, 23, 42, 0.7)", 
      backdropFilter: "blur(4px)",
      zIndex: 3000, 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "center" 
    }}>
      <div style={{ 
        background: THEME.surface, 
        padding: "32px", 
        borderRadius: "16px", 
        width: "400px", 
        boxShadow: "0 25px 50px rgba(15, 23, 42, 0.25)" 
      }}>
        <h3 style={{ 
          margin: "0 0 24px 0", 
          color: THEME.accent,
          fontSize: "18px",
          fontWeight: "700"
        }}>
          📄 New File
        </h3>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="File Name (e.g., Auto On Logic)"
          autoFocus
          style={{
            width: "100%",
            padding: "14px",
            border: `2px solid ${THEME.border}`,
            borderRadius: "8px",
            fontSize: "14px",
            outline: "none",
            marginBottom: "24px",
            fontWeight: "500"
          }}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              handleSubmit();
            }
          }}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <button 
            onClick={onCancel} 
            style={{ 
              padding: "12px 22px", 
              border: `2px solid ${THEME.border}`, 
              background: THEME.surface, 
              borderRadius: 8, 
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600",
              color: THEME.text.primary
            }}
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit} 
            style={{ 
              padding: "12px 22px", 
              border: "none", 
              background: name.trim() 
                ? `linear-gradient(135deg, ${THEME.accent} 0%, ${THEME.accentHover} 100%)` 
                : THEME.border,
              color: THEME.text.inverse, 
              borderRadius: 8, 
              cursor: name.trim() ? "pointer" : "not-allowed", 
              fontWeight: "700",
              fontSize: "14px",
              boxShadow: name.trim() ? `0 4px 12px ${THEME.accent}40` : "none",
              opacity: name.trim() ? 1 : 0.6,
              transition: "all 0.2s ease"
            }}
            disabled={!name.trim()}
          >
            Create File
          </button>
        </div>
      </div>
    </div>
  );
};
/* =========================
ZOOM CONTROLS COMPONENT
========================= */
const ZoomControls = () => {
const { zoomIn, zoomOut, fitView } = useReactFlow();
return (
<div style={{
position: "absolute",
top: 20,
left: 20,
zIndex: 10,
background: THEME.surface,
borderRadius: "12px",
boxShadow: "0 8px 24px rgba(15, 23, 42, 0.12)",
border: '2px solid ${THEME.border}',
padding: "8px",
display: "flex",
gap: "6px"
}}>
<button
onClick={() => zoomIn()}
style={{
padding: "10px 16px",
border: "none",
background: THEME.surfaceAlt,
borderRadius: 8,
cursor: "pointer",
fontSize: "16px",
fontWeight: "700",
color: THEME.text.primary,
transition: "all 0.2s ease"
}}
title="Zoom In"
onMouseEnter={(e) => e.target.style.background = THEME.border}
onMouseLeave={(e) => e.target.style.background = THEME.surfaceAlt}
>
🔍+
</button>
<button
onClick={() => zoomOut()}
style={{
padding: "10px 16px",
border: "none",
background: THEME.surfaceAlt,
borderRadius: 8,
cursor: "pointer",
fontSize: "16px",
fontWeight: "700",
color: THEME.text.primary,
transition: "all 0.2s ease"
}}
title="Zoom Out"
onMouseEnter={(e) => e.target.style.background = THEME.border}
onMouseLeave={(e) => e.target.style.background = THEME.surfaceAlt}
>
🔍-
</button>
<button
onClick={() => fitView({ padding: 0.2 })}
style={{
padding: "10px 18px",
border: "none",
background: "linear-gradient(135deg, ${THEME.accent} 0%, ${THEME.accentHover} 100%)",
color: THEME.text.inverse,
borderRadius: 8,
cursor: "pointer",
fontSize: "13px",
fontWeight: "700",
boxShadow: "0 4px 12px ${THEME.accent}30"
}}
title="Fit to Screen"
>
📐 Fit Screen
</button>
</div>
);
};
/* =========================
MAIN PAGE
========================= */
export default function LogicDiagramPage({ auth, roleId = 4 }) {
const api = useMemo(() => axios.create({
baseURL: API_BASE,
headers: { Authorization: auth }
}), [auth]);
// ReactFlow
const [nodes, setNodes] = useState([]);
const [edges, setEdges] = useState([]);
const nodesRef = useRef(nodes);
const edgesRef = useRef(edges);
useEffect(() => { nodesRef.current = nodes; }, [nodes]);
useEffect(() => { edgesRef.current = edges; }, [edges]);
// App State
const [diagramName, setDiagramName] = useState("");
const [currentDiagramId, setCurrentDiagramId] = useState(null);
const [folders, setFolders] = useState([]);
const [selectedFolder, setSelectedFolder] = useState(null);
const [running, setRunning] = useState(false);
const [editMode, setEditMode] = useState(false);
const runtimeRef = useRef({ ton: {}, toff: {} });
const simCtrl = useRef(null);
// UI State
const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
const [rightToolboxOpen, setRightToolboxOpen] = useState(false);
const [menu, setMenu] = useState({ visible: false, x: 0, y: 0, type: null, id: null });
const [folderMenu, setFolderMenu] = useState({ visible: false, x: 0, y: 0, folder: null });
const [confirmData, setConfirmData] = useState({ open: false, action: null, msg: "" });
const [gateConfig, setGateConfig] = useState({ open: false, type: "" });
const [noteModal, setNoteModal] = useState({ open: false, nodeId: null, currentNote: "" });
const [folderModal, setFolderModal] = useState({ open: false, editFolder: null });
const [fileNameModal, setFileNameModal] = useState({ open: false, folderId: null });
// --- API ---
const loadFolders = useCallback(async () => {
try {
const res = await api.get("/folders").catch(() => ({ data: [] }));
setFolders(res.data || []);
} catch {
setFolders([]);
}
}, [api]);
useEffect(() => {
loadFolders();
}, [loadFolders]);
const handleSave = async () => {
if (!diagramName) return alert("Please enter a diagram name");
if (!selectedFolder && roleId === 4) return alert("Please select a folder");
try {
  const payload = {
    name: diagramName,
    folderId: selectedFolder?.id,
    data: { nodes, edges }
  };
  
  if (currentDiagramId) {
    payload.id = currentDiagramId;
  }
  
  await api.post("/save", payload);
  await loadFolders();
  setEditMode(false);
  setRightToolboxOpen(false);
  alert("✅ Saved Successfully!");
} catch { 
  alert("❌ Error saving diagram"); 
}
};
const handleLoad = async (diagram) => {
try {
const res = await api.get(`/load/${diagram.id}`);
if (!res.data) return alert("Not found");
  const loadedNodes = (res.data.data.nodes || []).map(n => ({ 
    ...n, 
    data: { 
      ...n.data, 
      roleId,
      onChange: createOnChangeForId(n.id) 
    } 
  }));
  
  setNodes(loadedNodes);
  setEdges(res.data.data.edges || []);
  setDiagramName(diagram.name);
  setCurrentDiagramId(diagram.id);
  setEditMode(false);
  setRightToolboxOpen(false);
} catch { 
  alert("❌ Error loading diagram"); 
}
};
const handleNewFile = (folderId) => {
setFileNameModal({ open: true, folderId });
setFolderMenu({ visible: false });
};
const handleCreateFile = async (fileName) => {
  if (!fileName.trim()) return;
  
  const folderId = fileNameModal.folderId;
  const folder = folders.find(f => f.id === folderId);
  
  setDiagramName(fileName.trim());
  setNodes([]);
  setEdges([]);
  setCurrentDiagramId(null);
  setEditMode(true);
  setRightToolboxOpen(true);
  setSelectedFolder(folder);
  setFileNameModal({ open: false, folderId: null });
  
  // Auto-save the empty file to the backend so it appears in the folder
  try {
    const payload = {
      name: fileName.trim(),
      folderId: folderId,
      data: { nodes: [], edges: [] }
    };
    
    const response = await api.post("/save", payload);
    
    // If the backend returns the created diagram ID, set it
    if (response.data && response.data.id) {
      setCurrentDiagramId(response.data.id);
    }
    
    // Reload folders to show the new file
    await loadFolders();
    
    // Re-expand the folder to show the new file
    setFolders(prev => prev.map(f => 
      f.id === folderId 
        ? { ...f, expanded: true }
        : f
    ));
    
  } catch (error) {
    console.error("Error creating file:", error);
    alert("❌ Error creating file");
  }
};
const handleEditDiagram = (diagram) => {
handleLoad(diagram).then(() => {
setEditMode(true);
setRightToolboxOpen(true);
});
};
const handleDeleteDiagram = (diagram) => {
if (roleId !== 4) return;
setConfirmData({
  open: true,
  msg: `Delete diagram "${diagram.name}"?`,
  action: async () => {
    try {
      await api.delete(`/delete/${diagram.id}`);
      await loadFolders();
      if(currentDiagramId === diagram.id) { 
        setNodes([]); 
        setEdges([]); 
        setDiagramName("");
        setCurrentDiagramId(null);
      }
    } catch {}
    setConfirmData({ open: false });
  }
});
};
const handleDeleteFolder = (folder) => {
if (roleId !== 4) return;
const diagCount = folder.diagrams?.length || 0;

setConfirmData({
  open: true,
  msg: `Delete folder "${folder.name}"? ${diagCount > 0 ? `This will also delete ${diagCount} diagram(s) inside.` : ""}`,
  action: async () => {
    try {
      await api.delete(`/folder/${folder.id}`);
      await loadFolders();
      if (selectedFolder?.id === folder.id) {
        setSelectedFolder(null);
        setNodes([]);
        setEdges([]);
        setDiagramName("");
        setCurrentDiagramId(null);
      }
    } catch {}
    setConfirmData({ open: false });
    setFolderMenu({ visible: false });
  }
});
};
const handleCreateFolder = async (name) => {
if (roleId !== 4) return;
if (!name.trim()) return;
try {
  if (folderModal.editFolder) {
    await api.put(`/folder/${folderModal.editFolder.id}`, { name: name.trim() });
  } else {
    await api.post("/folder", { name: name.trim() });
  }
  await loadFolders();
  setFolderModal({ open: false, editFolder: null });
} catch {
  alert("❌ Error creating/updating folder");
}
};
// --- Logic Helpers ---
const createOnChangeForId = useCallback((id) => (newData) => {
setNodes((prev) => prev.map((n) => (n.id === id ? {
...n,
data: { ...n.data, ...newData }
} : n)));
}, []);
const addNode = (type, inputCount = 2) => {
if (roleId !== 4 || !editMode) return;
const id = uid();
let data = { 
  label: type.replace("Node", "").toUpperCase(), 
  value: 0,
  roleId,
  onChange: createOnChangeForId(id) 
};

if (["andNode", "orNode", "xorNode"].includes(type)) {
  data.inputCount = inputCount;
}

if (type === "textBoxNode") {
  data.text = "";
}

setNodes(nds => [...nds, { 
  id, 
  type, 
  position: { 
    x: 300 + Math.random()*40, 
    y: 150 + Math.random()*40 
  }, 
  data 
}]);
};
const onDropdownSelect = (e) => {
if (roleId !== 4 || !editMode) return;
const type = e.target.value;
if (!type) return;

if (["andNode", "orNode", "xorNode"].includes(type)) {
  setGateConfig({ open: true, type });
} else {
  addNode(type);
}

e.target.value = "";
};
const onGateConfigConfirm = (count) => {
addNode(gateConfig.type, count);
setGateConfig({ open: false, type: "" });
};
// --- ReactFlow Handlers ---
const nodeTypes = useMemo(() => ({
analogInputNode: AnalogInputNode,
digitalInputNode: DigitalInputNode,
andNode: MultiInputNode,
orNode: MultiInputNode,
xorNode: MultiInputNode,
notNode: SingleIONode,
relayNode: SingleIONode,
coilNode: SingleIONode,
ltNode: (p) => <ComparatorNode {...p} typeLabel="LT" />,
gtNode: (p) => <ComparatorNode {...p} typeLabel="GT" />,
"2oo3Node": (p) => <MultiInputNode {...p} data={{ ...p.data, inputCount: 3, label: "2oo3" }} />,
tonNode: (p) => <TimerNode {...p} typeLabel="TON" />,
toffNode: (p) => <TimerNode {...p} typeLabel="TOFF" />,
textBoxNode: TextBoxNode
}), []);
const onNodesChange = useCallback((c) => {
if (roleId !== 4 && !editMode) {
const filtered = c.filter(change => change.type === 'position');
setNodes((nds) => applyNodeChanges(filtered, nds));
} else {
setNodes((nds) => applyNodeChanges(c, nds));
}
}, [roleId, editMode]);
const onEdgesChange = useCallback((c) => {
if (roleId === 4 && editMode) {
setEdges((eds) => applyEdgeChanges(c, eds));
}
}, [roleId, editMode]);
const onConnect = useCallback((p) => {
if (roleId === 4 && editMode) {
setEdges((eds) => addEdge({
...p,
type: 'smoothstep',
style: { stroke: THEME.borderDark, strokeWidth: 2 }
}, eds));
}
}, [roleId, editMode]);
const onNodeCtx = (e, n) => {
e.preventDefault();
setMenu({
visible: true,
x: e.clientX,
y: e.clientY,
type: 'node',
id: n.id
});
};
const onEdgeCtx = (e, edge) => {
if (roleId !== 4 || !editMode) return;
e.preventDefault();
setMenu({
visible: true,
x: e.clientX,
y: e.clientY,
type: 'edge',
id: edge.id
});
};
const deleteItem = () => {
if (roleId !== 4 || !editMode) return;
if (menu.type === 'node') {
  setNodes(ns => ns.filter(n => n.id !== menu.id));
  setEdges(es => es.filter(e => e.source !== menu.id && e.target !== menu.id));
} else {
  setEdges(es => es.filter(e => e.id !== menu.id));
}

setMenu({ visible: false });
};
const handleAddNote = () => {
const node = nodes.find(n => n.id === menu.id);
if (!node) return;
setNoteModal({
  open: true,
  nodeId: menu.id,
  currentNote: node.data.notes || ""
});

setMenu({ visible: false });
};
const handleSaveNote = (note) => {
setNodes(prev => prev.map(n =>
n.id === noteModal.nodeId
? { ...n, data: { ...n.data, notes: note } }
: n
));
setNoteModal({ open: false, nodeId: null, currentNote: "" });
};
const toggleFolder = (folderId) => {
setFolders(prev => prev.map(f =>
f.id === folderId
? { ...f, expanded: !f.expanded }
: f
));
};
const onFolderRightClick = (e, folder) => {
if (roleId !== 4) return;
e.preventDefault();
e.stopPropagation();
setFolderMenu({
visible: true,
x: e.clientX,
y: e.clientY,
folder
});
};
useEffect(() => {
simCtrl.current = initSimulation({
nodesRef,
edgesRef,
setNodes,
setEdges,
runtimeRef
});
return () => simCtrl.current?.stop();
}, []);
useEffect(() => {
if (running) {
simCtrl.current?.start();
} else {
simCtrl.current?.stop();
}
}, [running]);
return (
<div style={{ display: "flex", height: "100vh", width: "100vw", background: THEME.background }}>
  {/* --- LEFT SIDEBAR (SIMULATION & FILE MANAGEMENT) --- */}
  <div style={{ 
    width: leftSidebarOpen ? 320 : 56, 
    background: THEME.surface, 
    borderRight: `2px solid ${THEME.border}`, 
    display: "flex", 
    flexDirection: "column",
    transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    position: "relative",
    boxShadow: "4px 0 12px rgba(15, 23, 42, 0.04)"
  }}>
    
    {/* Collapse Toggle */}
    <button
      onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
      style={{
        position: "absolute",
        top: 16,
        right: leftSidebarOpen ? 16 : 10,
        zIndex: 100,
        background: `linear-gradient(135deg, ${THEME.accent} 0%, ${THEME.accentHover} 100%)`,
        color: THEME.text.inverse,
        border: "none",
        borderRadius: "8px",
        padding: "4px 6px",
        cursor: "pointer",
        fontSize: "14px",
        fontWeight: "700",
        boxShadow: `0 4px 12px ${THEME.accent}30`,
        transition: "all 0.2s ease"
      }}
    >
      {leftSidebarOpen ? "◀" : "▶"}
    </button>

    {leftSidebarOpen && (
      <>
        {/* Simulation Control */}
        <div style={{ 
          padding: "20px", 
          background: THEME.surfaceAlt, 
          borderBottom: `2px solid ${THEME.border}` 
        }}>
          <div style={{ 
            fontSize: "10px", 
            fontWeight: "700", 
            color: THEME.text.tertiary, 
            marginBottom: "14px",
            textTransform: "uppercase",
            letterSpacing: "1.2px"
          }}>
            🎮 Simulation Control
          </div>
          <button 
            onClick={() => setRunning(r => !r)}
            style={{ 
              width: "80%", 
              padding: "14px", 
              borderRadius: 10, 
              border: "none", 
              background: running 
                ? `linear-gradient(135deg, ${THEME.danger} 0%, #DC2626 100%)`
                : `linear-gradient(135deg, ${THEME.success} 0%, #059669 100%)`, 
              color: THEME.text.inverse, 
              fontWeight: "700", 
              cursor: "pointer", 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center", 
              gap: 12, 
              fontSize:"10px",
              boxShadow: running 
                ? `0 6px 20px ${THEME.danger}40`
                : `0 6px 20px ${THEME.success}40`,
              transition: "all 0.3s ease"
            }}
          >
            <span style={{ 
              width: 8, 
              height: 8, 
              background: THEME.text.inverse, 
              borderRadius: "50%"
            }}/>
            {running ? "⏸ STOP" : "▶ RUN"}
          </button>
        </div>

        {/* Folders & Diagrams */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          <div style={{ 
            padding: "16px 20px", 
            background: THEME.surfaceAlt, 
            borderBottom: `1px solid ${THEME.border}`, 
            fontWeight: "700", 
            color: THEME.text.primary, 
            fontSize: "10px", 
            letterSpacing: "1.2px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            textTransform: "uppercase"
          }}>
            📁 Projects
            {roleId === 4 && (
              <button
                onClick={() => setFolderModal({ open: true, editFolder: null })}
                style={{
                  padding: "6px 12px",
                  background: `linear-gradient(135deg, ${THEME.accent} 0%, ${THEME.accentHover} 100%)`,
                  color: THEME.text.inverse,
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: "11px",
                  fontWeight: "700",
                  boxShadow: `0 2px 8px ${THEME.accent}30`
                }}
              >
                + Folder
              </button>
            )}
          </div>
          
          {folders.length === 0 ? (
            <div style={{ 
              padding: "32px 20px", 
              textAlign: "center", 
              fontSize: "12px", 
              color: THEME.text.tertiary 
            }}>
              No folders yet
            </div>
          ) : (
            folders.map(folder => (
              <div key={folder.id} style={{ borderBottom: `1px solid ${THEME.border}` }}>
                {/* Folder Header */}
                <div 
                  style={{ 
                    display: "flex", 
                    justifyContent: "space-between", 
                    alignItems: "center", 
                    padding: "14px 20px", 
                    background: THEME.surfaceAlt,
                    cursor: "pointer",
                    transition: "all 0.2s ease"
                  }}
                  onContextMenu={(e) => onFolderRightClick(e, folder)}
                >
                  <div 
                    onClick={() => toggleFolder(folder.id)}
                    style={{ 
                      flex: 1, 
                      fontWeight: "600", 
                      color: THEME.text.primary, 
                      fontSize: "13px",
                      display: "flex",
                      alignItems: "center",
                      gap: 10
                    }}
                  >
                    <span style={{ fontSize: "16px" }}>{folder.expanded ? "📂" : "📁"}</span>
                    {folder.name}
                    <span style={{ 
                      fontSize: "10px", 
                      color: THEME.text.tertiary,
                      background: THEME.border,
                      padding: "3px 8px",
                      borderRadius: 12,
                      fontWeight: "700"
                    }}>
                      {folder.diagrams?.length || 0}
                    </span>
                  </div>
                  {roleId === 4 && (
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        handleDeleteFolder(folder); 
                      }} 
                      style={{ 
                        padding: "6px 10px", 
                        background: "#FEF2F2", 
                        color: THEME.danger, 
                        border: "none", 
                        borderRadius: 6, 
                        cursor: "pointer", 
                        fontSize: "12px",
                        fontWeight: "700",
                        transition: "all 0.2s ease"
                      }}
                      onMouseEnter={(e) => e.target.style.background = "#FEE2E2"}
                      onMouseLeave={(e) => e.target.style.background = "#FEF2F2"}
                    >
                      🗑️
                    </button>
                  )}
                </div>
                
                {/* Folder Content */}
                {folder.expanded && (
                  <div style={{ background: THEME.surface }}>
                    {(!folder.diagrams || folder.diagrams.length === 0) ? (
                      <div style={{ 
                        padding: "16px 28px", 
                        fontSize: "11px", 
                        color: THEME.text.tertiary,
                        fontStyle: "italic"
                      }}>
                        No diagrams in this folder
                      </div>
                    ) : (
                      folder.diagrams.map(diag => (
                        <div 
                          key={diag.id} 
                          style={{ 
                            display: "flex", 
                            justifyContent: "space-between", 
                            alignItems: "center", 
                            padding: "10px 28px", 
                            borderTop: `1px solid ${THEME.border}`, 
                            fontSize: "12px",
                            transition: "all 0.2s ease"
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = THEME.surfaceAlt}
                          onMouseLeave={(e) => e.currentTarget.style.background = THEME.surface}
                        >
                          <span 
                            onClick={() => {
                              handleLoad(diag);
                              setSelectedFolder(folder);
                            }} 
                            style={{ 
                              fontWeight: "500", 
                              color: THEME.text.secondary, 
                              flex: 1,
                              cursor: "pointer"
                            }}
                          >
                            📄 {diag.name}
                          </span>
                          {roleId === 4 && (
                            <div style={{ display: "flex", gap: 6 }}>
                              <button 
                                onClick={() => handleEditDiagram(diag)} 
                                style={{ 
                                  padding: "5px 10px", 
                                  background: "#EFF6FF", 
                                  color: THEME.accent, 
                                  border: "none", 
                                  borderRadius: 5, 
                                  cursor: "pointer", 
                                  fontSize: "11px",
                                  fontWeight: "700"
                                }}
                                title="Edit"
                              >
                                ✏️
                              </button>
                              <button 
                                onClick={() => handleDeleteDiagram(diag)} 
                                style={{ 
                                  padding: "5px 10px", 
                                  background: "#FEF2F2", 
                                  color: THEME.danger, 
                                  border: "none", 
                                  borderRadius: 5, 
                                  cursor: "pointer", 
                                  fontSize: "11px",
                                  fontWeight: "700"
                                }}
                                title="Delete"
                              >
                                🗑️
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </>
    )}
  </div>

  {/* --- CANVAS --- */}
  <div style={{ flex: 1, position: "relative" }} onClick={() => { setMenu(p => ({ ...p, visible: false })); setFolderMenu({ visible: false }); }}>
    <ReactFlowProvider>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        onNodeContextMenu={onNodeCtx}
        onEdgeContextMenu={onEdgeCtx}
        fitView
        style={{ background: "#F8FAFC" }}
        nodesDraggable={true}
        nodesConnectable={roleId === 4 && editMode}
        elementsSelectable={roleId === 4 && editMode}
      >
        <Background color={THEME.borderDark} gap={20} />
        <Controls style={{ border: `2px solid ${THEME.border}`, borderRadius: 10 }} />
        <MiniMap 
          style={{ 
            border: `2px solid ${THEME.border}`, 
            borderRadius: 10,
            background: THEME.surface
          }} 
          nodeColor={(n) => {
            const isOn = Number(n.data?.value ?? 0) === 1;
            return isOn ? THEME.success : THEME.borderDark;
          }}
        />
        <ZoomControls />
      </ReactFlow>
    </ReactFlowProvider>
    
    {/* Current Diagram Info */}
    {diagramName && (
      <div style={{
        position: "absolute",
        top: 20,
        right: 20,
        background: THEME.surface,
        padding: "12px 20px",
        borderRadius: 10,
        boxShadow: "0 4px 16px rgba(15, 23, 42, 0.1)",
        border: `2px solid ${THEME.border}`,
        fontSize: "13px",
        fontWeight: "600",
        color: THEME.text.primary
      }}>
        📄 {diagramName}
        {editMode && <span style={{ marginLeft: 10, color: THEME.accent, fontSize: "11px" }}>(EDITING)</span>}
      </div>
    )}
  </div>

  {/* --- RIGHT TOOLBOX (COMPONENTS) - ONLY IN EDIT MODE --- */}
  {roleId === 4 && editMode && (
    <div style={{ 
      position: "fixed", 
      top: 90, 
      right: 20, 
      width: rightToolboxOpen ? 260 : 56, 
      background: THEME.surface, 
      borderRadius: "12px", 
      boxShadow: "0 8px 32px rgba(15, 23, 42, 0.12)", 
      border: `2px solid ${THEME.border}`, 
      padding: rightToolboxOpen ? "20px" : "12px", 
      zIndex: 10,
      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      maxHeight: "calc(100vh - 120px)",
      overflowY: "auto"
    }}>
      
      <button
        onClick={() => setRightToolboxOpen(!rightToolboxOpen)}
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          background: `linear-gradient(135deg, ${THEME.accent} 0%, ${THEME.accentHover} 100%)`,
          color: THEME.text.inverse,
          border: "none",
          borderRadius: "8px",
          padding: "8px 12px",
          cursor: "pointer",
          fontSize: "14px",
          fontWeight: "700",
          boxShadow: `0 4px 12px ${THEME.accent}30`
        }}
      >
        {rightToolboxOpen ? "▶" : "◀"}
      </button>

      {rightToolboxOpen && (
        <>
          {/* Save Button */}
          <button
            onClick={handleSave}
            style={{
              width: "100%",
              padding: "14px",
              marginBottom: 20,
              marginTop: 10,
              background: `linear-gradient(135deg, ${THEME.success} 0%, #059669 100%)`,
              color: THEME.text.inverse,
              border: "none",
              borderRadius: 10,
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "700",
              boxShadow: `0 6px 20px ${THEME.success}30`,
              transition: "all 0.2s ease"
            }}
          >
            💾 Save Diagram
          </button>

          <div style={{ 
            fontSize: "10px", 
            fontWeight: "700", 
            color: THEME.text.tertiary, 
            marginBottom: "14px",
            textTransform: "uppercase",
            letterSpacing: "1.2px"
          }}>
            ⚙️ Add Components
          </div>
          
          <select 
            onChange={onDropdownSelect} 
            style={{ 
              width: "100%", 
              padding: "12px", 
              borderRadius: 8, 
              border: `2px solid ${THEME.border}`, 
              background: THEME.surface, 
              fontSize: "13px", 
              color: THEME.text.primary, 
              outline: "none", 
              cursor: "pointer",
              fontWeight: "600",
              marginBottom: 16
            }}
          >
            <option value="">➕ Select Component...</option>
            <optgroup label="⚡ Inputs">
              <option value="digitalInputNode">Digital Input</option>
              <option value="analogInputNode">Analog Input</option>
            </optgroup>
            <optgroup label="🔧 Logic Gates">
              <option value="andNode">AND Gate</option>
              <option value="orNode">OR Gate</option>
              <option value="xorNode">XOR Gate</option>
              <option value="notNode">NOT Gate</option>
            </optgroup>
            <optgroup label="📊 Comparators">
              <option value="ltNode">LT (Less Than)</option>
              <option value="gtNode">GT (Greater Than)</option>
            </optgroup>
            <optgroup label="⏱ Control">
              <option value="tonNode">TON (Timer On)</option>
              <option value="toffNode">TOFF (Timer Off)</option>
              <option value="2oo3Node">2oo3 Voter</option>
              <option value="coilNode">Coil</option>
              <option value="relayNode">Relay</option>
            </optgroup>
            <optgroup label="📝 Documentation">
              <option value="textBoxNode">Text Box</option>
            </optgroup>
          </select>

          <div style={{
            padding: 14,
            background: THEME.surfaceAlt,
            borderRadius: 8,
            fontSize: "11px",
            color: THEME.text.secondary,
            lineHeight: "1.6",
            borderLeft: `3px solid ${THEME.accent}`
          }}>
            <strong style={{ color: THEME.accent }}>💡 Tip:</strong> Right-click on nodes/edges for options. Drag components to position them.
          </div>
        </>
      )}
    </div>
  )}

  {/* --- MODALS --- */}
  <FolderContextMenu
    visible={folderMenu.visible}
    x={folderMenu.x}
    y={folderMenu.y}
    folder={folderMenu.folder}
    onAddFile={() => handleNewFile(folderMenu.folder?.id)}
    onEdit={() => {
      setFolderModal({ open: true, editFolder: folderMenu.folder });
      setFolderMenu({ visible: false });
    }}
    onDelete={() => handleDeleteFolder(folderMenu.folder)}
    onClose={() => setFolderMenu({ visible: false })}
    roleId={roleId}
  />
  
  <ContextMenu 
    {...menu} 
    onDelete={deleteItem} 
    onAddNote={handleAddNote}
    onClose={() => setMenu(p => ({ ...p, visible: false }))}
    roleId={roleId}
  />
  
  <ConfirmModal 
    isOpen={confirmData.open} 
    msg={confirmData.msg} 
    onConfirm={confirmData.action} 
    onCancel={() => setConfirmData({ open: false })} 
  />
  
  <GateInputModal 
    isOpen={gateConfig.open} 
    type={gateConfig.type} 
    onConfirm={onGateConfigConfirm} 
    onCancel={() => setGateConfig({ open: false, type: "" })} 
  />
  
  <NoteModal
    isOpen={noteModal.open}
    currentNote={noteModal.currentNote}
    onSave={handleSaveNote}
    onCancel={() => setNoteModal({ open: false, nodeId: null, currentNote: "" })}
  />
  
  <FolderModal
    isOpen={folderModal.open}
    editFolder={folderModal.editFolder}
    onConfirm={handleCreateFolder}
    onCancel={() => setFolderModal({ open: false, editFolder: null })}
  />
  
  <FileNameModal
    isOpen={fileNameModal.open}
    onConfirm={handleCreateFile}
    onCancel={() => setFileNameModal({ open: false, folderId: null })}
  />
</div>
);
}
