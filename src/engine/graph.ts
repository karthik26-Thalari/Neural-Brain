import type { EngineGraph, LayerSpec, EngineEdge } from "../types";

export const PRESETS: Record<string, { label: string; specs: LayerSpec[] }> = {
  blank: {
    label: "Blank canvas (start from scratch)",
    specs: [],
  },
  simpleMLP: {
    label: "Simple Classifier (MLP)",
    specs: [
      { kind: "input", count: 8, label: "input" },
      { kind: "hidden", count: 6, label: "hidden" },
      { kind: "output", count: 3, label: "output" },
    ],
  },
  deepMLP: {
    label: "Deep Network",
    specs: [
      { kind: "input", count: 10, label: "input" },
      { kind: "hidden", count: 8, label: "hidden" },
      { kind: "hidden", count: 8, label: "hidden" },
      { kind: "hidden", count: 6, label: "hidden" },
      { kind: "output", count: 4, label: "output" },
    ],
  },
  autoencoder: {
    label: "Autoencoder (bottleneck)",
    specs: [
      { kind: "input", count: 12, label: "input" },
      { kind: "hidden", count: 8, label: "encode" },
      { kind: "attention", count: 3, label: "bottleneck" },
      { kind: "hidden", count: 8, label: "decode" },
      { kind: "output", count: 12, label: "output" },
    ],
  },
  transformerBlock: {
    label: "Transformer Block",
    specs: [
      { kind: "input", count: 8, label: "tokens" },
      { kind: "attention", count: 8, label: "self-attention" },
      { kind: "hidden", count: 12, label: "feed-forward" },
      { kind: "output", count: 8, label: "output" },
    ],
  },
  wideShallow: {
    label: "Wide & Shallow",
    specs: [
      { kind: "input", count: 6, label: "input" },
      { kind: "hidden", count: 20, label: "wide hidden" },
      { kind: "output", count: 4, label: "output" },
    ],
  },
  convStack: {
    label: "Convolutional Stack",
    specs: [
      { kind: "input", count: 14, label: "pixels" },
      { kind: "hidden", count: 10, label: "conv" },
      { kind: "hidden", count: 7, label: "conv" },
      { kind: "hidden", count: 5, label: "pooled" },
      { kind: "output", count: 3, label: "class" },
    ],
  },
  multiHeadStack: {
    label: "Multi-Head Attention Stack",
    specs: [
      { kind: "input", count: 8, label: "tokens" },
      { kind: "attention", count: 6, label: "head 1-2" },
      { kind: "attention", count: 6, label: "head 3-4" },
      { kind: "hidden", count: 10, label: "feed-forward" },
      { kind: "output", count: 8, label: "output" },
    ],
  },
};

// for models with genuinely huge layers, don't draw every individual connection —
// draw one bundle cable per layer-pair instead, sized/labeled by the real count,
// and let clicking it unravel into a representative sample (see NeuralEngine)
export function buildBundledGraph(
  specs: LayerSpec[],
  realCounts: number[],
  width: number,
  height: number
): EngineGraph {
  const { nodes } = buildGraph(specs, width, height, false);
  const edges: EngineEdge[] = [];

  for (let l = 0; l < specs.length - 1; l++) {
    const fromNodes = nodes.filter((n) => n.layer === l);
    const toNodes = nodes.filter((n) => n.layer === l + 1);
    // pick a pseudo-random (but stable) index per layer-pair instead of always the
    // dead-center node — otherwise every bundle lines up at the same height and
    // chains into what looks like one long fake continuous cable across the page
    const fromIdx = Math.floor(((l + 1) * 2654435761) % fromNodes.length);
    const toIdx = Math.floor(((l + 2) * 2654435761) % toNodes.length);
    const from = fromNodes[Math.abs(fromIdx) % fromNodes.length];
    const to = toNodes[Math.abs(toIdx) % toNodes.length];
    if (!from || !to) continue;
    const represents = Math.max(1, Math.round((realCounts[l] ?? 1) * (realCounts[l + 1] ?? 1) * 0.001));
    edges.push({
      id: `bundle-${l}`,
      from: from.id,
      to: to.id,
      weight: Math.random() * 2 - 1,
      alive: true,
      particles: [],
      represents,
      isHubEdge: true,
      sampleStrands: Array.from({ length: 20 }, () => ({
        offset: (Math.random() - 0.5) * 50,
        bow: (Math.random() - 0.5) * 32,
        alpha: 0.3 + Math.random() * 0.35,
      })),
    });
  }

  return { nodes, edges };
}

export function buildGraph(
  specs: LayerSpec[],
  width: number,
  height: number,
  addHub = false
): EngineGraph {
  const nodes: EngineGraph["nodes"] = [];
  const edges: EngineEdge[] = [];

  const layerGap = width / (specs.length + 1);

  specs.forEach((spec, li) => {
    const x = layerGap * (li + 1);
    const vGap = height / (spec.count + 1);
    for (let i = 0; i < spec.count; i++) {
      const jitter = (Math.random() - 0.5) * 14;
      nodes.push({
        id: `L${li}N${i}`,
        layer: li,
        kind: spec.kind,
        x: x + jitter,
        y: vGap * (i + 1) + jitter,
        activation: 0,
      });
    }
  });

  for (let l = 0; l < specs.length - 1; l++) {
    const from = nodes.filter((n) => n.layer === l);
    const to = nodes.filter((n) => n.layer === l + 1);
    from.forEach((f) => {
      const numLinks = Math.min(to.length, 3 + Math.floor(Math.random() * 3));
      const copy = [...to];
      const targets = [];
      while (targets.length < numLinks && copy.length) {
        targets.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
      }
      targets.forEach((t) => {
        edges.push({
          id: `${f.id}->${t.id}`,
          from: f.id,
          to: t.id,
          weight: Math.random() * 2 - 1,
          alive: true,
          particles: [],
          represents: 1,
          isAttention: f.kind === "attention" || t.kind === "attention",
        });
      });
    });
  }

  if (addHub && edges.length > 4) {
    const hub = edges[Math.floor(edges.length * 0.42)];
    hub.represents = 84_000_000;
    hub.isHubEdge = true;
    hub.sampleStrands = Array.from({ length: 18 }, () => ({
      offset: (Math.random() - 0.5) * 46,
      bow: (Math.random() - 0.5) * 30,
      alpha: 0.25 + Math.random() * 0.35,
    }));
  }

  return { nodes, edges };
}
