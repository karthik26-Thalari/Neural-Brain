import { useEffect, useRef } from "react";
import * as THREE from "three";

interface Props {
  onLaunch: () => void;
  onImport: () => void;
}

export default function Landing({ onLaunch, onImport }: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.set(0, 0, 4.9);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // the canvas always visually fills its wrapper via CSS; only the internal
    // render resolution (and camera aspect) needs to track the container size
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    mount.appendChild(renderer.domElement);

    // brain-shaped node cluster: two lobes, slightly separated, organic jitter
    const NODE_COUNT = 320;
    const nodePositions: THREE.Vector3[] = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      const lobeSign = i % 2 === 0 ? 1 : -1;
      const phi = Math.acos(-1 + (2 * i) / NODE_COUNT);
      const theta = Math.sqrt(NODE_COUNT * Math.PI) * phi;
      const r = 3.6 + Math.sin(i * 12.9898) * 0.55;
      const v = new THREE.Vector3(
        r * Math.cos(theta) * Math.sin(phi) * 1.05 + lobeSign * 0.65,
        r * Math.sin(theta) * Math.sin(phi) * 1.3,
        r * Math.cos(phi) * 0.95
      );
      nodePositions.push(v);
    }

    const nodeGeo = new THREE.SphereGeometry(0.05, 8, 8);
    const nodeMat = new THREE.MeshBasicMaterial({ color: 0x2dd9c8 });
    const nodeGroup = new THREE.Group();
    const meshes: THREE.Mesh[] = [];
    nodePositions.forEach((pos) => {
      const m = new THREE.Mesh(nodeGeo, nodeMat);
      m.position.copy(pos);
      nodeGroup.add(m);
      meshes.push(m);
    });
    scene.add(nodeGroup);

    const lineGeo = new THREE.BufferGeometry();
    const linePositions: number[] = [];
    nodePositions.forEach((pos, i) => {
      const distances = nodePositions
        .map((p, j) => ({ j, d: p.distanceTo(pos) }))
        .filter((d) => d.j !== i)
        .sort((a, b) => a.d - b.d)
        .slice(0, 3);
      distances.forEach(({ j }) => {
        linePositions.push(pos.x, pos.y, pos.z, nodePositions[j].x, nodePositions[j].y, nodePositions[j].z);
      });
    });
    lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(linePositions, 3));
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x2dd9c8,
      transparent: true,
      opacity: 0.22,
    });
    const lines = new THREE.LineSegments(lineGeo, lineMat);
    scene.add(lines);

    // traveling signal particles — little pulses of light racing along the connections,
    // so the brain reads as "firing" rather than just a static pulsing mesh
    const edgeCount = linePositions.length / 6;
    const SIGNAL_COUNT = 90;
    const signals = Array.from({ length: SIGNAL_COUNT }, () => ({
      edge: Math.floor(Math.random() * edgeCount),
      t: Math.random(),
      speed: 0.006 + Math.random() * 0.01,
    }));
    const signalGeo = new THREE.BufferGeometry();
    const signalPositions = new Float32Array(SIGNAL_COUNT * 3);
    signalGeo.setAttribute("position", new THREE.BufferAttribute(signalPositions, 3));
    const signalMat = new THREE.PointsMaterial({
      color: 0xeafffb,
      size: 0.05,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true,
    });
    const signalPoints = new THREE.Points(signalGeo, signalMat);
    lines.add(signalPoints);

    function updateSignals() {
      const posAttr = lineGeo.getAttribute("position") as THREE.BufferAttribute;
      signals.forEach((s, i) => {
        s.t += s.speed;
        if (s.t >= 1) {
          s.t = 0;
          s.edge = Math.floor(Math.random() * edgeCount);
        }
        const base = s.edge * 6;
        const ax = posAttr.array[base];
        const ay = posAttr.array[base + 1];
        const az = posAttr.array[base + 2];
        const bx = posAttr.array[base + 3];
        const by = posAttr.array[base + 4];
        const bz = posAttr.array[base + 5];
        signalPositions[i * 3] = ax + (bx - ax) * s.t;
        signalPositions[i * 3 + 1] = ay + (by - ay) * s.t;
        signalPositions[i * 3 + 2] = az + (bz - az) * s.t;
      });
      signalGeo.attributes.position.needsUpdate = true;
    }

    scene.add(new THREE.AmbientLight(0xffffff, 0.3));

    let raf = 0;
    let t = 0;
    function animate() {
      t += 0.006;
      nodeGroup.rotation.y = t * 0.35;
      lines.rotation.y = t * 0.35;
      nodeGroup.rotation.x = Math.sin(t * 0.25) * 0.12;
      lines.rotation.x = Math.sin(t * 0.25) * 0.12;

      const pulse = 0.75 + Math.sin(t * 2.2) * 0.25;
      nodeMat.color.setRGB(0.18 * pulse, 0.85 * pulse, 0.78 * pulse);
      lineMat.opacity = 0.16 + Math.sin(t * 2.2) * 0.08;

      meshes.forEach((m, i) => {
        const s = 1 + Math.sin(t * 2.6 + i * 0.7) * 0.35;
        m.scale.setScalar(s);
      });

      updateSignals();

      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    }
    animate();

    function onResize() {
      if (!mount) return;
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false); // false: don't touch CSS size, we control that ourselves
    }
    const ro = new ResizeObserver(onResize);
    ro.observe(mount);
    onResize();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mount.removeChild(renderer.domElement);
      nodeGeo.dispose();
      nodeMat.dispose();
      lineGeo.dispose();
      lineMat.dispose();
      signalGeo.dispose();
      signalMat.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div className="landing">
      <div className="landing-scene" ref={mountRef} />
      <div className="landing-overlay">
        <div className="landing-glass glass">
          <div className="brand landing-brand">
            <span className="brand-dot" />
            NEURAL BRAIN
          </div>
          <h1>Watch a neural network think.</h1>
          <p>
            Build one, break one, or import a real model from Hugging Face — then watch signals
            flow through it live, synapse by synapse.
          </p>
          <div className="landing-actions">
            <button className="btn btn-primary btn-lg" onClick={onLaunch}>
              Launch Design Mode
            </button>
            <button className="btn btn-ghost btn-lg" onClick={onImport}>
              Import a real model
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
