import { useState } from "react";
import Landing from "./pages/Landing";
import Design from "./pages/Design";
import Import from "./pages/Import";
import "./app.css";

type Mode = "landing" | "design" | "import";

export default function App() {
  const [mode, setMode] = useState<Mode>("landing");

  return (
    <div className="app-root">
      {mode === "landing" && (
        <Landing onLaunch={() => setMode("design")} onImport={() => setMode("import")} />
      )}
      {mode === "design" && <Design mode={mode} onNavigate={setMode} />}
      {mode === "import" && <Import mode={mode} onNavigate={setMode} />}
    </div>
  );
}
