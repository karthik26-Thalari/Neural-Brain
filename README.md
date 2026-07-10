# 🧠 Neural Brain

**Watch a neural network think.**

An interactive visualizer for neural networks — build one by hand, break one to see how it degrades, or import a real model straight from Hugging Face and watch it render as a living, glowing web of neurons and synapses.

🔗 **Live demo:** [neural-brain.pages.dev](https://neural-brain.pages.dev/)
📦 **Repo:** [github.com/karthik26-Thalari/Neural-Brain](https://github.com/karthik26-Thalari/Neural-Brain)

![status](https://img.shields.io/badge/status-live-2dd9c8) ![license](https://img.shields.io/badge/license-MIT-a78bff) ![stack](https://img.shields.io/badge/stack-React%20%2B%20TypeScript%20%2B%20Three.js-e8c15a)

---

## ✨ Features

- 🌐 **3D landing page** — a pulsing, glowing brain built in Three.js, with live signal particles racing along its connections
- 🎨 **Design mode** — pick a preset architecture (MLP, deep net, autoencoder, transformer block, and more) and it auto-wires instantly, or start from a **blank canvas** and build everything yourself
- ➕ **Add & delete neurons** by hand, anywhere on the canvas
- 🔗 **Connect neurons manually** — click two neurons, choose how many strings to draw between them, and watch them fan out as real, individually clickable synapses
- ▶️ **Live forward pass** — glowing particles physically travel from neuron to neuron, and each layer only lights up once its signal actually arrives
- 💥 **Damage simulation** — randomly sever 25% of the network and watch it visibly degrade
- 📸 **Live neuron "cam"** — click any neuron for a real-time close-up view of it and its direct synapses
- 🤗 **Hugging Face import** — paste a real model name (`gpt2`, `bert-base-uncased`, etc.) and its actual architecture (layer count, hidden size, attention heads) renders in the same visual language
- 🖱️ **Floating, draggable, collapsible dock** — move it anywhere, or collapse it to a small glowing pill when you just want to look at the diagram
- 🔍 Zoom, pan, and a bundle-unravel-on-click interaction for inspecting dense connections

## 🛠️ Tech stack

- **React + TypeScript + Vite**
- **Canvas 2D** for the core rendering/physics/interaction engine
- **Three.js** for the 3D landing hero
- **Hugging Face Hub API** for real model architectures (no backend, no API key)
- Deployed on **Cloudflare Pages**

## 🚀 Running it locally

```bash
git clone https://github.com/karthik26-Thalari/Neural-Brain.git
cd Neural-Brain
npm install
npm run dev
```

Opens at `http://localhost:5173`.

## 📦 Build & deploy

```bash
npm run build
npx wrangler pages deploy dist --project-name=neural-brain
```

## 📁 Project structure

```
src/
  types.ts                shared type definitions
  engine/
    graph.ts               graph builder + preset architectures
    NeuralEngine.ts         canvas rendering/physics/interaction engine
    huggingface.ts          HF config fetch + parsing
  components/
    BrainCanvas.tsx         React wrapper: engine + floating panels + dock UI
  pages/
    Landing.tsx              3D hero landing page
    Design.tsx                design mode (presets, add/connect/delete, damage sim)
    Import.tsx                 Hugging Face import mode
  hooks/
    useDraggable.ts            makes the dock draggable
  App.tsx                     mode switcher
  app.css                     glassmorphism theme
```

## 📄 License

MIT — see [LICENSE](./LICENSE).

---

Built as a personal project to make neural networks something you can actually *watch* work, not just read about.
