import { useEffect, useLayoutEffect, useRef, useState } from "react";
import BrainCanvas from "../components/BrainCanvas";
import { buildGraph, PRESETS } from "../engine/graph";
import { useDraggable } from "../hooks/useDraggable";
import type { EngineGraph } from "../types";

interface Props {
  mode: "design" | "import";
  onNavigate: (m: "design" | "import") => void;
}

export default function Design({ mode, onNavigate }: Props) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [presetKey, setPresetKey] = useState<keyof typeof PRESETS>("autoencoder");
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [graph, setGraph] = useState<EngineGraph | null>(null);
  const graphRef = useRef<EngineGraph | null>(null);
  graphRef.current = graph;
  const [aliveCount, setAliveCount] = useState(0);

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      setDims((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (dims.w === 0 || dims.h === 0) return;
    if (graphRef.current) return;
    setGraph(buildGraph(PRESETS[presetKey].specs, dims.w, dims.h));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dims]);

  const [connectMode, setConnectMode] = useState(false);
  const [addNodeMode, setAddNodeMode] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const drag = useDraggable();

  function applyPreset(key: keyof typeof PRESETS) {
    setPresetKey(key);
    setGraph(buildGraph(PRESETS[key].specs, dims.w, dims.h));
  }

  function runForwardPass() {
    const g = graphRef.current;
    if (!g) return;
    const layers = [...new Set(g.nodes.map((n) => n.layer))].sort((a, b) => a - b);
    const travelMs = 900; // roughly how long a particle actually takes to cross one layer gap
    // the input layer has nothing upstream to wait for, so it lights immediately;
    // every later layer lights up naturally as its own particles actually arrive
    // (handled per-frame in the engine) rather than on a fixed timer
    g.nodes.filter((n) => n.layer === layers[0]).forEach((n) => (n.activation = 1));
    let delay = 0;
    for (let idx = 0; idx < layers.length - 1; idx++) {
      const l = layers[idx];
      setTimeout(() => {
        g.edges
          .filter((e) => e.alive && g.nodes.find((n) => n.id === e.from)?.layer === l)
          .forEach((e) => e.particles.push(0));
      }, delay);
      delay += travelMs;
    }
  }

  function simulateDamage() {
    const g = graphRef.current;
    if (!g) return;
    const alive = g.edges.filter((e) => e.alive);
    const numToKill = Math.floor(alive.length * 0.25);
    const shuffled = [...alive].sort(() => Math.random() - 0.5);
    shuffled.slice(0, numToKill).forEach((e) => (e.alive = false));
  }

  return (
    <div className="fullpage-stage" ref={stageRef}>
      {graph && (
        <BrainCanvas
          graph={graph}
          width={dims.w}
          height={dims.h}
          connectMode={connectMode}
          addNodeMode={addNodeMode}
          fullBleed
          onStatsChange={setAliveCount}
        />
      )}

      <div className={`dock glass ${collapsed ? "collapsed" : ""}`} style={drag.style}>
        {collapsed ? (
          <button className="dock-pill-trigger" onClick={() => setCollapsed(false)} title="Open controls">
            <span className="brand-dot" />
          </button>
        ) : (
          <>
            <button className="dock-collapse-btn" onClick={() => setCollapsed(true)} title="Collapse">
              ×
            </button>
            <div className="dock-brand dock-drag-handle" onMouseDown={drag.onMouseDown}>
              <span className="brand-dot" />
              NEURAL BRAIN
            </div>
            <div className="dock-modes">
              <button
                className={`dock-mode-tab ${mode === "design" ? "active" : ""}`}
                onClick={() => onNavigate("design")}
              >
                Design
              </button>
              <button
                className={`dock-mode-tab ${mode === "import" ? "active" : ""}`}
                onClick={() => onNavigate("import")}
              >
                Import
              </button>
            </div>

            <div className="dock-divider" />

            <span className="dock-section-label">Template</span>
            <select
              className="select"
              value={presetKey}
              onChange={(e) => applyPreset(e.target.value as keyof typeof PRESETS)}
            >
              {Object.entries(PRESETS).map(([key, p]) => (
                <option key={key} value={key}>
                  {p.label}
                </option>
              ))}
            </select>

            <div className="dock-divider" />

            <button className="btn btn-primary" onClick={runForwardPass}>
              Run forward pass
            </button>
            <button
              className={`btn ${addNodeMode ? "btn-primary" : "btn-ghost"}`}
              onClick={() => {
                setAddNodeMode((v) => !v);
                setConnectMode(false);
              }}
            >
              {addNodeMode ? "Adding… (click canvas)" : "Add node"}
            </button>
            <button
              className={`btn ${connectMode ? "btn-primary" : "btn-ghost"}`}
              onClick={() => {
                setConnectMode((v) => !v);
                setAddNodeMode(false);
              }}
            >
              {connectMode ? "Connecting…" : "Connect nodes"}
            </button>
            <button className="btn btn-ghost" onClick={simulateDamage}>
              Simulate 25% damage
            </button>
            <button className="btn btn-ghost" onClick={() => applyPreset(presetKey)}>
              Reset
            </button>

            <div className="dock-divider" />
            <span className="dock-stat">{aliveCount} live synapses</span>
          </>
        )}
      </div>
    </div>
  );
}
