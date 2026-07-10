# Neural Brain

An interactive visualizer for neural networks — build one, break one, or import a real
model from Hugging Face and watch it render as a living, glowing web.

## Features

- **Landing page** — 3D pulsing brain hero (Three.js), glassmorphism UI
- **Design mode** — pick a preset architecture (MLP, deep net, autoencoder, transformer
  block) and it auto-wires instantly. Drag neurons to reshape the web by hand. Run a live
  forward pass and watch particles flow synapse to synapse.
- **Damage simulation** — sever a "billion-parameter" bundled connection, or randomly
  prune 25% of the network, and watch it visibly degrade
- **Live neuron cam** — click any neuron for a real-time close-up of it and its direct
  synapses
- **Import mode** — paste a Hugging Face model name or link (e.g. `gpt2`,
  `bert-base-uncased`) and its real architecture (layer count, hidden size, attention
  heads) renders in the same visual language. Includes an attention-view toggle and a
  side-by-side compare mode for two models.

## Local development

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`.

## Build

```bash
npm run build
```

Outputs a static site to `dist/`.

## Deploy to Cloudflare Pages

**Option A — dashboard:**
1. Push this project to a GitHub repo
2. In Cloudflare Pages, "Create a project" -> connect the repo
3. Build command: `npm run build`
4. Build output directory: `dist`
5. Deploy

**Option B — Wrangler CLI:**
```bash
npm install -g wrangler
npm run build
wrangler pages deploy dist
```

## Notes on the Hugging Face import

- Only public models on huggingface.co work (it fetches their public `config.json`
  directly from the browser — no backend/API key needed).
- Large layers are rendered as a capped, representative sample of nodes (not every real
  neuron) so huge models stay readable — the UI notes when this is happening.
- Parameter counts shown are a rough estimate for context, not an exact figure from the
  model card.

## Project structure

```
src/
  types.ts                shared type definitions
  engine/
    graph.ts               graph builder + preset architectures
    NeuralEngine.ts         the canvas rendering/physics/interaction engine
    huggingface.ts          HF config fetch + parsing into a renderable graph
  components/
    BrainCanvas.tsx         React wrapper around the engine + info panel + live cam
  pages/
    Landing.tsx             3D hero landing page
    Design.tsx              preset-based design mode
    Import.tsx              Hugging Face import + compare mode
  App.tsx                   mode switcher / nav
  app.css                   glassmorphism theme
```

## Ideas for what's next

- Real edge-bundling math for Import mode when a layer's true connection count is huge
  (right now the "hub" demo bundle is illustrative; a real model could compute and label
  aggregate bundles per layer-pair automatically)
- Training-over-time animation (weights drifting)
- Save/share a designed network via a URL
