export type NodeKind = "input" | "hidden" | "attention" | "output";

export interface EngineNode {
  id: string;
  layer: number;
  kind: NodeKind;
  x: number;
  y: number;
  activation: number;
}

export interface SampleStrand {
  offset: number;
  bow: number;
  alpha: number;
}

export interface EngineEdge {
  id: string;
  from: string;
  to: string;
  weight: number;
  alive: boolean;
  particles: number[];
  represents: number; // how many real connections this visual edge stands in for
  isHubEdge?: boolean;
  isManual?: boolean; // created by the person via Connect Nodes, gets its own color
  curveOffset?: number; // perpendicular offset so parallel edges between the same two nodes fan out visibly
  sampleStrands?: SampleStrand[];
  isAttention?: boolean; // for attention-view highlighting
  unravelSpread?: number; // per-edge unravel animation state, NOT shared across edges
}

export interface LayerSpec {
  kind: NodeKind;
  count: number;
  label?: string;
}

export interface EngineGraph {
  nodes: EngineNode[];
  edges: EngineEdge[];
}

export interface HFModelInfo {
  name: string;
  modelType: string;
  layers: LayerSpec[];
  realCounts: number[];
  paramCount?: number;
  raw?: Record<string, unknown>;
}
