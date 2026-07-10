import type { EngineEdge, EngineGraph, EngineNode } from "../types";

const NODE_COLOR: Record<string, string> = {
  input: "#EAFFFB",
  hidden: "#2DD9C8",
  attention: "#A78BFF",
  output: "#FF6EC7",
};

const ATTENTION_HILITE = "#FF6EC7";

function controlPoints(x0: number, y0: number, x1: number, y1: number, offset = 0) {
  const dx = (x1 - x0) * 0.5;
  // perpendicular unit vector, so the offset pushes the curve sideways rather than
  // reshaping it — this is what lets several edges between the same two nodes fan
  // out into visibly separate strings instead of overlapping
  const len = Math.hypot(x1 - x0, y1 - y0) || 1;
  const px = (-(y1 - y0) / len) * offset;
  const py = ((x1 - x0) / len) * offset;
  return { cx1: x0 + dx + px, cy1: y0 + py, cx2: x1 - dx + px, cy2: y1 + py };
}

function bezierPoint(
  x0: number, y0: number, x1: number, y1: number,
  x2: number, y2: number, x3: number, y3: number, t: number
) {
  const mt = 1 - t;
  return {
    x: mt * mt * mt * x0 + 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t * t * t * x3,
    y: mt * mt * mt * y0 + 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t * y3,
  };
}

export function fmtCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return String(n);
}

export interface EngineCallbacks {
  onSelectNode: (n: EngineNode | null) => void;
  onSelectEdge: (e: EngineEdge | null) => void;
  onStatsChange: (aliveEdges: number) => void;
  onConnectPair?: (from: EngineNode, to: EngineNode) => void;
  onRequestAddNode?: (x: number, y: number) => void;
}

