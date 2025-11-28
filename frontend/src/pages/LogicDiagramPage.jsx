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
  Handle
} from "reactflow";
import "reactflow/dist/style.css";

/* =========================
   JSL THEME COLORS
   ========================= */
const ORANGE = "#E06A1B";
const DARK = "#2E2E2E";
const GREY = "#E0E0E0";
const WHITE = "#FFFFFF";
const BLACK = "#000000";

/* =========================
   API BASE (existing backend)
   ========================= */
const API_BASE = "http://localhost:8080/logic";

/* =========================
   Small helpers
   ========================= */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const numberOr = (v, d = 0) => (v === "" || v === undefined || v === null ? d : Number(v));
const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

/* =========================
   Global node style factory (JSL style)
   ========================= */
const nodeStyle = (isOn = false, width = 180, minH = 70) => ({
  width,
  minHeight: minH,
  padding: 8,
  borderRadius: 8,
  background: "#0b0f13", // dark card for canvas contrast
  color: "#fff",
  border: isOn ? `2px solid rgba(224,127,27,0.98)` : "1px solid #263244",
  boxShadow: isOn ? `0 6px 20px rgba(224,127,27,0.12)` : "0 4px 10px rgba(0,0,0,0.25)",
  position: "relative",
  fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial",
});

/* =========================
   Minimal node components (converted to JSL colors)
   These are intentionally compact but full-featured with onChange wiring
   ========================= */

const IECShape = React.memo(({ label, small = false }) => (
  <div style={{ pointerEvents: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
    <svg width={small ? 48 : 72} height={small ? 32 : 48}>
      <rect x="0" y="0" width="72" height="48" rx="6" fill="#071018" stroke="#263244" strokeWidth="2" />
      <text x="36" y="28" textAnchor="middle" fontWeight="700" fontSize={small ? 10 : 14} fill={ORANGE}>
        {label}
      </text>
    </svg>
  </div>
));

const AnalogInputNode = React.memo(({ id, data }) => {
  const onChange = (newData) => data.onChange?.({ ...data, ...newData });
  const simValue = data?.simValue ?? 0;
  const desc = data?.desc ?? "";
  const isOn = Number(simValue) !== 0;

  return (
    <div style={nodeStyle(isOn, 220)}>
      {isOn && <div style={{ position: "absolute", top: 6, right: 8, width: 10, height: 10, borderRadius: 6, background: "#22ff55", boxShadow: "0 0 8px #22ff55" }} />}
      <div style={{ textAlign: "center", fontWeight: 800, color: ORANGE }}>ANALOG IN</div>

      <div style={{ marginTop: 8 }}>
        <label style={{ fontSize: 12, color: "#ddd" }}>Description</label>
        <input value={desc} onChange={(e) => onChange({ desc: e.target.value })} style={{ width: "100%", marginTop: 6, padding: 6, background: "#000", color: "#fff", border: "1px solid #444", borderRadius: 4 }} />
      </div>

      <div style={{ marginTop: 8 }}>
        <label style={{ fontSize: 12, color: "#ddd" }}>Sim value</label>
        <input type="number" value={simValue} onChange={(e) => onChange({ simValue: e.target.value === "" ? "" : Number(e.target.value) })} style={{ width: "100%", marginTop: 6, padding: 6, background: "#000", color: "#fff", border: "1px solid #444", borderRadius: 4 }} />
      </div>

      <div style={{ position: "absolute", left: -8, top: "50%", transform: "translateY(-50%)" }}>
        <Handle type="target" position="left" style={{ background: "#777777ff", width: 12, height: 12, borderRadius: 6 }} />
      </div>
      <div style={{ position: "absolute", right: -8, top: "50%", transform: "translateY(-50%)" }}>
        <Handle type="source" position="right" style={{ background: ORANGE, width: 12, height: 12, borderRadius: 6 }} />
      </div>
    </div>
  );
});

const DigitalInputNode = React.memo(({ id, data }) => {
  const onChange = (newData) => data.onChange?.({ ...data, ...newData });
  const value = Number(data?.value ?? 0);
  const desc = data?.desc ?? "";
  const isOn = value === 1;
  return (
    <div style={nodeStyle(isOn, 170)}>
      {isOn && <div style={{ position: "absolute", top: 6, right: 8, width: 10, height: 10, borderRadius: 6, background: "#22ff55", boxShadow: "0 0 8px #22ff55" }} />}
      <div style={{ textAlign: "center", fontWeight: 800, color: ORANGE }}>DIGITAL IN</div>
      <div style={{ marginTop: 8 }}>
        <input value={desc} onChange={(e) => onChange({ desc: e.target.value })} placeholder="Description" style={{ width: "100%", padding: 6, background: "#000", color: "#fff", border: "1px solid #444", borderRadius: 4 }} />
      </div>
      <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 12, color: "#ddd" }}>Value</div>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox" checked={value === 1} onChange={(e) => onChange({ value: e.target.checked ? 1 : 0 })} />
          <div style={{ fontWeight: 700 }}>{value === 1 ? "ON" : "OFF"}</div>
        </label>
      </div>

      <div style={{ position: "absolute", left: -8, top: "50%", transform: "translateY(-50%)" }}>
        <Handle type="target" position="left" style={{ background: "#777", width: 12, height: 12, borderRadius: 6 }} />
      </div>
      <div style={{ position: "absolute", right: -8, top: "50%", transform: "translateY(-50%)" }}>
        <Handle type="source" position="right" style={{ background: ORANGE, width: 12, height: 12, borderRadius: 6 }} />
      </div>
    </div>
  );
});

