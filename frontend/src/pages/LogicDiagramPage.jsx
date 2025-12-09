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
  ReactFlowProvider
} from "reactflow";
import "reactflow/dist/style.css";

/* =========================
   THEME CONSTANTS
   ========================= */
const ORANGE = "#E06A1B";
const DARK_GREY = "#333333";
const BORDER_COLOR = "#D1D5DB";
const SUCCESS_GREEN = "#10B981";
const DANGER_RED = "#EF4444";
const NODE_BG = "#FFFFFF";
const NODE_HEADER_BG = "#F9FAFB";

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
  minHeight: minH, // Dynamic height will override this
  borderRadius: "6px",
  backgroundColor: NODE_BG,
  border: isOn ? `2px solid ${ORANGE}` : `1px solid ${BORDER_COLOR}`,
  boxShadow: isOn ? `0 0 10px rgba(224, 106, 27, 0.3)` : "0 2px 4px rgba(0,0,0,0.05)",
  fontFamily: "'Inter', sans-serif",
  overflow: "visible", // Changed to visible so handles don't get clipped
  position: "relative",
  transition: "border 0.2s ease"
});

const nodeHeaderStyle = {
  background: NODE_HEADER_BG,
  padding: "6px",
  borderBottom: `1px solid ${BORDER_COLOR}`,
  textAlign: "center",
  fontWeight: "700",
  fontSize: "11px",
  color: DARK_GREY,
  textTransform: "uppercase",
  display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
  borderTopLeftRadius: "5px",
  borderTopRightRadius: "5px"
};