export class NeuralEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  private graph: EngineGraph;
  private callbacks: EngineCallbacks;

  private view = { scale: 1, tx: 0, ty: 0 };
  private panning = false;
  private didPan = false;
  private panStart = { x: 0, y: 0 };
  private viewStart = { scale: 1, tx: 0, ty: 0 };
  private dragging: EngineNode | null = null;
  private selectedNode: EngineNode | null = null;
  private selectedEdge: EngineEdge | null = null;
  private unravelingEdge: EngineEdge | null = null;
  private camFocus: { scale: number; tx: number; ty: number } | null = null;
  private attentionView = false;
  private connectMode = false;
  private connectPending: EngineNode | null = null;
  private addNodeMode = false;
  private time = 0;
  private rafId = 0;
  private destroyed = false;

  constructor(
    canvas: HTMLCanvasElement,
    graph: EngineGraph,
    width: number,
    height: number,
    callbacks: EngineCallbacks
  ) {
    this.canvas = canvas;
    this.width = width;
    this.height = height;
    this.graph = graph;
    this.callbacks = callbacks;

    // render at real device pixel density so strings stay crisp instead of
    // blurring when the CSS-pixel-sized buffer gets stretched across the screen
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.dpr = dpr;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = "100%";
    canvas.style.height = "100%";

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D context unavailable");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx = ctx;

    this.bindEvents();
    this.loop = this.loop.bind(this);
  }

  private dpr = 1;

  resize(width: number, height: number) {
    if (width === this.width && height === this.height) return; // no-op, avoid needless flicker
    this.width = width;
    this.height = height;
    this.canvas.width = Math.round(width * this.dpr);
    this.canvas.height = Math.round(height * this.dpr);
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  setGraph(graph: EngineGraph) {
    this.graph = graph;
    this.selectedNode = null;
    this.selectedEdge = null;
    this.unravelingEdge = null;
    this.view = { scale: 1, tx: 0, ty: 0 };
    this.callbacks.onSelectNode(null);
    this.callbacks.onSelectEdge(null);
  }

  setAttentionView(on: boolean) {
    this.attentionView = on;
  }

  setConnectMode(on: boolean) {
    this.connectMode = on;
    this.connectPending = null;
  }

  setAddNodeMode(on: boolean) {
    this.addNodeMode = on;
  }

  // called by the UI once the person picks a kind for the neuron they clicked to place
  commitAddNode(kind: EngineNode["kind"], x: number, y: number) {
    // guess a sensible "layer" by matching to the nearest existing layer's average x,
    // purely so breathing/jitter animation has something stable to key off of
    const layers = [...new Set(this.graph.nodes.map((n) => n.layer))];
    let bestLayer = layers[0] ?? 0;
    let bestDist = Infinity;
    layers.forEach((l) => {
      const avgX =
        this.graph.nodes.filter((n) => n.layer === l).reduce((a, n) => a + n.x, 0) /
        this.graph.nodes.filter((n) => n.layer === l).length;
      const d = Math.abs(avgX - x);
      if (d < bestDist) {
        bestDist = d;
        bestLayer = l;
      }
    });
    const newNode: EngineNode = {
      id: `manual-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      layer: bestLayer,
      kind,
      x,
      y,
      activation: 0,
    };
    this.graph.nodes.push(newNode);
    return newNode;
  }

  // removes a neuron and every synapse touching it, then clears selection
  deleteNode(nodeId: string) {
    this.graph.nodes = this.graph.nodes.filter((n) => n.id !== nodeId);
    this.graph.edges = this.graph.edges.filter((e) => e.from !== nodeId && e.to !== nodeId);
    if (this.selectedNode?.id === nodeId) {
      this.selectedNode = null;
      this.callbacks.onSelectNode(null);
    }
    this.selectedEdge = null;
    this.callbacks.onSelectEdge(null);
    this.callbacks.onStatsChange(this.graph.edges.filter((e) => e.alive).length);
  }

  // called by the UI once the person picks how many strings to draw between
  // the two nodes they selected while in connect mode
  commitConnection(fromId: string, toId: string, count: number) {
    const from = this.nodeById(fromId);
    const to = this.nodeById(toId);
    if (!from || !to || from.id === to.id) return;
    const n = Math.max(1, Math.min(40, Math.floor(count)));
    // draw each requested string as its own real edge, fanned out with a small
    // perpendicular offset so N strings look like N strings, not one bulky cable
    const spread = Math.min(36, 6 + n * 2.2);
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : i / (n - 1) - 0.5; // -0.5..0.5 spread across the count
      this.graph.edges.push({
        id: `${from.id}->${to.id}-${Date.now()}-${i}`,
        from: from.id,
        to: to.id,
        weight: Math.random() * 2 - 1,
        alive: true,
        particles: [],
        isManual: true,
        represents: 1,
        curveOffset: n === 1 ? 0 : t * spread,
      });
    }
    this.callbacks.onStatsChange(this.graph.edges.filter((e) => e.alive).length);
  }

  resetView() {
    this.camFocus = { scale: 1, tx: 0, ty: 0 };
  }

  nodeById(id: string) {
    return this.graph.nodes.find((n) => n.id === id);
  }

  runForwardPass() {
    const layers = [...new Set(this.graph.nodes.map((n) => n.layer))].sort((a, b) => a - b);
    const travelMs = 900; // roughly how long a particle actually takes to cross one layer gap
    this.graph.nodes.filter((n) => n.layer === layers[0]).forEach((n) => (n.activation = 1));
    let delay = 0;
    for (let idx = 0; idx < layers.length - 1; idx++) {
      const l = layers[idx];
      setTimeout(() => {
        if (this.destroyed) return;
        this.graph.edges
          .filter((e) => e.alive && this.nodeById(e.from)?.layer === l)
          .forEach((e) => e.particles.push(0));
      }, delay);
      delay += travelMs;
    }
  }

  pruneRandom(fraction: number) {
    const alive = this.graph.edges.filter((e) => e.alive);
    const numToKill = Math.floor(alive.length * fraction);
    const shuffled = [...alive].sort(() => Math.random() - 0.5);
    shuffled.slice(0, numToKill).forEach((e) => (e.alive = false));
    this.callbacks.onStatsChange(this.graph.edges.filter((e) => e.alive).length);
  }

  restoreAll() {
    this.graph.edges.forEach((e) => (e.alive = true));
    this.callbacks.onStatsChange(this.graph.edges.filter((e) => e.alive).length);
  }

  private screenToWorld(sx: number, sy: number) {
    return { x: (sx - this.view.tx) / this.view.scale, y: (sy - this.view.ty) / this.view.scale };
  }

  private getScreenPos(e: MouseEvent) {
    const rect = this.canvas.getBoundingClientRect();
    // use the logical width/height (matches node coordinates), not the DPR-scaled
    // physical buffer — mixing the two silently offsets every click/drag/connect
    const scaleX = this.width / rect.width;
    const scaleY = this.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  private hitTestNode(wx: number, wy: number): EngineNode | null {
    return this.graph.nodes.find((n) => Math.hypot(n.x - wx, n.y - wy) < 10) || null;
  }

  private hitTestEdge(wx: number, wy: number): EngineEdge | null {
    let best: EngineEdge | null = null;
    let bestDist = 9;
    this.graph.edges.forEach((e) => {
      if (!e.alive) return;
      const from = this.nodeById(e.from);
      const to = this.nodeById(e.to);
      if (!from || !to) return;
      const { cx1, cy1, cx2, cy2 } = controlPoints(from.x, from.y, to.x, to.y, e.curveOffset ?? 0);
      const thresh = e.represents > 1000 ? 12 : 6;
      for (let i = 0; i <= 10; i++) {
        const p = bezierPoint(from.x, from.y, cx1, cy1, cx2, cy2, to.x, to.y, i / 10);
        const d = Math.hypot(p.x - wx, p.y - wy);
        if (d < thresh && d < bestDist + (e.represents > 1000 ? 6 : 0)) {
          bestDist = d;
          best = e;
        }
      }
    });
    return best;
  }

  private computeFocusFor(mx: number, my: number, s: number) {
    return { scale: s, tx: this.width / 2 - mx * s, ty: this.height / 2 - my * s };
  }

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.camFocus = null;
    const { x, y } = this.getScreenPos(e as unknown as MouseEvent);
    const before = this.screenToWorld(x, y);
    const factor = e.deltaY < 0 ? 1.12 : 0.9;
    const next = this.view.scale * factor;
    this.view.scale = Math.min(4, Math.max(0.4, next));
    const after = { x: before.x * this.view.scale + this.view.tx, y: before.y * this.view.scale + this.view.ty };
    this.view.tx += x - after.x;
    this.view.ty += y - after.y;
  };

  private onMouseDown = (e: MouseEvent) => {
    const { x, y } = this.getScreenPos(e);
    const w = this.screenToWorld(x, y);
    const n = this.hitTestNode(w.x, w.y);
    this.didPan = false;
    if (n) {
      this.dragging = n;
      return;
    }
    this.camFocus = null;
    this.panning = true;
    this.panStart = { x, y };
    this.viewStart = { ...this.view };
    this.canvas.classList.add("dragging");
  };

  private onMouseMove = (e: MouseEvent) => {
    const { x, y } = this.getScreenPos(e);
    if (this.dragging) {
      const w = this.screenToWorld(x, y);
      this.dragging.x = w.x;
      this.dragging.y = w.y;
      return;
    }
    if (this.panning) {
      if (Math.hypot(x - this.panStart.x, y - this.panStart.y) > 3) {
        this.didPan = true;
      }
      this.view.tx = this.viewStart.tx + (x - this.panStart.x);
      this.view.ty = this.viewStart.ty + (y - this.panStart.y);
    }
  };

  private onMouseUp = () => {
    if (this.dragging) {
      const wasDrag = this.dragging;
      this.dragging = null;
      this.selectedNode = wasDrag;
      this.selectedEdge = null;
      this.callbacks.onSelectNode(wasDrag);
      this.callbacks.onSelectEdge(null);
      this.canvas.classList.remove("dragging");
      return;
    }
    if (this.panning) {
      this.panning = false;
      this.canvas.classList.remove("dragging");
    }
  };

  private onClick = (e: MouseEvent) => {
    if (this.didPan) {
      // this click is just the tail end of a pan gesture, not a real click —
      // consume it so it doesn't get read as "clicked empty space, recenter"
      this.didPan = false;
      return;
    }
    const { x, y } = this.getScreenPos(e);
    const w = this.screenToWorld(x, y);
    const n = this.hitTestNode(w.x, w.y);

    if (this.addNodeMode) {
      if (n) return; // don't place a node on top of an existing one
      this.callbacks.onRequestAddNode?.(w.x, w.y);
      return;
    }

    if (this.connectMode) {
      if (!n) return;
      if (!this.connectPending) {
        this.connectPending = n;
        this.selectedNode = n;
        this.callbacks.onSelectNode(n);
        return;
      }
      if (this.connectPending.id === n.id) {
        this.connectPending = null;
        this.callbacks.onSelectNode(null);
        return;
      }
      const from = this.connectPending;
      this.connectPending = null;
      this.callbacks.onSelectNode(null);
      this.callbacks.onConnectPair?.(from, n);
      return;
    }

    if (n) {
      this.selectedNode = n;
      this.selectedEdge = null;
      this.unravelingEdge = null;
      this.callbacks.onSelectNode(n);
      this.callbacks.onSelectEdge(null);
      return;
    }
    const edge = this.hitTestEdge(w.x, w.y);
    if (edge) {
      this.selectedEdge = edge;
      this.selectedNode = null;
      this.callbacks.onSelectEdge(edge);
      this.callbacks.onSelectNode(null);
      if (edge.isHubEdge) {
        this.unravelingEdge = edge;
        const from = this.nodeById(edge.from)!;
        const to = this.nodeById(edge.to)!;
        const { cx1, cy1, cx2, cy2 } = controlPoints(from.x, from.y, to.x, to.y);
        const mid = bezierPoint(from.x, from.y, cx1, cy1, cx2, cy2, to.x, to.y, 0.5);
        this.camFocus = this.computeFocusFor(mid.x, mid.y, 2.6);
      } else {
        this.unravelingEdge = null;
      }
      return;
    }
    this.selectedNode = null;
    this.selectedEdge = null;
    this.unravelingEdge = null;
    this.camFocus = this.computeFocusFor(this.width / 2, this.height / 2, 1);
    this.callbacks.onSelectNode(null);
    this.callbacks.onSelectEdge(null);
  };

  private bindEvents() {
    this.canvas.addEventListener("wheel", this.onWheel, { passive: false });
    this.canvas.addEventListener("mousedown", this.onMouseDown);
    this.canvas.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("mouseup", this.onMouseUp);
    this.canvas.addEventListener("click", this.onClick);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.rafId);
    this.canvas.removeEventListener("wheel", this.onWheel);
    this.canvas.removeEventListener("mousedown", this.onMouseDown);
    this.canvas.removeEventListener("mousemove", this.onMouseMove);
    window.removeEventListener("mouseup", this.onMouseUp);
    this.canvas.removeEventListener("click", this.onClick);
  }

  start() {
    this.loop();
  }

  // draw the live "cam" close-up of a node into a separate small canvas
  drawCam(camCanvas: HTMLCanvasElement, node: EngineNode) {
    const cctx = camCanvas.getContext("2d");
    if (!cctx) return;
    const CW = camCanvas.width;
    const CH = camCanvas.height;
    cctx.clearRect(0, 0, CW, CH);
    cctx.fillStyle = "#000000";
    cctx.fillRect(0, 0, CW, CH);
    const neighborEdges = this.graph.edges.filter((e) => e.from === node.id || e.to === node.id);
    const neighborIds = [...new Set(neighborEdges.map((e) => (e.from === node.id ? e.to : e.from)))];
    const neighbors = neighborIds.map((id) => this.nodeById(id)).filter(Boolean) as EngineNode[];
    const cx = CW / 2;
    const cy = CH / 2;
    const angleStep = (Math.PI * 2) / Math.max(neighbors.length, 1);
    const radius = Math.min(CW, CH) * 0.42;
    const pos = new Map<string, { x: number; y: number }>();
    pos.set(node.id, { x: cx, y: cy });
    neighbors.forEach((n, i) => {
      const a = i * angleStep - Math.PI / 2;
      pos.set(n.id, { x: cx + Math.cos(a) * radius, y: cy + Math.sin(a) * radius });
    });
    neighborEdges.forEach((e) => {
      const a = pos.get(e.from);
      const b = pos.get(e.to);
      if (!a || !b) return;
      // curve toward the center so strings fan and converge, like the main canvas does
      const bend = 0.35;
      const mx = a.x + (b.x - a.x) * 0.5 + (cx - (a.x + b.x) / 2) * bend;
      const my = a.y + (b.y - a.y) * 0.5 + (cy - (a.y + b.y) / 2) * bend;
      cctx.strokeStyle = e.alive ? "rgba(45,217,200,0.55)" : "rgba(255,80,80,0.3)";
      cctx.lineWidth = e.alive ? (e.represents > 1000 ? 3 : 1.6) : 1;
      cctx.beginPath();
      cctx.moveTo(a.x, a.y);
      cctx.quadraticCurveTo(mx, my, b.x, b.y);
      cctx.stroke();
      if (e.alive) {
        e.particles.forEach((p) => {
          const mt = 1 - p;
          const px = mt * mt * a.x + 2 * mt * p * mx + p * p * b.x;
          const py = mt * mt * a.y + 2 * mt * p * my + p * p * b.y;
          cctx.save();
          cctx.shadowColor = "#2dd9c8";
          cctx.shadowBlur = 8;
          cctx.fillStyle = "#eafffb";
          cctx.beginPath();
          cctx.arc(px, py, 2, 0, Math.PI * 2);
          cctx.fill();
          cctx.restore();
        });
      }
    });
    neighbors.forEach((n) => {
      const p = pos.get(n.id)!;
      cctx.save();
      cctx.shadowColor = NODE_COLOR[n.kind];
      cctx.shadowBlur = 6 + n.activation * 10;
      cctx.fillStyle = NODE_COLOR[n.kind];
      cctx.globalAlpha = 0.9;
      cctx.beginPath();
      cctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      cctx.fill();
      cctx.restore();
    });
    cctx.save();
    cctx.shadowColor = NODE_COLOR[node.kind];
    cctx.shadowBlur = 14 + node.activation * 14;
    cctx.fillStyle = NODE_COLOR[node.kind];
    cctx.beginPath();
    cctx.arc(cx, cy, 8, 0, Math.PI * 2);
    cctx.fill();
    cctx.restore();
    cctx.strokeStyle = "rgba(214,254,248,0.5)";
    cctx.lineWidth = 1;
    cctx.beginPath();
    cctx.arc(cx, cy, 11, 0, Math.PI * 2);
    cctx.stroke();
  }

  private loop() {
    if (this.destroyed) return;
    this.time++;
    const ctx = this.ctx;
    const W = this.width;
    const H = this.height;
    // shadowBlur is by far the most expensive canvas 2D operation we use per-shape;
    // skip it on ordinary strings once the graph is large enough that it'd add up
    // (hub cables, selection, and particles keep their glow regardless of scale)
    const heavyGraph = this.graph.edges.length > 180;

    // (unravel animation is now eased per-edge below, not globally)

    if (this.camFocus) {
      this.view.scale += (this.camFocus.scale - this.view.scale) * 0.09;
      this.view.tx += (this.camFocus.tx - this.view.tx) * 0.09;
      this.view.ty += (this.camFocus.ty - this.view.ty) * 0.09;
      const close =
        Math.abs(this.camFocus.scale - this.view.scale) < 0.01 &&
        Math.abs(this.camFocus.tx - this.view.tx) < 0.5 &&
        Math.abs(this.camFocus.ty - this.view.ty) < 0.5;
      if (close) this.camFocus = null;
    }

    ctx.save();
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, W, H);
    ctx.translate(this.view.tx, this.view.ty);
    ctx.scale(this.view.scale, this.view.scale);

    ctx.strokeStyle = "rgba(45,217,200,0.075)";
    ctx.lineWidth = 1 / this.view.scale;
    for (let x = 0; x < W; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y < H; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    this.graph.nodes.forEach((n) => {
      if (this.dragging === n) return;
      n.y += Math.sin(this.time * 0.01 + (n.id.length * 7 + n.layer * 3)) * 0.05;
    });

    this.graph.edges.forEach((e) => {
      const from = this.nodeById(e.from);
      const to = this.nodeById(e.to);
      if (!from || !to) return;
      const { cx1, cy1, cx2, cy2 } = controlPoints(from.x, from.y, to.x, to.y, e.curveOffset ?? 0);
      const isHub = !!e.isHubEdge;
      const isSelected = this.selectedEdge === e;
      const isAttentionHilite = this.attentionView && e.isAttention;

      if (!e.alive) {
        ctx.strokeStyle = "rgba(255,80,80,0.15)";
        ctx.lineWidth = (isHub ? 4 : 1) / this.view.scale;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.bezierCurveTo(cx1, cy1, cx2, cy2, to.x, to.y);
        ctx.stroke();
        ctx.setLineDash([]);
        return;
      }

      const baseColor = isAttentionHilite ? ATTENTION_HILITE : e.isManual ? "167,139,255" : "232,193,90";
      const strokeOf = (a: number) =>
        isAttentionHilite ? `rgba(255,110,199,${a})` : `rgba(${baseColor},${a})`;

      if (isHub) {
        const target = e === this.unravelingEdge ? 1 : 0;
        e.unravelSpread = (e.unravelSpread ?? 0) + (target - (e.unravelSpread ?? 0)) * 0.09;
        const spread = e.unravelSpread;
        const pulse = 0.55 + Math.sin(this.time * 0.05) * 0.12;
        ctx.strokeStyle = strokeOf((isSelected ? 0.95 : pulse) * (1 - spread));
        ctx.lineWidth = (isSelected ? 10 : 8) / this.view.scale;
        ctx.shadowColor = isAttentionHilite ? ATTENTION_HILITE : e.isManual ? "#a78bff" : "#e8c15a";
        ctx.shadowBlur = (14 / this.view.scale) * (1 - spread);
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.bezierCurveTo(cx1, cy1, cx2, cy2, to.x, to.y);
        ctx.stroke();
        ctx.shadowBlur = 0;

        if (spread > 0.02 && e.sampleStrands) {
          e.sampleStrands.forEach((s) => {
            const sx1 = cx1 + s.offset * spread;
            const sy1 = cy1 + s.bow * spread;
            const sx2 = cx2 - s.offset * spread;
            const sy2 = cy2 - s.bow * spread;
            ctx.strokeStyle = strokeOf(s.alpha * spread);
            ctx.lineWidth = 1 / this.view.scale;
            ctx.beginPath();
            ctx.moveTo(from.x, from.y);
            ctx.bezierCurveTo(sx1, sy1, sx2, sy2, to.x, to.y);
            ctx.stroke();
          });
          if (spread > 0.5) {
            const mid = bezierPoint(from.x, from.y, cx1, cy1, cx2, cy2, to.x, to.y, 0.5);
            ctx.save();
            ctx.globalAlpha = Math.min(1, (spread - 0.5) * 2.4);
            ctx.font = `${11 / this.view.scale}px monospace`;
            ctx.fillStyle = "rgba(214,254,248,0.85)";
            ctx.textAlign = "center";
            ctx.fillText(
              `sample of ${fmtCount(e.represents)} connections`,
              mid.x,
              mid.y - 14 / this.view.scale
            );
            ctx.restore();
          }
        }
      } else {
        const strength = Math.abs(e.weight) * 0.4 + 0.15;
        const a = isSelected ? 0.95 : isAttentionHilite ? 0.85 : strength;
        ctx.save();
        if (isAttentionHilite) {
          ctx.shadowColor = "#ff6ec7";
          ctx.strokeStyle = `rgba(255,200,235,${a})`;
        } else if (e.isManual) {
          ctx.shadowColor = "#a78bff";
          ctx.strokeStyle = `rgba(216,200,255,${a})`;
        } else {
          ctx.shadowColor = "#e8c15a";
          ctx.strokeStyle = `rgba(240,222,180,${a})`;
        }
        ctx.shadowBlur = heavyGraph && !isSelected ? 0 : (isSelected ? 6 : 3) / this.view.scale;
        ctx.lineWidth = (isSelected ? 1.4 : 0.6) / this.view.scale;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.bezierCurveTo(cx1, cy1, cx2, cy2, to.x, to.y);
        ctx.stroke();
        ctx.restore();
      }

      e.particles = e.particles.filter((p) => p < 1);
      e.particles.forEach((p, i) => {
        const pos = bezierPoint(from.x, from.y, cx1, cy1, cx2, cy2, to.x, to.y, p);
        ctx.save();
        ctx.shadowColor = isAttentionHilite ? ATTENTION_HILITE : "#2DD9C8";
        ctx.shadowBlur = 10 / this.view.scale;
        ctx.fillStyle = "#eafffb";
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, (isHub ? 3.2 : 2.2) / this.view.scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        e.particles[i] = p + 0.018;
      });
      if (e.particles.some((p) => p > 0.9)) {
        to.activation = Math.min(1, to.activation + 0.05);
      }
    });

    this.graph.nodes.forEach((n) => {
      n.activation *= 0.985;
      const glow = 6 + n.activation * 20;
      const r = (this.selectedNode === n ? 8 : 6) + n.activation * 3;
      ctx.save();
      ctx.shadowColor = NODE_COLOR[n.kind];
      ctx.shadowBlur = glow;
      ctx.fillStyle = NODE_COLOR[n.kind];
      ctx.globalAlpha = 0.85 + n.activation * 0.15;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = this.selectedNode === n ? "rgba(255,243,214,0.9)" : "rgba(214,254,248,0.3)";
      ctx.lineWidth = (this.selectedNode === n ? 1.6 : 1) / this.view.scale;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r + 3, 0, Math.PI * 2);
      ctx.stroke();
    });

    ctx.restore();
    this.callbacks.onStatsChange(this.graph.edges.filter((e) => e.alive).length);

    this.rafId = requestAnimationFrame(this.loop);
  }
}