const MultiInputNode = React.memo(({ id, data }) => {
  const inputCount = Math.max(1, Math.min(8, Number(data.inputCount || 2)));
  const boxHeight = Math.max(70, inputCount * 26);
  const label = data.label || "GATE";
  const isOn = Number(data?.value ?? 0) === 1;

  return (
    <div style={nodeStyle(isOn, 140, boxHeight)}>
      {isOn && <div style={{ position: "absolute", top: 6, right: 8, width: 10, height: 10, borderRadius: 6, background: "#22ff55", boxShadow: "0 0 8px #22ff55" }} />}
      {Array.from({ length: inputCount }).map((_, i) => {
        const topPx = Math.round(((i + 1) * boxHeight) / (inputCount + 1));
        return (
          <div key={i} style={{ position: "absolute", left: -8, top: topPx, transform: "translateY(-50%)" }}>
            <Handle type="target" id={`in-${i}`} position="left" style={{ background: "#777", width: 12, height: 12, borderRadius: 6 }} />
          </div>
        );
      })}
      <div style={{ pointerEvents: "none" }}><IECShape label={label} /></div>
      <div style={{ position: "absolute", right: -8, top: "50%", transform: "translateY(-50%)" }}>
        <Handle type="source" id="out" position="right" style={{ background: ORANGE, width: 12, height: 12, borderRadius: 6 }} />
      </div>
    </div>
  );
});

const SingleIONode = React.memo(({ id, data }) => {
  const label = data.label || "NODE";
  const isOn = Number(data?.value ?? 0) === 1;
  return (
    <div style={nodeStyle(isOn, 140)}>
      {isOn && <div style={{ position: "absolute", top: 6, right: 8, width: 10, height: 10, borderRadius: 6, background: "#22ff55", boxShadow: "0 0 8px #22ff55" }} />}
      <div style={{ pointerEvents: "none" }}><IECShape label={label} /></div>
      <div style={{ position: "absolute", left: -8, top: "50%", transform: "translateY(-50%)" }}>
        <Handle type="target" position="left" style={{ background: "#777", width: 12, height: 12, borderRadius: 6 }} />
      </div>
      <div style={{ position: "absolute", right: -8, top: "50%", transform: "translateY(-50%)" }}>
        <Handle type="source" position="right" style={{ background: ORANGE, width: 12, height: 12, borderRadius: 6 }} />
      </div>
    </div>
  );
});

const LTNode = React.memo(({ id, data }) => {
  const sp = numberOr(data.setpoint, 0);
  const hyst = numberOr(data.hysteresis, 0);
  const isOn = Number(data?.value ?? 0) === 1;
  const onChange = (newData) => data.onChange?.({ ...data, ...newData });

  return (
    <div style={nodeStyle(isOn, 220)}>
      {isOn && <div style={{ position: "absolute", top: 6, right: 8, width: 10, height: 10, borderRadius: 6, background: "#22ff55", boxShadow: "0 0 8px #22ff55" }} />}
      <div style={{ textAlign: "center", fontWeight: 800, color: ORANGE }}>LT</div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 12, color: "#ddd" }}>Setpoint</label>
          <input type="number" value={sp} onChange={(e) => onChange({ setpoint: e.target.value === "" ? "" : Number(e.target.value) })} style={{ width: "100%", marginTop: 6, padding: 6, background: "#000", color: "#fff", border: "1px solid #444", borderRadius: 4 }} />
        </div>
        <div style={{ width: 90 }}>
          <label style={{ fontSize: 12, color: "#ddd" }}>Hyst</label>
          <input type="number" value={hyst} onChange={(e) => onChange({ hysteresis: e.target.value === "" ? "" : Number(e.target.value) })} style={{ width: "100%", marginTop: 6, padding: 6, background: "#000", color: "#fff", border: "1px solid #444", borderRadius: 4 }} />
        </div>
      </div>

      <div style={{ position: "absolute", left: -8, top: "50%", transform: "translateY(-50%)" }}>
        <Handle type="target" position="left" style={{ background: "#777", width: 12, height: 12, borderRadius: 6 }} />
      </div>
      <div style={{ position: "absolute", right: -8, top: "50%", transform: "translateY(-50%)" }}>
        <Handle type="source" position="right" style={{ background: ORANGE, width: 12, height: 12, borderRadius: 6 }} />
      </div>
    </div>
  );
});

