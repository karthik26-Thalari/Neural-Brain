# 🧠 Neural Brain

**Watch a neural network think.**

An interactive visualizer for neural networks — build one by hand, break one to see how it degrades, or import a real model straight from Hugging Face and watch it render as a living, glowing web of neurons and synapses.

![live demo](https://img.shields.io/badge/live%20demo-neural--brain.pages.dev-2dd9c8) ![repo](https://img.shields.io/badge/repo-Neural--Brain-a78bff)

![status](https://img.shields.io/badge/status-live-2dd9c8) ![license](https://img.shields.io/badge/license-MIT-a78bff) ![stack](https://img.shields.io/badge/stack-React%20%2B%20TypeScript%20%2B%20Three.js-e8c15a) ![made with](https://img.shields.io/badge/made%20with-%E2%98%95%20and%20curiosity-ff6ec7)

---

## 🤔 What even is a neural network?

At its core, a neural network is just a big pile of simple math wired together in layers:

- **Neurons** are little units that hold a number (called an *activation*). Nothing more mysterious than that — just a value.
- **Synapses** (the connections between neurons) each carry a *weight* — a number that says how strongly one neuron's output should influence the next neuron.
- Data enters at the **input layer**, gets multiplied and combined as it flows through one or more **hidden layers**, and comes out the other end at the **output layer** as a prediction — a classification, a next word, a generated pixel, whatever the network was trained to do.
- **"Training"** a network just means adjusting all those weights, over and over, until the network's outputs get closer to what they should be.
- Modern AI models (like GPT, BERT, or the vision models on Hugging Face) are this exact same idea — just scaled up to billions of neurons and connections instead of a handful.

The tricky part is that none of this is visual by nature — it's just matrices of numbers. Neural Brain exists to make it visual: to let you actually *see* signals move, watch a network react when part of it breaks, and look at the real shape of models you've only ever read the name of.

## ✨ What you can do here

**🌐 Landing page** — a pulsing, glowing 3D brain built in Three.js, with live signal particles racing along its connections. Purely for the "whoa" factor before you dive in.

**🎨 Design mode** — build a network with your own hands:
- Pick a preset architecture (simple classifier, deep network, autoencoder, transformer block, and more) and it wires itself instantly
- Or start from a **blank canvas** and place every neuron yourself
- **Add** and **delete** neurons anywhere, anytime
- **Connect neurons manually** — click two neurons, choose exactly how many synapses to draw between them, and watch them fan out as real, individually clickable strings
- Hit **Run forward pass** and watch particles physically travel neuron to neuron — each layer only lights up once its signal has actually arrived, just like a real forward pass
- Hit **Simulate 25% damage** to randomly sever synapses and watch the network visibly degrade — a hands-on way to see why neural nets are (or aren't) resilient
- Click any neuron for a **live close-up "cam"** view of it and its direct connections, updating in real time

**🤗 Import mode** — paste the name of a real Hugging Face model (`gpt2`, `bert-base-uncased`, `google/vit-base-patch16-224`, etc.) and its *actual* architecture — real layer count, real hidden size, real attention heads — renders using the exact same visual language as Design mode. No fake data, no backend, no API key.

**🖱️ Everything floats** — the control dock is draggable, collapsible down to a small glowing pill, and auto-sizes itself. Scroll to zoom, drag to pan, click a dense bundle of connections to unravel it and see what's really there.

## 🛠️ Tech stack

- **React + TypeScript + Vite**
- **Canvas 2D** for the core rendering/physics/interaction engine
- **Three.js** for the 3D landing hero
- **Hugging Face Hub API** for real model architectures
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
