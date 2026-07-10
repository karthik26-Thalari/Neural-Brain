# 🧠 Neural Brain

**Watch a neural network think.**

Build one by hand. Break one and see how it copes. Or paste in the name of a real model from Hugging Face and watch its actual architecture render as a living, glowing web of neurons and synapses.

[![Live Demo](https://img.shields.io/badge/live%20demo-neural--brain.pages.dev-2dd9c8)](https://neural-brain.pages.dev)
[![Status](https://img.shields.io/badge/status-live-2dd9c8)]()
[![License](https://img.shields.io/badge/license-MIT-a78bff)](./LICENSE)
[![Stack](https://img.shields.io/badge/stack-React%20%2B%20TypeScript%20%2B%20Three.js-e8c15a)]()

---

### Contents

- [What even is a neural network?](#what-even-is-a-neural-network)
- [What you can do here](#what-you-can-do-here)
- [Tech stack](#tech-stack)
- [Running it locally](#running-it-locally)
- [Build & deploy](#build--deploy)
- [Project structure](#project-structure)
- [License](#license)

---

## What even is a neural network?

Strip away the hype, and an artificial neural network is a fairly small idea, repeated a lot of times.

- **Neurons** are simple units that hold a number, called an *activation*. That's the whole job description.
- **Synapses**, the connections between neurons, each carry a *weight*: a number describing how strongly one neuron should push on the next.
- Data enters at an **input layer**, gets combined and reshaped as it passes through one or more **hidden layers**, and comes out the other side at an **output layer** as a prediction: a class label, a next word, a pixel, whatever the network was built to produce.
- **Training** just means nudging every weight, over and over, until the network's outputs get closer to the right answer. This is usually done with an algorithm called backpropagation, paired with gradient descent.
- Large modern models, like GPT, BERT, and the vision transformers on Hugging Face, run on this exact same idea. They're just scaled up to billions of neurons and connections instead of a few dozen.

> None of this *looks* like anything by default. It's matrices of numbers being multiplied together. Neural Brain exists to close that gap: to let you actually watch a signal travel through a network, see what happens when part of it breaks, and look at the real shape of architectures you've only ever read the name of.

## What you can do here

**🌐 Landing page**
A pulsing 3D brain rendered in Three.js, with signal particles racing along its connections in real time. Pure spectacle, before the tools start.

**🎨 Design mode** — build a network by hand
- Start from a preset (simple classifier, deep network, autoencoder, transformer block, and more) and it wires itself instantly
- Or start from a blank canvas and place every neuron yourself
- Add and delete neurons anywhere, at any time
- Connect neurons manually: click two, choose how many synapses should run between them, and watch them fan out as real, individually clickable strings
- Run a forward pass and watch particles physically travel neuron to neuron, with each layer lighting up only once its signal has actually arrived
- Simulate 25% damage to randomly sever synapses and watch the network degrade, a hands-on way to see how much resilience a network actually has
- Click any neuron for a live close-up view of it and its direct connections, updating as the network runs

**🤗 Import mode** — bring in the real thing
Paste the name of a real Hugging Face model, such as `gpt2`, `bert-base-uncased`, or `google/vit-base-patch16-224`, and its actual architecture (real layer count, real hidden size, real attention heads) renders using the same visual language as Design mode. No fake data, no backend, no API key required.

**🖱️ A dock that stays out of your way**
Draggable, collapsible down to a small glowing pill, auto-sizing itself to whatever's open. Scroll to zoom, drag to pan, click into a dense bundle of connections to unravel it and see what's actually there.

<details>
<summary><strong>🎥 Quick feature checklist</strong></summary>

- [x] Preset architectures (classifier, deep net, autoencoder, transformer block)
- [x] Manual neuron placement and deletion
- [x] Manual multi-synapse connections
- [x] Animated forward pass with real signal propagation
- [x] Damage simulation (25% synapse severing)
- [x] Live per-neuron close-up view
- [x] Real Hugging Face model import
- [x] Draggable, collapsible floating dock

</details>

## Tech stack

| Layer | Choice |
|---|---|
| UI | React + TypeScript + Vite |
| Rendering / physics engine | Canvas 2D |
| Landing hero | Three.js |
| Model architectures | Hugging Face Hub API |
| Hosting | Cloudflare Pages |

## Running it locally

```bash
git clone https://github.com/karthik26-Thalari/Neural-Brain.git
cd Neural-Brain
npm install
npm run dev
```

Opens at `http://localhost:5173`.

## Build & deploy

```bash
npm run build
npx wrangler pages deploy dist --project-name=neural-brain
```

## Project structure

```
src/
  types.ts                  shared type definitions
  engine/
    graph.ts                graph builder + preset architectures
    NeuralEngine.ts          canvas rendering/physics/interaction engine
    huggingface.ts           HF config fetch + parsing
  components/
    BrainCanvas.tsx          React wrapper: engine + floating panels + dock UI
  pages/
    Landing.tsx              3D hero landing page
    Design.tsx               design mode (presets, add/connect/delete, damage sim)
    Import.tsx               Hugging Face import mode
  hooks/
    useDraggable.ts          makes the dock draggable
  App.tsx                    mode switcher
  app.css                    glassmorphism theme
```

## License

MIT, see [LICENSE](./LICENSE).

---

*Built as a personal project, for the simple reason that neural networks deserve to be watched, not just read about.*