const GTNode = React.memo(({ id, data }) => {
  const sp = numberOr(data.setpoint, 0);
  const hyst = numberOr(data.hysteresis, 0);
  const isOn = Number(data?.value ?? 0) === 1;
  const onChange = (newData) => data.onChange?.({ ...data, ...newData });

  return (
    <div style={nodeStyle(isOn, 220)}>
      {isOn && <div style={{ position: "absolute", top: 6, right: 8, width: 10, height: 10, borderRadius: 6, background: "#22ff55", boxShadow: "0 0 8px #22ff55" }} />}
      <div style={{ textAlign: "center", fontWeight: 800, color: ORANGE }}>GT</div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 12, color: "#ddd" }}>Setpoint</label>
          <input type="number" value={sp} onChange={(e) => onChange({ setpoint: e.target.value === "" ? "" : Number(e.target.value) })} style={{ width: "100%", marginTop: 6, padding: 6, background: "#000", color: "#fff", border: "1px solid #444", borderRadius: 4 }} />
        </div>
        <div style={{ width: 90 }}>
          <label style={{ fontSize: 12, color: "#ddd" }}>Hyst</label>
          <input type="number" value={hyst} onChange={(e) => onChange({ hysteresis: e.target.value === "" ? "" : Number(e.target.value) })} style={{ width: "100%", marginTop: 6, padding: 6, background: "#000", color: "#fff", border: "1px solid #444", borderRadius: 4 }} />
        </div>
      </div>

      <div style={{ position: "absolute", left: -8, top: "50%", transform: "translateY(-50%)" }}>
        <Handle type="target" position="left" style={{ background: "#777", width: 12, height: 12, borderRadius: 6 }} />
      </div>
      <div style={{ position: "absolute", right: -8, top: "50%", transform: "translateY(-50%)" }}>
        <Handle type="source" position="right" style={{ background: ORANGE, width: 12, height: 12, borderRadius: 6 }} />
      </div>
    </div>
  );
});

const TwoOfThreeNode = React.memo(({ id, data }) => {
  const isOn = Number(data?.value ?? 0) === 1;
  const boxH = 120;
  return (
    <div style={nodeStyle(isOn, 160, boxH)}>
      {isOn && <div style={{ position: "absolute", top: 6, right: 8, width: 10, height: 10, borderRadius: 6, background: "#22ff55", boxShadow: "0 0 8px #22ff55" }} />}
      <div style={{ textAlign: "center", fontWeight: 800, color: ORANGE, paddingTop: 8 }}>2oo3</div>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ position: "absolute", left: -8, top: 28 + i * 24 }}>
          <Handle type="target" id={`in-${i}`} position="left" style={{ background: "#777", width: 12, height: 12, borderRadius: 6 }} />
        </div>
      ))}
      <div style={{ position: "absolute", right: -8, top: "50%", transform: "translateY(-50%)" }}>
        <Handle type="source" id="out" position="right" style={{ background: ORANGE, width: 12, height: 12, borderRadius: 6 }} />
      </div>
    </div>
  );
});

const TONNode = React.memo(({ id, data }) => {
  const delay = numberOr(data.delay, 1);
  const isOn = Number(data?.value ?? 0) === 1;
  const onChange = (newData) => data.onChange?.({ ...data, ...newData });
  return (
    <div style={nodeStyle(isOn, 200)}>
      {isOn && <div style={{ position: "absolute", top: 6, right: 8, width: 10, height: 10, borderRadius: 6, background: "#22ff55", boxShadow: "0 0 8px #22ff55" }} />}
      <div style={{ textAlign: "center", fontWeight: 800, color: ORANGE }}>TON</div>
      <div style={{ marginTop: 8 }}>
        <label style={{ fontSize: 12, color: "#ddd" }}>Delay (s)</label>
        <input type="number" min="0" value={delay} onChange={(e) => onChange({ delay: e.target.value === "" ? "" : Number(e.target.value) })} style={{ width: "100%", marginTop: 6, padding: 6, background: "#000", color: "#fff", border: "1px solid #444", borderRadius: 4 }} />
      </div>
      <div style={{ position: "absolute", left: -8, top: "50%", transform: "translateY(-50%)" }}>
        <Handle type="target" position="left" style={{ background: "#777", width: 12, height: 12, borderRadius: 6 }} />
      </div>
      <div style={{ position: "absolute", right: -8, top: "50%", transform: "translateY(-50%)" }}>
        <Handle type="source" position="right" style={{ background: ORANGE, width: 12, height: 12, borderRadius: 6 }} />
      </div>
    </div>
  );
});

