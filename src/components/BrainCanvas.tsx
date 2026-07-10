import { useEffect, useRef, useState } from "react";
import { NeuralEngine, fmtCount } from "../engine/NeuralEngine";
import type { EngineEdge, EngineGraph, EngineNode, NodeKind } from "../types";

interface Props {
  graph: EngineGraph;
  width?: number;
  height?: number;
  attentionView?: boolean;
  connectMode?: boolean;
  addNodeMode?: boolean;
  fullBleed?: boolean;
  onStatsChange?: (aliveEdges: number) => void;
}

const KIND_OPTIONS: NodeKind[] = ["input", "hidden", "attention", "output"];

export default function BrainCanvas({
  graph,
  width = 820,
  height = 560,
  attentionView = false,
  connectMode = false,
  addNodeMode = false,
  fullBleed = false,
  onStatsChange,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const camRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<NeuralEngine | null>(null);
  const [selectedNode, setSelectedNode] = useState<EngineNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<EngineEdge | null>(null);
  const [pendingPair, setPendingPair] = useState<{ from: EngineNode; to: EngineNode } | null>(null);
  const [strandCount, setStrandCount] = useState(1);
  const [pendingSpot, setPendingSpot] = useState<{ x: number; y: number } | null>(null);
  const [newKind, setNewKind] = useState<NodeKind>("hidden");

  useEffect(() => {
    if (!canvasRef.current) return;
    const engine = new NeuralEngine(canvasRef.current, graph, width, height, {
      onSelectNode: setSelectedNode,
      onSelectEdge: setSelectedEdge,
      onStatsChange: (n) => {
        onStatsChange?.(n);
      },
      onConnectPair: (from, to) => {
        setPendingPair({ from, to });
        setStrandCount(1);
      },
      onRequestAddNode: (x, y) => {
        setPendingSpot({ x, y });
      },
    });
    engineRef.current = engine;
    engine.start();
    return () => engine.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph]);

  // resize without tearing down the engine, so an in-progress click/connect/drag
  // never gets silently dropped by a layout-driven remount
  useEffect(() => {
    engineRef.current?.resize(width, height);
  }, [width, height]);

  useEffect(() => {
    engineRef.current?.setAttentionView(attentionView);
  }, [attentionView]);

  useEffect(() => {
    engineRef.current?.setConnectMode(connectMode);
    setPendingPair(null);
  }, [connectMode]);

  useEffect(() => {
    engineRef.current?.setAddNodeMode(addNodeMode);
    setPendingSpot(null);
  }, [addNodeMode]);

  // live-redraw the cam view every frame while a node is selected
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      if (selectedNode && camRef.current && engineRef.current) {
        engineRef.current.drawCam(camRef.current, selectedNode);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [selectedNode]);

  return (
    <div className={fullBleed ? "brain-stage fullpage-canvas glass" : "brain-stage glass"}>
      <canvas ref={canvasRef} width={width} height={height} />

      {addNodeMode && !pendingSpot && (
        <div className="stage-hint stage-hint-top">click anywhere on empty canvas to place a neuron</div>
      )}

      {pendingSpot && (
        <div className="floating-panel glass connect-modal">
          <div className="floating-panel-header">
            <h3>New neuron</h3>
          </div>
          <label className="connect-label">Kind</label>
          <div className="kind-picker">
            {KIND_OPTIONS.map((k) => (
              <button
                key={k}
                className={`chip kind-chip tag-${k} ${newKind === k ? "kind-chip-active" : ""}`}
                onClick={() => setNewKind(k)}
              >
                {k}
              </button>
            ))}
          </div>
          <div className="connect-actions">
            <button
              className="btn btn-primary"
              onClick={() => {
                engineRef.current?.commitAddNode(newKind, pendingSpot.x, pendingSpot.y);
                setPendingSpot(null);
              }}
            >
              Place neuron
            </button>
            <button className="btn btn-ghost" onClick={() => setPendingSpot(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {connectMode && !pendingPair && (
        <div className="stage-hint stage-hint-top">
          {selectedNode ? "now click a second neuron to connect it to" : "click a neuron to start a connection"}
        </div>
      )}

      {pendingPair && (
        <div className="floating-panel glass connect-modal">
          <div className="floating-panel-header">
            <h3>Connect neurons</h3>
          </div>
          <p className="connect-copy">
            {pendingPair.from.id} → {pendingPair.to.id}
          </p>
          <label className="connect-label">How many strings?</label>
          <input
            className="text-input connect-input"
            type="number"
            min={1}
            max={40}
            value={strandCount}
            onChange={(e) => setStrandCount(Number(e.target.value))}
          />
          <div className="connect-actions">
            <button
              className="btn btn-primary"
              onClick={() => {
                engineRef.current?.commitConnection(pendingPair.from.id, pendingPair.to.id, strandCount);
                setPendingPair(null);
              }}
            >
              Connect
            </button>
            <button className="btn btn-ghost" onClick={() => setPendingPair(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {!connectMode && !addNodeMode && !selectedNode && !selectedEdge && (
        <div className="stage-hint">
          click a neuron to inspect it &middot; click a synapse to select it &middot; scroll to zoom &middot; drag to pan
        </div>
      )}

      {!connectMode && !addNodeMode && selectedNode && (
        <div className="floating-panel glass">
          <div className="floating-panel-header">
            <h3>Neuron {selectedNode.id}</h3>
            <span className={`tag tag-${selectedNode.kind}`}>{selectedNode.kind}</span>
          </div>
          <div className="floating-panel-body">
            <div className="cam-wrap">
              <canvas ref={camRef} width={168} height={120} />
              <div className="cam-label">
                <span className="live-dot" /> live
              </div>
            </div>
            <div className="floating-stats">
              <div className="row">
                <span>Layer</span>
                <span>{selectedNode.layer}</span>
              </div>
              <div className="row">
                <span>Activation</span>
                <span>{selectedNode.activation.toFixed(3)}</span>
              </div>
            </div>
          </div>
          <button
            className="btn btn-danger"
            onClick={() => {
              engineRef.current?.deleteNode(selectedNode.id);
            }}
          >
            Delete neuron
          </button>
        </div>
      )}

      {selectedEdge && (
        <div className="floating-panel glass">
          <div className="floating-panel-header">
            <h3>{selectedEdge.isHubEdge ? "Bundle" : "Synapse"}</h3>
            <span className="tag tag-hidden">{selectedEdge.alive ? "alive" : "severed"}</span>
          </div>
          <div className="floating-stats">
            <div className="row">
              <span>From → To</span>
              <span>
                {selectedEdge.from} → {selectedEdge.to}
              </span>
            </div>
            {selectedEdge.isHubEdge && (
              <div className="row">
                <span>Represents</span>
                <span>{fmtCount(selectedEdge.represents)} connections</span>
              </div>
            )}
            <div className="row">
              <span>Weight</span>
              <span>{selectedEdge.weight.toFixed(3)}</span>
            </div>
          </div>
          <button
            className="btn btn-danger"
            disabled={!selectedEdge.alive}
            onClick={() => {
              selectedEdge.alive = false;
            }}
          >
            Sever this {selectedEdge.isHubEdge ? "bundle" : "synapse"}
          </button>
        </div>
      )}

    </div>
  );
}
