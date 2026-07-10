import type { HFModelInfo, LayerSpec } from "../types";

// cap how many neurons we ever draw per layer, regardless of the model's real
// hidden size — huge layers get sampled down and we label the real count instead
const MAX_NODES_PER_LAYER = 22;

function extractModelId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/huggingface\.co\/([^/?#]+\/[^/?#]+)/);
  if (match) return match[1];
  return trimmed.replace(/^\/+|\/+$/g, "");
}

export async function fetchHFConfig(input: string): Promise<HFModelInfo> {
  const modelId = extractModelId(input);
  const url = `https://huggingface.co/${modelId}/resolve/main/config.json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `Could not fetch config for "${modelId}" (${res.status}). Check the model name/link is public on Hugging Face.`
    );
  }
  const config = (await res.json()) as Record<string, unknown>;
  return configToInfo(modelId, config);
}

export function fmtParams(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(0) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return String(n);
}

function num(config: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const k of keys) {
    const v = config[k];
    if (typeof v === "number") return v;
  }
  return undefined;
}

function configToInfo(modelId: string, config: Record<string, unknown>): HFModelInfo {
  const modelType = (config.model_type as string) || "unknown";

  const numLayers =
    num(config, "num_hidden_layers", "n_layer", "num_layers", "encoder_layers") ?? 4;
  const hiddenSize = num(config, "hidden_size", "n_embd", "d_model", "dim") ?? 256;
  const numHeads = num(config, "num_attention_heads", "n_head", "encoder_attention_heads");
  const vocabSize = num(config, "vocab_size");
  const isEncoderDecoder = !!config.is_encoder_decoder;

  const clamp = (n: number) => Math.max(3, Math.min(MAX_NODES_PER_LAYER, Math.round(n)));

  const layers: LayerSpec[] = [];
  const realCounts: number[] = [];
  const embedSize = Math.round(Math.sqrt(vocabSize ?? hiddenSize));
  layers.push({ kind: "input", count: clamp(embedSize), label: "embedding" });
  realCounts.push(vocabSize ?? hiddenSize);

  const blockCount = Math.max(1, Math.min(numLayers, 10)); // cap visible blocks, note real count in UI
  for (let i = 0; i < blockCount; i++) {
    if (numHeads) {
      layers.push({ kind: "attention", count: clamp(numHeads), label: "self-attention" });
      realCounts.push(numHeads * hiddenSize);
    }
    layers.push({ kind: "hidden", count: clamp(hiddenSize / 8), label: "feed-forward" });
    realCounts.push(hiddenSize);
  }

  if (isEncoderDecoder) {
    layers.push({ kind: "attention", count: clamp(numHeads ?? 8), label: "cross-attention" });
    realCounts.push((numHeads ?? 8) * hiddenSize);
  }

  layers.push({ kind: "output", count: clamp(embedSize), label: "output" });
  realCounts.push(vocabSize ?? hiddenSize);

  // rough param estimate just for display context, not scientifically exact
  const paramCount = hiddenSize * hiddenSize * 4 * numLayers + (vocabSize ?? 0) * hiddenSize;

  return { name: modelId, modelType, layers, realCounts, paramCount, raw: config };
}