const TOFFNode = React.memo(({ id, data }) => {
  const delay = numberOr(data.delay, 1);
  const isOn = Number(data?.value ?? 0) === 1;
  const onChange = (newData) => data.onChange?.({ ...data, ...newData });
  return (
    <div style={nodeStyle(isOn, 200)}>
      {isOn && <div style={{ position: "absolute", top: 6, right: 8, width: 10, height: 10, borderRadius: 6, background: "#22ff55", boxShadow: "0 0 8px #22ff55" }} />}
      <div style={{ textAlign: "center", fontWeight: 800, color: ORANGE }}>TOFF</div>
      <div style={{ marginTop: 8 }}>
        <label style={{ fontSize: 12, color: "#ddd" }}>Delay (s)</label>
        <input type="number" min="0" value={delay} onChange={(e) => onChange({ delay: e.target.value === "" ? "" : Number(e.target.value) })} style={{ width: "100%", marginTop: 6, padding: 6, background: "#000", color: "#fff", border: "1px solid #444", borderRadius: 4 }} />
      </div>
      <div style={{ position: "absolute", left: -8, top: "50%", transform: "translateY(-50%)" }}>
        <Handle type="target" position="left" style={{ background: "#777", width: 12, height: 12, borderRadius: 6 }} />
      </div>
      <div style={{ position: "absolute", right: -8, top: "50%", transform: "translateY(-50%)" }}>
        <Handle type="source" position="right" style={{ background: ORANGE, width: 12, height: 12, borderRadius: 6 }} />
      </div>
    </div>
  );
});

/* =========================
   Utility: attach onChange to loaded nodes
   ========================= */
function attachOnChangeToLoadedNodes(nodes = [], createOnChange) {
  return (nodes || []).map((n) => ({ ...n, data: { ...(n.data || {}), onChange: createOnChange(n.id) } }));
}

/* =========================
   Simulation engine (converted for JSL)
   - start/stop
   - updates nodes/edges periodically
   ========================= */
