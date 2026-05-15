import { EditorWorkspace } from "../features/editor/components/EditorWorkspace";

export function App() {
  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <div>
          <p className="eyebrow">SDD Scaffold</p>
          <h1>Web 修图工作台</h1>
          <p className="workspace__meta">
            面向 AIGC 带货图二次精修，当前已完成脚手架与 T1-T4 基础能力。
          </p>
        </div>
        <div className="app-shell__summary">
          <span>React + Vite</span>
          <span>Fabric.js Runtime</span>
          <span>Zustand Store</span>
        </div>
      </header>
      <EditorWorkspace />
    </div>
  );
}