const nodeBodyStyle = { padding: "8px", display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", color: "#4B5563" };
const inputStyle = { width: "100%", padding: "4px", borderRadius: "3px", border: `1px solid ${BORDER_COLOR}`, fontSize: "11px", outline: "none", background: "#fff" };
const handleStyle = { width: 10, height: 10, background: "#9CA3AF", border: "2px solid #fff", zIndex: 10 };
const handleActiveStyle = { ...handleStyle, background: ORANGE };

/* =========================
   NODE COMPONENTS
   ========================= */

// 1. Digital Input
const DigitalInputNode = React.memo(({ data }) => {
  const onChange = (newData) => data.onChange?.({ ...data, ...newData });
  const value = Number(data?.value ?? 0);
  const isOn = value === 1;
  return (
    <div style={nodeContainerStyle(isOn, 150)}>
      <div style={nodeHeaderStyle}><span>DIGITAL IN</span>{isOn && <span style={{ width: 6, height: 6, borderRadius: "50%", background: SUCCESS_GREEN }} />}</div>
      <div style={nodeBodyStyle}>
        <input placeholder="Tag Name" value={data.desc || ""} onChange={(e) => onChange({ desc: e.target.value })} style={inputStyle} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Force:</span>
          <label style={{ display: "flex", alignItems: "center", cursor: "pointer", gap: 4 }}>
            <input type="checkbox" checked={isOn} onChange={(e) => onChange({ value: e.target.checked ? 1 : 0 })} />
            <span style={{ fontWeight: 600, color: isOn ? SUCCESS_GREEN : "#6B7280" }}>{isOn ? "ON" : "OFF"}</span>
          </label>
        </div>
      </div>
      <Handle type="source" position="right" style={handleActiveStyle} />
    </div>
  );
});

// 2. Analog Input
const AnalogInputNode = React.memo(({ data }) => {
  const onChange = (newData) => data.onChange?.({ ...data, ...newData });
  const val = Number(data?.simValue ?? 0);
  const isOn = val !== 0;
  return (
    <div style={nodeContainerStyle(isOn, 160)}>
      <div style={nodeHeaderStyle}><span>ANALOG IN</span>{isOn && <span style={{ width: 6, height: 6, borderRadius: "50%", background: SUCCESS_GREEN }} />}</div>
      <div style={nodeBodyStyle}>
        <input placeholder="Tag Name" value={data.desc || ""} onChange={(e) => onChange({ desc: e.target.value })} style={inputStyle} />
        <div><label>Val:</label><input type="number" value={val} onChange={(e) => onChange({ simValue: e.target.value })} style={inputStyle} /></div>
      </div>
      <Handle type="source" position="right" style={handleActiveStyle} />
    </div>
  );
});

// 3. Multi Input Gates (AND, OR, XOR) - DYNAMIC HANDLES
const MultiInputNode = React.memo(({ data }) => {
  // Ensure we have a valid number between 2 and 8
  const inputCount = Math.max(2, Math.min(8, Number(data.inputCount || 2)));
  const label = data.label || "GATE";
  const isOn = Number(data?.value ?? 0) === 1;
  
  // Calculate dynamic height based on inputs to prevent crowding
  // Header (30px) + (Inputs * 25px per handle) + Padding (10px)
  const boxHeight = 30 + (inputCount * 25) + 10;

  return (
    <div style={nodeContainerStyle(isOn, 140, boxHeight)}>
      <div style={nodeHeaderStyle}><span>{label}</span>{isOn && <span style={{ width: 6, height: 6, borderRadius: "50%", background: SUCCESS_GREEN }} />}</div>
      
      {/* Dynamic Input Handles Container */}
      <div style={{ position: "absolute", top: 30, bottom: 0, left: 0, width: "100%" }}>
        {Array.from({ length: inputCount }).map((_, i) => (
          <div key={i} style={{
             position: "absolute",
             left: 0,
             // Distribute evenly along the vertical axis
             top: `${((i + 1) / (inputCount + 1)) * 100}%`,
             transform: "translateY(-50%)"
          }}>
             {/* Handle Label (tiny) */}
             <span style={{ fontSize: "8px", color: "#9CA3AF", position: "absolute", left: 12, top: -5 }}>In{i+1}</span>
             <Handle 
               type="target" 
               id={`in-${i}`} // Unique ID for each input pin
               position="left" 
               style={{ ...handleStyle, left: -6 }} 
             />
          </div>
        ))}
      </div>

      <div style={{ ...nodeBodyStyle, alignItems: 'center', justifyContent:'center', height: '100%', opacity: 0.1, fontSize: 40, fontWeight: 900, pointerEvents:'none' }}>
        {label === "AND" ? "&" : label === "OR" ? "≥1" : label === "XOR" ? "=1" : "?"}
      </div>
      
      <Handle type="source" id="out" position="right" style={{...handleActiveStyle, right: -6}} />
    </div>
  );
});

// 4. Single IO
const SingleIONode = React.memo(({ data }) => {
  const label = data.label || "NODE";
  const isOn = Number(data?.value ?? 0) === 1;
  return (
    <div style={nodeContainerStyle(isOn, 110, 60)}>
      <div style={nodeHeaderStyle}><span>{label}</span>{isOn && <span style={{ width: 6, height: 6, borderRadius: "50%", background: SUCCESS_GREEN }} />}</div>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 25, fontSize: 10, color: isOn ? ORANGE : '#ccc' }}>
        {isOn ? <b>HIGH</b> : "LOW"}
      </div>
      <Handle type="target" position="left" style={{ ...handleStyle, left: -6 }} />
      <Handle type="source" position="right" style={{...handleActiveStyle, right: -6}} />
    </div>
  );
});

// 5. Comparators
const ComparatorNode = React.memo(({ data, typeLabel }) => {
  const sp = numberOr(data.setpoint, 0);
  const hyst = numberOr(data.hysteresis, 0);
  const isOn = Number(data?.value ?? 0) === 1;
  const onChange = (newData) => data.onChange?.({ ...data, ...newData });
  return (
    <div style={nodeContainerStyle(isOn, 160)}>
      <div style={nodeHeaderStyle}><span>{typeLabel}</span>{isOn && <span style={{ width: 6, height: 6, borderRadius: "50%", background: SUCCESS_GREEN }} />}</div>
      <div style={nodeBodyStyle}>
        <div style={{ display: "flex", gap: 4 }}>
          <div style={{ flex: 1 }}><label>SP</label><input type="number" value={sp} onChange={(e) => onChange({ setpoint: e.target.value })} style={inputStyle} /></div>
          <div style={{ width: 50 }}><label>Hyst</label><input type="number" value={hyst} onChange={(e) => onChange({ hysteresis: e.target.value })} style={inputStyle} /></div>
        </div>
      </div>
      <Handle type="target" position="left" style={{ ...handleStyle, left: -6 }} />
      <Handle type="source" position="right" style={{...handleActiveStyle, right: -6}} />
    </div>
  );
});