function initSimulation({ nodesRef, edgesRef, setNodes, setEdges, runtimeRef, simTickMs = 200, uiRefreshMs = 600 }) {
  const pendingNodeUpdatesRef = { current: null };
  const pendingEdgeUpdatesRef = { current: null };
  let simTimer = null;
  let uiTimer = null;

  const readNodeVal = (nodesLocal, nodeId) => {
    const n = nodesLocal.find((x) => x.id === nodeId);
    if (!n) return 0;
    if (n.type === "analogInputNode") return numberOr(n.data?.simValue, 0);
    return numberOr(n.data?.value, 0);
  };

  const start = () => {
    if (simTimer) return;
    simTimer = setInterval(() => {
      const nodesLocal = nodesRef.current || [];
      const edgesLocal = edgesRef.current || [];

      // incoming map
      const incoming = {};
      edgesLocal.forEach((e) => { if (!incoming[e.target]) incoming[e.target] = []; incoming[e.target].push(e.source); });

      const nextValues = {};

      // inputs
      nodesLocal.forEach((n) => {
        if (n.type === "digitalInputNode") nextValues[n.id] = numberOr(n.data?.value, 0);
        else if (n.type === "analogInputNode") nextValues[n.id] = numberOr(n.data?.simValue, 0);
      });

      // LT/GT
      nodesLocal.forEach((n) => {
        if (n.type === "ltNode" || n.type === "gtNode") {
          const srcs = incoming[n.id] || [];
          const input = srcs.length ? readNodeVal(nodesLocal, srcs[0]) : 0;
          const sp = numberOr(n.data.setpoint, 0);
          const hyst = numberOr(n.data.hysteresis, 0);
          const prev = (runtimeRef.current.lt || {})[n.id] ?? 0;
          let out = prev;
          if (n.type === "ltNode") {
            if (input < sp - hyst) out = 1;
            else if (input > sp + hyst) out = 0;
          } else {
            if (input > sp + hyst) out = 1;
            else if (input < sp - hyst) out = 0;
          }
          runtimeRef.current.lt = runtimeRef.current.lt || {};
          runtimeRef.current.lt[n.id] = out;
          nextValues[n.id] = out;
        }
      });

      // logic gates & flipflops
      nodesLocal.forEach((n) => {
        if (["andNode", "orNode", "xorNode", "notNode", "relayNode", "coilNode", "srNode", "rsNode"].includes(n.type)) {
          const srcs = incoming[n.id] || [];
          const inputs = srcs.map((s) => (typeof nextValues[s] !== "undefined" ? nextValues[s] : readNodeVal(nodesLocal, s)));
          const binInputs = inputs.map((iv) => (typeof iv === "number" ? (iv > 0 ? 1 : 0) : iv ? 1 : 0));
          let out = 0;
          if (n.type === "andNode") out = binInputs.length > 0 && binInputs.every((v) => v === 1) ? 1 : 0;
          else if (n.type === "orNode") out = binInputs.some((v) => v === 1) ? 1 : 0;
          else if (n.type === "xorNode") out = binInputs.filter((v) => v === 1).length % 2 === 1 ? 1 : 0;
          else if (n.type === "notNode") out = binInputs[0] === 1 ? 0 : 1;
          else if (n.type === "relayNode" || n.type === "coilNode") out = binInputs[0] === 1 ? 1 : 0;
          else if (n.type === "srNode" || n.type === "rsNode") {
            const S = binInputs[0] ?? 0;
            const R = binInputs[1] ?? 0;
            const prev = (runtimeRef.current.flip || {})[n.id] ?? 0;
            let q = prev;
            if (S === 1 && R === 0) q = 1;
            else if (S === 0 && R === 1) q = 0;
            else if (S === 1 && R === 1) q = 0;
            runtimeRef.current.flip = runtimeRef.current.flip || {};
            runtimeRef.current.flip[n.id] = q;
            out = q;
          }
          nextValues[n.id] = out;
        }
      });

      // 2oo3
      nodesLocal.forEach((n) => {
        if (n.type === "2oo3Node") {
          const srcs = incoming[n.id] || [];
          const inputs = srcs.slice(0, 3).map((s) => (typeof nextValues[s] !== "undefined" ? nextValues[s] : readNodeVal(nodesLocal, s)));
          const bin = inputs.map((iv) => (typeof iv === "number" ? (iv > 0 ? 1 : 0) : iv ? 1 : 0));
          const sum = bin.reduce((a, b) => a + b, 0);
          nextValues[n.id] = sum >= 2 ? 1 : 0;
        }
      });

      // TON
      nodesLocal.forEach((n) => {
        if (n.type === "tonNode") {
          const srcs = incoming[n.id] || [];
          const rawIn = srcs.length ? (typeof nextValues[srcs[0]] !== "undefined" ? nextValues[srcs[0]] : readNodeVal(nodesLocal, srcs[0])) : 0;
          const inBin = typeof rawIn === "number" ? (rawIn > 0 ? 1 : 0) : rawIn ? 1 : 0;
          const key = n.id;
          const delayMs = Math.max(0, numberOr(n.data.delay, 1)) * 1000;
          let st = (runtimeRef.current.ton || {})[key] || { remaining: delayMs, output: 0, active: false };
          runtimeRef.current.ton = runtimeRef.current.ton || {};
          if (inBin === 1) {
            if (!st.active) { st.active = true; st.remaining = delayMs; }
            else { st.remaining = Math.max(0, st.remaining - simTickMs); }
            st.output = st.remaining <= 0 ? 1 : 0;
          } else {
            st = { remaining: delayMs, output: 0, active: false };
          }
          runtimeRef.current.ton[key] = st;
          nextValues[n.id] = st.output;
        }
      });

      // TOFF
      nodesLocal.forEach((n) => {
        if (n.type === "toffNode") {
          const srcs = incoming[n.id] || [];
          const rawIn = srcs.length ? (typeof nextValues[srcs[0]] !== "undefined" ? nextValues[srcs[0]] : readNodeVal(nodesLocal, srcs[0])) : 0;
          const inBin = typeof rawIn === "number" ? (rawIn > 0 ? 1 : 0) : rawIn ? 1 : 0;
          const key = n.id;
          const delayMs = Math.max(0, numberOr(n.data.delay, 1)) * 1000;
          let st = (runtimeRef.current.toff || {})[key] || { remaining: 0, output: 0 };
          runtimeRef.current.toff = runtimeRef.current.toff || {};
          if (inBin === 1) {
            st = { ...st, output: 1, remaining: delayMs };
          } else {
            if (st.output === 1) {
              st.remaining = Math.max(0, (st.remaining || delayMs) - simTickMs);
              if (st.remaining <= 0) { st.output = 0; st.remaining = 0; } else { st.output = 1; }
            } else { st = { remaining: 0, output: 0 }; }
          }
          runtimeRef.current.toff[key] = st;
          nextValues[n.id] = st.output;
        }
      });

      // prepare updates
      const newNodes = nodesLocal.map((n) => {
        if (n.type === "analogInputNode") return { ...n, data: { ...n.data, value: Number(n.data.simValue) !== 0 ? 1 : 0 } };
        if (n.type === "digitalInputNode") return n;
        const v = typeof nextValues[n.id] !== "undefined" ? Number(nextValues[n.id]) : 0;
        return { ...n, data: { ...n.data, value: v } };
      });

      const newEdges = edgesLocal.map((e) => {
        const srcVal = typeof nextValues[e.source] !== "undefined" ? nextValues[e.source] : readNodeVal(nodesLocal, e.source);
        const active = srcVal ? 1 : 0;
        return { ...e, data: { ...(e.data || {}), active }, style: { stroke: active ? ORANGE : "#444", strokeWidth: active ? 3 : 1.5 }, className: active ? "edge-active" : "" };
      });

      pendingNodeUpdatesRef.current = newNodes;
      pendingEdgeUpdatesRef.current = newEdges;
    }, simTickMs);

    uiTimer = setInterval(() => {
      if (pendingNodeUpdatesRef.current) {
        setNodes(pendingNodeUpdatesRef.current);
        nodesRef.current = pendingNodeUpdatesRef.current;
        pendingNodeUpdatesRef.current = null;
      }
      if (pendingEdgeUpdatesRef.current) {
        setEdges(pendingEdgeUpdatesRef.current);
        edgesRef.current = pendingEdgeUpdatesRef.current;
        pendingEdgeUpdatesRef.current = null;
      }
    }, uiRefreshMs);
  };

  const stop = () => {
    if (simTimer) { clearInterval(simTimer); simTimer = null; }
    if (uiTimer) { clearInterval(uiTimer); uiTimer = null; }
    runtimeRef.current = { ton: {}, toff: {}, lt: {}, gt: {}, flip: {} };
    setNodes((nds) => nds.map((n) => {
      if (n.type === "analogInputNode" || n.type === "digitalInputNode") return n;
      return { ...n, data: { ...n.data, value: 0 } };
    }));
    setEdges((eds) => eds.map((e) => ({ ...e, data: { ...(e.data || {}), active: 0 }, style: { stroke: "#444", strokeWidth: 1.5 } })));
  };

  const isRunning = () => !!simTimer;

  return { start, stop, isRunning };
}

