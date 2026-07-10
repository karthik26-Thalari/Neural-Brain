import { useLayoutEffect, useRef, useState } from "react";
import BrainCanvas from "../components/BrainCanvas";
import { buildGraph } from "../engine/graph";
import { fetchHFConfig, fmtParams } from "../engine/huggingface";
import { useDraggable } from "../hooks/useDraggable";
import type { EngineGraph, HFModelInfo } from "../types";

const EXAMPLES = ["distilbert-base-uncased", "gpt2", "bert-base-uncased", "google/vit-base-patch16-224"];

interface Props {
  mode: "design" | "import";
  onNavigate: (m: "design" | "import") => void;
}

export default function Import({ mode, onNavigate }: Props) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<HFModelInfo | null>(null);
  const [graph, setGraph] = useState<EngineGraph | null>(null);
  const [attentionView, setAttentionView] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const drag = useDraggable();
  const graphRef = useRef<EngineGraph | null>(null);
  graphRef.current = graph;

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

  async function load(modelId?: string) {
    const target = modelId ?? input;
    if (!target.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const modelInfo = await fetchHFConfig(target);
      setInfo(modelInfo);
      const w = dims.w || 1000;
      const h = dims.h || 700;
      const g = buildGraph(modelInfo.layers, w, h, false);
      setGraph(g);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load model");
      setInfo(null);
      setGraph(null);
    } finally {
      setLoading(false);
    }
  }

  function runForwardPass() {
    const g = graphRef.current;
    if (!g) return;
    const layers = [...new Set(g.nodes.map((n) => n.layer))].sort((a, b) => a - b);
    const travelMs = 900; // roughly how long a particle actually takes to cross one layer gap
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

  return (
    <div className="fullpage-stage" ref={stageRef}>
      {graph && (
        <BrainCanvas
          graph={graph}
          width={dims.w || 1000}
          height={dims.h || 700}
          attentionView={attentionView}
          fullBleed
        />
      )}

      {!graph && (
        <div className="import-empty-hint">
          Paste a Hugging Face model in the dock to render its real architecture here.
        </div>
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

            <span className="dock-section-label">Hugging Face model</span>
            <input
              className="text-input"
              placeholder="e.g. gpt2"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
            />
            <button className="btn btn-primary" onClick={() => load()} disabled={loading}>
              {loading ? "Loading…" : "Render"}
            </button>

            <div className="dock-chip-row">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  className="chip"
                  onClick={() => {
                    setInput(ex);
                    load(ex);
                  }}
                >
                  {ex}
                </button>
              ))}
            </div>

            {error && <p className="error-text">{error}</p>}

            {info && (
              <>
                <div className="dock-divider" />
                <span className="dock-section-label">
                  {info.name} · {info.modelType}
                </span>
                {info.paramCount && (
                  <span className="dock-stat">~{fmtParams(info.paramCount)} params (est.)</span>
                )}
                <button className="btn btn-primary" onClick={runForwardPass}>
                  Run forward pass
                </button>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={attentionView}
                    onChange={(e) => setAttentionView(e.target.checked)}
                  />
                  Attention view
                </label>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