// 6. Timers
const TimerNode = React.memo(({ data, typeLabel }) => {
  const delay = numberOr(data.delay, 1);
  const isOn = Number(data?.value ?? 0) === 1;
  const onChange = (newData) => data.onChange?.({ ...data, ...newData });
  return (
    <div style={nodeContainerStyle(isOn, 140)}>
      <div style={nodeHeaderStyle}><span>{typeLabel}</span>{isOn && <span style={{ width: 6, height: 6, borderRadius: "50%", background: SUCCESS_GREEN }} />}</div>
      <div style={nodeBodyStyle}>
        <label>Delay (s)</label><input type="number" min="0" value={delay} onChange={(e) => onChange({ delay: e.target.value })} style={inputStyle} />
      </div>
      <Handle type="target" position="left" style={{ ...handleStyle, left: -6 }} />
      <Handle type="source" position="right" style={{...handleActiveStyle, right: -6}} />
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
      edgesLocal.forEach((e) => { if (!incoming[e.target]) incoming[e.target] = []; incoming[e.target].push(e.source); });
      const nextValues = {};

      const readVal = (id) => {
        const n = nodesLocal.find(x => x.id === id);
        if (!n) return 0;
        return n.type === 'analogInputNode' ? numberOr(n.data?.simValue, 0) : numberOr(n.data?.value, 0);
      };

      // 1. Snapshot Inputs
      nodesLocal.forEach(n => {
        if (n.type === 'digitalInputNode' || n.type === 'analogInputNode') nextValues[n.id] = readVal(n.id);
      });

      // 2. Logic
      nodesLocal.forEach(n => {
        const srcs = incoming[n.id] || [];
        const inputs = srcs.map(s => nextValues[s] ?? readVal(s));
        
        if (["andNode", "orNode", "xorNode", "notNode", "coilNode", "relayNode"].includes(n.type)) {
          const bins = inputs.map(v => v > 0 ? 1 : 0);
          if (n.type === 'andNode') nextValues[n.id] = bins.length && bins.every(b => b) ? 1 : 0;
          else if (n.type === 'orNode') nextValues[n.id] = bins.some(b => b) ? 1 : 0;
          else if (n.type === 'xorNode') nextValues[n.id] = (bins.filter(b => b).length % 2 !== 0) ? 1 : 0;
          else if (n.type === 'notNode') nextValues[n.id] = bins[0] ? 0 : 1;
          else nextValues[n.id] = bins[0] ? 1 : 0;
        } else if (n.type === 'ltNode') {
          nextValues[n.id] = (inputs[0] || 0) < numberOr(n.data.setpoint) ? 1 : 0;
        } else if (n.type === 'gtNode') {
          nextValues[n.id] = (inputs[0] || 0) > numberOr(n.data.setpoint) ? 1 : 0;
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
        }
        else if (n.type === 'toffNode') {
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
                   if (st.count > delay) { st.state = 0; nextValues[n.id] = 0; }
                   else { nextValues[n.id] = 1; }
               } else {
                   nextValues[n.id] = 0;
               }
           }
           runtimeRef.current.toff = runtimeRef.current.toff || {};
           runtimeRef.current.toff[n.id] = st;
        }
      });

      // 3. Update State
      setNodes(nds => nds.map(n => {
        const v = nextValues[n.id] ?? n.data.value;
        return n.data.value !== v ? { ...n, data: { ...n.data, value: v } } : n;
      }));
      setEdges(eds => eds.map(e => {
        const active = (nextValues[e.source] ?? readVal(e.source)) ? 1 : 0;
        return (e.data?.active ?? 0) !== active ? { ...e, data: { ...e.data, active }, style: { stroke: active ? ORANGE : "#aaa", strokeWidth: active ? 2 : 1 }, animated: !!active } : e;
      }));
    }, 200);
  };
  const stop = () => { if (simTimer) clearInterval(simTimer); setNodes(ns => ns.map(n => ({ ...n, data: { ...n.data, value: 0 } }))); setEdges(es => es.map(e => ({ ...e, style: { stroke: "#aaa" }, animated: false }))); };
  return { start, stop };
}