/* =========================
   Context menu (SCADA-style converted to JSL card)
   ========================= */
function clampToViewport(x, y, width = 260, height = 120) {
  if (typeof window === "undefined") return { x, y };
  const vw = window.innerWidth, vh = window.innerHeight;
  const nx = Math.min(Math.max(8, x), Math.max(8, vw - width - 8));
  const ny = Math.min(Math.max(8, y), Math.max(8, vh - height - 8));
  return { x: nx, y: ny };
}

function ContextMenuJSL({ context, onDelete, onClose }) {
  if (!context?.visible) return null;
  const pos = clampToViewport(context.x, context.y, 280, 130);
  return (
    <div style={{ position: "fixed", left: pos.x, top: pos.y, zIndex: 99999 }}>
      <div style={{ background: WHITE, border: `3px solid ${ORANGE}`, padding: 14, borderRadius: 10, width: 260, boxShadow: "0 8px 30px rgba(0,0,0,0.12)" }}>
        <div style={{ color: DARK, fontWeight: 800, marginBottom: 8 }}>Actions</div>
        <div style={{ color: "#333", marginBottom: 10 }}>Target: {context.type === "node" ? `Node ${context.id}` : `Edge ${context.id}`}</div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={() => { onDelete(); }} style={{ background: "#a00", color: "#fff", padding: "10px 14px", borderRadius: 8, fontWeight: 800 }}>DELETE</button>
          <button onClick={() => onClose()} style={{ background: "#eee", color: "#111", padding: "10px 14px", borderRadius: 8 }}>CANCEL</button>
        </div>
      </div>
    </div>
  );
}

/* =========================
   Main Page Component
   Props:
     - auth: string (Authorization header value to send to backend)
   ========================= */
export default function LogicDiagramPage({ auth }) {
  // JWT axios instance (auth passed as prop)
  const api = useMemo(() => axios.create({ baseURL: API_BASE, headers: { Authorization: auth } }), [auth]);

  // ReactFlow state
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);

  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);

  const [diagramName, setDiagramName] = useState("");
  const [diagramList, setDiagramList] = useState([]);
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, type: null, id: null });

  // modal for multi-input gates
  const [showInputModal, setShowInputModal] = useState(false);
  const [pendingType, setPendingType] = useState("");
  const [pendingInputs, setPendingInputs] = useState(2);

  // simulation
  const [running, setRunning] = useState(false);
  const runtimeRef = useRef({ ton: {}, toff: {}, lt: {}, gt: {}, flip: {} });
  const simControllerRef = useRef(null);

  // createOnChange factory
  const createOnChangeForId = useCallback((id) => (newData) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...newData } } : n)));
  }, []);

  // add node handler
  const addNodeHandler = useCallback((type, inputCount = 2) => {
    const id = uid();
    const buildData = (() => {
      const label = (type || "").replace(/Node$/i, "").toUpperCase();
      let d = { label, onChange: undefined, value: 0 };
      if (type === "analogInputNode") d = { ...d, simValue: 0, desc: "", value: 0 };
      if (type === "digitalInputNode") d = { ...d, desc: "", value: 0 };
      if (["andNode", "orNode", "xorNode"].includes(type)) d = { ...d, inputCount: clamp(inputCount, 2, 8), value: 0 };
      if (type === "ltNode" || type === "gtNode") d = { ...d, setpoint: 0, hysteresis: 0, value: 0 };
      if (type === "2oo3Node") d = { ...d, value: 0 };
      if (type === "tonNode" || type === "toffNode") d = { ...d, delay: 1, value: 0 };
      return d;
    })();
    buildData.onChange = createOnChangeForId(id);
    const node = { id, type, position: { x: 200 + (nodesRef.current?.length || 0) * 8, y: 120 + (nodesRef.current?.length || 0) * 6 }, data: buildData };
    setNodes((nds) => [...nds, node]);
  }, [createOnChangeForId]);

  // dropdown add
  const onDropdownAdd = (e) => {
    const val = e.target.value;
    if (!val) return;
    if (["andNode", "orNode", "xorNode"].includes(val)) {
      setPendingType(val); setPendingInputs(2); setShowInputModal(true); e.target.selectedIndex = 0; return;
    }
    addNodeHandler(val, 2);
    e.target.selectedIndex = 0;
  };

  const confirmAddWithCountLocal = () => {
    addNodeHandler(pendingType, Number(pendingInputs || 2));
    setShowInputModal(false); setPendingType(""); setPendingInputs(2);
  };

  // list diagrams
  const loadDiagramList = useCallback(async () => {
    try {
      const res = await api.get("/list");
      setDiagramList(res.data || []);
    } catch (e) {
      console.warn("Could not load list", e);
    }
  }, [api]);

  useEffect(() => { loadDiagramList(); }, [loadDiagramList]);

  // save
  const saveHandler = async () => {
    if (!diagramName.trim()) return alert("Enter diagram name");
    try {
      const payload = { name: diagramName.trim(), data: { nodes, edges } };
      await api.post("/save", payload);
      await loadDiagramList();
      alert("Saved");
    } catch (e) {
      console.error("Save failed", e);
      alert("Save failed");
    }
  };

  // load
  const loadHandler = async (name) => {
    try {
      const res = await api.get(`/load/${encodeURIComponent(name)}`);
      if (!res.data.exists) return alert("Not found");
      const loaded = (res.data.data.nodes || []).map((n) => ({ ...n, data: { ...(n.data || {}), onChange: createOnChangeForId(n.id) } }));
      setNodes(loaded); setEdges(res.data.data.edges || []); setDiagramName(name);
      runtimeRef.current = { ton: {}, toff: {}, lt: {}, gt: {}, flip: {} };
    } catch (e) {
      console.error("Load failed", e);
      alert("Load failed");
    }
  };

  // delete
  const deleteHandler = async (name) => {
    if (!confirm(`Delete diagram "${name}"?`)) return;
    try {
      await api.delete(`/delete/${encodeURIComponent(name)}`);
      await loadDiagramList();
    } catch (e) {
      console.error("Delete failed", e);
      alert("Delete failed");
    }
  };

  const newHandler = () => {
    if (!confirm("Create new diagram? Unsaved changes will be lost.")) return;
    setNodes([]); setEdges([]); setDiagramName(""); runtimeRef.current = { ton: {}, toff: {}, lt: {}, gt: {}, flip: {} };
  };

  // node types mapping
  const nodeTypes = useMemo(() => ({
    analogInputNode: AnalogInputNode,
    digitalInputNode: DigitalInputNode,
    andNode: MultiInputNode,
    orNode: MultiInputNode,
    xorNode: MultiInputNode,
    notNode: SingleIONode,
    relayNode: SingleIONode,
    coilNode: SingleIONode,
    ltNode: LTNode,
    gtNode: GTNode,
    "2oo3Node": TwoOfThreeNode,
    tonNode: TONNode,
    toffNode: TOFFNode
  }), []);

  // reactflow handlers
  const onNodesChange = useCallback((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);
  const onConnect = useCallback((params) => setEdges((eds) => addEdge({ ...params, animated: false }, eds)), []);

  // context menu functions
  const onNodeContext = (evt, node) => {
    evt.preventDefault();
    setContextMenu({ visible: true, x: evt.clientX, y: evt.clientY, type: "node", id: node.id });
  };
  const onEdgeContext = (evt, edge) => {
    evt.preventDefault();
    setContextMenu({ visible: true, x: evt.clientX, y: evt.clientY, type: "edge", id: edge.id });
  };
  const hideContext = () => setContextMenu((c) => ({ ...c, visible: false }));

  const performContextDelete = () => {
    if (!contextMenu?.visible) return;
    const { type, id } = contextMenu;
    if (type === "node") {
      setNodes((nds) => nds.filter((n) => n.id !== id));
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    } else if (type === "edge") {
      setEdges((eds) => eds.filter((e) => e.id !== id));
    }
    hideContext();
  };

  // init simulation
  useEffect(() => {
    simControllerRef.current = initSimulation({ nodesRef, edgesRef, setNodes, setEdges, runtimeRef, simTickMs: 200, uiRefreshMs: 600 });
    return () => { try { simControllerRef.current?.stop(); } catch (e) { } };
  }, []);

  useEffect(() => { if (running) simControllerRef.current?.start(); else simControllerRef.current?.stop(); }, [running]);

  // styling for canvas and active edges
  const rfStyle = { background: "#071018" };

  return (
    <div style={{ display: "flex", height: "100vh", width: "100vw", background: WHITE }}>
      <style>{`
        .edge-active .react-flow__edge-path { stroke: ${ORANGE} !important; stroke-width: 3px !important; stroke-dasharray: 8 6; filter: drop-shadow(0 0 6px ${ORANGE}); animation: dashmove 0.9s linear infinite; }
        .react-flow__edge-path { transition: stroke 0.18s, stroke-width 0.18s; }
        @keyframes dashmove { to { stroke-dashoffset: -20; } }
      `}</style>

      {/* Sidebar */}
      <div style={{ width: 360, padding: 16, borderRight: `1px solid ${GREY}`, background: WHITE, color: DARK, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ color: ORANGE, margin: 0 }}>Logic Toolbox</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={newHandler} style={{ background: "#fff", color: DARK, padding: "6px 10px", borderRadius: 6, border: `1px solid ${GREY}` }}>New</button>
          </div>
        </div>

        <select onChange={onDropdownAdd} style={{ width: "100%", padding: 10, borderRadius: 6, background: WHITE, color: DARK, border: `2px solid ${ORANGE}`, fontWeight: 700 }}>
          <option value="">➕ Add Block…</option>
          <option value="analogInputNode">Analog IN</option>
          <option value="digitalInputNode">Digital IN</option>
          <option value="andNode">AND (multi)</option>
          <option value="orNode">OR (multi)</option>
          <option value="xorNode">XOR (multi)</option>
          <option value="notNode">NOT</option>
          <option value="coilNode">COIL</option>
          <option value="relayNode">RELAY</option>
          <option value="ltNode">LT (Setpoint)</option>
          <option value="gtNode">GT (Setpoint)</option>
          <option value="2oo3Node">2oo3</option>
          <option value="tonNode">TON</option>
          <option value="toffNode">TOFF</option>
        </select>

        <div>
          <input placeholder="Diagram name" value={diagramName} onChange={(e) => setDiagramName(e.target.value)} style={{ width: "100%", padding: 8, borderRadius: 6, background: WHITE, color: DARK, border: `1px solid ${GREY}` }} />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={saveHandler} style={{ flex: 1, background: ORANGE, borderRadius: 6, padding: 8, border: "none", fontWeight: 700, color: WHITE }}>💾 Save</button>
            <button onClick={() => { setNodes([]); setEdges([]); }} style={{ flex: 1, background: GREY, borderRadius: 6, padding: 8 }}>Clear</button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setRunning((r) => !r)} style={{ padding: "8px 12px", borderRadius: 6, background: running ? "#ef4444" : "#22c55e", color: BLACK, fontWeight: 800 }}>
            {running ? "Stop" : "Start"} Simulation
          </button>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 6 }}>
            <div style={{ fontSize: 12, color: "#666" }}>Tick: 200ms · UI: 600ms</div>
          </div>
        </div>

        <div style={{ overflow: "auto", flex: 1 }}>
          <h4 style={{ marginTop: 0, color: DARK }}>Saved Diagrams</h4>
          {diagramList.length === 0 && <div style={{ color: "#666" }}>No saved diagrams</div>}
          {diagramList.map((d) => (
            <div key={d} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", border: `1px solid ${GREY}`, padding: 8, borderRadius: 6, marginTop: 8, background: "#fff" }}>
              <div style={{ color: ORANGE, fontWeight: 700 }}>{d}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => loadHandler(d)} style={{ background: GREY, color: DARK, padding: "6px 8px", borderRadius: 4 }}>Load</button>
                <button onClick={() => deleteHandler(d)} style={{ background: "#a00", color: "#fff", padding: "6px 8px", borderRadius: 4 }}>Del</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1 }} onClick={() => setContextMenu((c) => ({ ...c, visible: false }))}>
        <ReactFlow
  nodes={nodes}
  edges={edges}
  onNodesChange={onNodesChange}
  onEdgesChange={onEdgesChange}
  onConnect={onConnect}
  nodeTypes={nodeTypes}
  fitView
  style={{ background: "#ffffff" }}   // White canvas