/* =========================
   UI MODALS
   ========================= */
const ContextMenu = ({ visible, x, y, type, onDelete, onClose }) => {
  if (!visible) return null;
  return (
    <div style={{ position: "fixed", top: y, left: x, zIndex: 2000, background: "#fff", border: "1px solid #ddd", boxShadow: "0 4px 12px rgba(0,0,0,0.15)", borderRadius: "6px", padding: "4px", minWidth: "140px" }} onClick={e => e.stopPropagation()}>
      <div style={{ padding: "6px 8px", fontSize: "11px", fontWeight: "bold", color: "#888", borderBottom: "1px solid #eee" }}>Options</div>
      <button onClick={onDelete} style={{ width: "100%", textAlign: "left", padding: "6px 8px", background: "#FFF1F2", color: DANGER_RED, border: "none", cursor: "pointer", fontSize: "12px", fontWeight: "600" }}>🗑️ Delete {type}</button>
      <button onClick={onClose} style={{ width: "100%", textAlign: "left", padding: "6px 8px", background: "#fff", color: "#333", border: "none", cursor: "pointer", fontSize: "12px" }}>✕ Cancel</button>
    </div>
  );
};

const ConfirmModal = ({ isOpen, msg, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", padding: "20px", borderRadius: "8px", width: "300px", boxShadow: "0 10px 25px rgba(0,0,0,0.2)" }}>
        <h3 style={{ margin: "0 0 10px 0", color: DARK_GREY }}>Confirm Action</h3>
        <p style={{ fontSize: "13px", color: "#666", marginBottom: "20px" }}>{msg}</p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={onCancel} style={{ padding: "6px 12px", border: `1px solid ${BORDER_COLOR}`, background: "#fff", borderRadius: 4, cursor: "pointer" }}>Cancel</button>
          <button onClick={onConfirm} style={{ padding: "6px 12px", border: "none", background: DANGER_RED, color: "#fff", borderRadius: 4, cursor: "pointer" }}>Confirm</button>
        </div>
      </div>
    </div>
  );
};

// Gate Configuration Modal
const GateInputModal = ({ isOpen, type, onConfirm, onCancel }) => {
  const [count, setCount] = useState(2);
  if (!isOpen) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", padding: "24px", borderRadius: "12px", width: "300px", boxShadow: "0 10px 30px rgba(0,0,0,0.2)" }}>
        <h3 style={{ margin: "0 0 16px 0", color: ORANGE, borderBottom:`1px solid ${BORDER_COLOR}`, paddingBottom:8 }}>Configure {type.replace("Node","").toUpperCase()}</h3>
        <div style={{marginBottom: 20}}>
           <label style={{fontSize: "13px", color: "#374151", display:"block", marginBottom:8}}>Number of Inputs (2-8):</label>
           

[Image of logic gate with multiple inputs]

           <input 
             type="number" min="2" max="8" value={count} 
             onChange={(e) => setCount(Math.min(8, Math.max(2, parseInt(e.target.value)||2)))}
             style={{width: "100%", padding: "10px", border: `2px solid ${BORDER_COLOR}`, borderRadius: "6px", fontSize: "16px", outlineColor: ORANGE}}
           />
           <p style={{fontSize: "11px", color:"#9CA3AF", marginTop: 6}}>Choose between 2 to 8 input pins for this logic gate.</p>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={onCancel} style={{ padding: "8px 16px", border: `1px solid ${BORDER_COLOR}`, background: "#fff", borderRadius: 6, cursor: "pointer" }}>Cancel</button>
          <button onClick={() => onConfirm(count)} style={{ padding: "8px 16px", border: "none", background: ORANGE, color: "#fff", borderRadius: 6, cursor: "pointer", fontWeight: "600" }}>Add Node</button>
        </div>
      </div>
    </div>
  );
};