>
  {/* Optional grid in light grey */}
  <Background color="#c05813ff" gap={16} />
  <Controls />
  <MiniMap />
</ReactFlow>
      </div>

      <ContextMenuJSL context={contextMenu} onDelete={performContextDelete} onClose={hideContext} />

      {/* Modal for multi-input */}
      {showInputModal && (
        <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)" }}>
          <div style={{ background: WHITE, border: `3px solid ${ORANGE}`, padding: 16, borderRadius: 8, width: 380 }}>
            <h3 style={{ margin: 0, color: ORANGE }}>Configure inputs for {pendingType}</h3>
            <div style={{ marginTop: 12 }}>
              <label style={{ color: DARK }}>Number of inputs (2–8)</label>
              <input type="number" min="2" max="8" value={pendingInputs} onChange={(e) => setPendingInputs(clamp(Number(e.target.value || 2), 2, 8))} style={{ width: "100%", padding: 8, marginTop: 8, borderRadius: 6, background: WHITE, color: DARK, border: `1px solid ${GREY}` }} />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
              <button onClick={() => setShowInputModal(false)} style={{ padding: "8px 12px", borderRadius: 6, background: GREY, color: DARK }}>Cancel</button>
              <button onClick={confirmAddWithCountLocal} style={{ padding: "8px 12px", borderRadius: 6, background: ORANGE, color: WHITE, fontWeight: 700 }}>Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