/* =========================
   MAIN PAGE
   ========================= */
export default function LogicDiagramPage({ auth }) {
  const api = useMemo(() => axios.create({ baseURL: API_BASE, headers: { Authorization: auth } }), [auth]);

  // ReactFlow
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);

  // App State
  const [diagramName, setDiagramName] = useState("");
  const [diagramList, setDiagramList] = useState([]);
  const [running, setRunning] = useState(false);
  const runtimeRef = useRef({});
  const simCtrl = useRef(null);

  // UI State
  const [menu, setMenu] = useState({ visible: false, x: 0, y: 0, type: null, id: null });
  const [confirmData, setConfirmData] = useState({ open: false, action: null });
  const [gateConfig, setGateConfig] = useState({ open: false, type: "" });

  // --- API ---
  const loadDiagramList = useCallback(async () => {
    try {
      const res = await api.get("/list").catch(() => ({ data: [] }));
      setDiagramList(res.data || []);
    } catch { setDiagramList([]); }
  }, [api]);
  useEffect(() => { loadDiagramList(); }, [loadDiagramList]);

  const handleSave = async () => {
    if (!diagramName) return alert("Please enter a diagram name");
    try {
      await api.post("/save", { name: diagramName, data: { nodes, edges } });
      await loadDiagramList();
      alert("Saved Successfully!");
    } catch { alert("Error saving diagram"); }
  };

  const handleLoad = async (name) => {
    try {
      const res = await api.get(`/load/${encodeURIComponent(name)}`);
      if (!res.data) return alert("Not found");
      const loadedNodes = (res.data.data.nodes || []).map(n => ({ ...n, data: { ...n.data, onChange: createOnChangeForId(n.id) } }));
      setNodes(loadedNodes);
      setEdges(res.data.data.edges || []);
      setDiagramName(name);
    } catch { alert("Error loading diagram"); }
  };

  const handleNew = () => {
    setConfirmData({
      open: true,
      msg: "Create new diagram? Unsaved changes will be lost.",
      action: () => { setNodes([]); setEdges([]); setDiagramName(""); setConfirmData({ open: false }); }
    });
  };

  const handleDeleteDiagram = (name) => {
    setConfirmData({
      open: true,
      msg: `Delete diagram "${name}"?`,
      action: async () => {
        try {
          await api.delete(`/delete/${encodeURIComponent(name)}`);
          await loadDiagramList();
          if(diagramName === name) { setNodes([]); setEdges([]); setDiagramName(""); }
        } catch {}
        setConfirmData({ open: false });
      }
    });
  };

  // --- Logic Helpers ---
  const createOnChangeForId = useCallback((id) => (newData) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...newData } } : n)));
  }, []);

  const addNode = (type, inputCount = 2) => {
    const id = uid();
    let data = { label: type.replace("Node", "").toUpperCase(), value: 0, onChange: createOnChangeForId(id) };
    if (["andNode", "orNode", "xorNode"].includes(type)) data.inputCount = inputCount;
    setNodes(nds => [...nds, { id, type, position: { x: 300 + Math.random()*20, y: 150 + Math.random()*20 }, data }]);
  };

  const onDropdownSelect = (e) => {
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
    analogInputNode: AnalogInputNode, digitalInputNode: DigitalInputNode,
    andNode: MultiInputNode, orNode: MultiInputNode, xorNode: MultiInputNode,
    notNode: SingleIONode, relayNode: SingleIONode, coilNode: SingleIONode,
    ltNode: (p) => <ComparatorNode {...p} typeLabel="LT" />,
    gtNode: (p) => <ComparatorNode {...p} typeLabel="GT" />,
    "2oo3Node": (p) => <MultiInputNode {...p} data={{ ...p.data, inputCount: 3, label: "2oo3" }} />,
    tonNode: (p) => <TimerNode {...p} typeLabel="TON" />,
    toffNode: (p) => <TimerNode {...p} typeLabel="TOFF" />
  }), []);

  const onNodesChange = useCallback((c) => setNodes((nds) => applyNodeChanges(c, nds)), []);
  const onEdgesChange = useCallback((c) => setEdges((eds) => applyEdgeChanges(c, eds)), []);
  const onConnect = useCallback((p) => setEdges((eds) => addEdge({ ...p, type: 'smoothstep', style: { stroke: "#aaa", strokeWidth: 1.5 } }, eds)), []);
  const onNodeCtx = (e, n) => { e.preventDefault(); setMenu({ visible: true, x: e.clientX, y: e.clientY, type: 'node', id: n.id }); };
  const onEdgeCtx = (e, edge) => { e.preventDefault(); setMenu({ visible: true, x: e.clientX, y: e.clientY, type: 'edge', id: edge.id }); };
  const deleteItem = () => {
    if (menu.type === 'node') {
      setNodes(ns => ns.filter(n => n.id !== menu.id));
      setEdges(es => es.filter(e => e.source !== menu.id && e.target !== menu.id));
    } else setEdges(es => es.filter(e => e.id !== menu.id));
    setMenu({ visible: false });
  };

  useEffect(() => { simCtrl.current = initSimulation({ nodesRef, edgesRef, setNodes, setEdges, runtimeRef }); return () => simCtrl.current?.stop(); }, []);
  useEffect(() => { if (running) simCtrl.current?.start(); else simCtrl.current?.stop(); }, [running]);

  return (
    <div style={{ display: "flex", height: "100vh", width: "100vw", background: "#f9fafb" }}>
      
      {/* --- LEFT SIDEBAR (FILE MANAGEMENT) --- */}
      <div style={{ width: 260, background: "#fff", borderRight: "1px solid #E5E7EB", display: "flex", flexDirection: "column" }}>
        
        {/* Saved Diagrams List */}
        <div style={{ flex: 1, overflowY: "auto", borderBottom: "1px solid #E5E7EB" }}>
          <div style={{ padding: "12px", background: "#F9FAFB", borderBottom: "1px solid #E5E7EB", fontWeight: "700", color: DARK_GREY, fontSize: "11px", letterSpacing: "0.5px" }}>SAVED DIAGRAMS</div>
          {diagramList.length === 0 ? (
            <div style={{ padding: "12px", textAlign: "center", fontSize: "12px", color: "#9CA3AF" }}>No saved diagrams</div>
          ) : (
            diagramList.map(name => (
              <div key={name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderBottom: "1px solid #F3F4F6", fontSize: "12px", cursor:"pointer" }} className="hover:bg-gray-50">
                <span onClick={()=>handleLoad(name)} style={{ fontWeight: "500", color: "#374151", flex:1 }}>{name}</span>
                <button onClick={() => handleDeleteDiagram(name)} style={{ padding: "4px 8px", background: "#FEF2F2", color: DANGER_RED, border: "none", borderRadius: 4, cursor: "pointer", fontSize: "10px" }}>Del</button>
              </div>
            ))
          )}
        </div>
        
        {/* Project Actions */}
        <div style={{ padding: "16px", background: "#fff" }}>
          <div style={{fontSize:"11px", fontWeight:"700", color:"#9CA3AF", marginBottom:"8px"}}>FILE ACTIONS</div>
          <button onClick={handleNew} style={{ width: "100%", padding: "8px", border: `1px solid ${BORDER_COLOR}`, background:"#fff", borderRadius: 4, cursor: "pointer", marginBottom: "8px", fontSize: "12px", color:DARK_GREY }}>+ Create New</button>
          <input placeholder="Project Name" value={diagramName} onChange={e => setDiagramName(e.target.value)} style={{ width: "100%", padding: "8px", border: `1px solid ${BORDER_COLOR}`, borderRadius: 4, fontSize: "12px", marginBottom:"8px" }} />
          <button onClick={handleSave} style={{ width:"100%", padding: "8px", background: ORANGE, color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: "600", fontSize: "12px" }}>Save Current Project</button>
        </div>
      </div>

      {/* --- CANVAS --- */}
      <div style={{ flex: 1, position: "relative" }} onClick={() => setMenu(p => ({ ...p, visible: false }))}>
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
            style={{ background: "#F3F4F6" }}
          >
            <Background color="#E5E7EB" gap={20} />
            <Controls />
            <MiniMap style={{ border: `1px solid ${BORDER_COLOR}`, borderRadius: 4 }} />
          </ReactFlow>
        </ReactFlowProvider>
      </div>

      {/* --- RIGHT FLOATING PANEL (TOOLBOX & SIMULATION) --- */}
      <div style={{ position: "absolute", top: 16, right: 16, width: 220, background: "#fff", borderRadius: "8px", boxShadow: "0 4px 15px rgba(0,0,0,0.1)", border: "1px solid #E5E7EB", padding: "16px", zIndex: 10 }}>
        <div style={{ fontSize: "11px", fontWeight: "700", color: "#9CA3AF", marginBottom: "8px" }}>ADD NODE</div>
        <select onChange={onDropdownSelect} style={{ width: "100%", padding: "10px", borderRadius: 4, border: `1px solid ${BORDER_COLOR}`, background: "#fff", fontSize: "13px", color: DARK_GREY, outline: "none", cursor: "pointer", marginBottom:"16px" }}>
          <option value="">➕ Select Component...</option>
          <optgroup label="Inputs">
            <option value="digitalInputNode">Digital Input</option>
            <option value="analogInputNode">Analog Input</option>
          </optgroup>
          <optgroup label="Logic Gates">
            <option value="andNode">AND Gate</option>
            <option value="orNode">OR Gate</option>
            <option value="xorNode">XOR Gate</option>
            <option value="notNode">NOT Gate</option>
          </optgroup>
          <optgroup label="Comparators">
            <option value="ltNode">LT (Less Than)</option>
            <option value="gtNode">GT (Greater Than)</option>
          </optgroup>
          <optgroup label="Control">
            <option value="tonNode">TON</option>
            <option value="toffNode">TOFF</option>
            <option value="2oo3Node">2oo3 Voter</option>
            <option value="coilNode">Coil</option>
            <option value="relayNode">Relay</option>
          </optgroup>
        </select>

        <div style={{ fontSize: "11px", fontWeight: "700", color: "#9CA3AF", marginBottom: "8px" }}>SIMULATION CONTROL</div>
        <button 
          onClick={() => setRunning(r => !r)}
          style={{ width: "100%", padding: "10px", borderRadius: 6, border: "none", background: running ? "#FEF2F2" : "#ECFDF5", color: running ? DANGER_RED : SUCCESS_GREEN, fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize:"12px" }}
        >
          <span style={{ width: 8, height: 8, background: running ? DANGER_RED : SUCCESS_GREEN, borderRadius: "50%", animation: running?"pulse 1s infinite":"" }}/>
          {running ? "STOP" : "RUN"}
        </button>
      </div>

      {/* --- MODALS --- */}
      <ContextMenu {...menu} onDelete={deleteItem} onClose={() => setMenu(p => ({ ...p, visible: false }))} />
      <ConfirmModal isOpen={confirmData.open} msg={confirmData.msg} onConfirm={confirmData.action} onCancel={() => setConfirmData({ open: false })} />
      <GateInputModal isOpen={gateConfig.open} type={gateConfig.type} onConfirm={onGateConfigConfirm} onCancel={() => setGateConfig({ open: false, type: "" })} />
    </div>
  );
}