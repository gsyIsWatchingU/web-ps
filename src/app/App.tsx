import { EditorWorkspace } from "../features/editor/components/EditorWorkspace";

export function App() {
  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <div>
          <p className="eyebrow">TikTok Shop Editing Loop</p>
          <h1>Web 修图工作台</h1>
          <p className="workspace__meta">
            面向 AIGC 带货图二次精修，当前版本优先补齐裁剪适配、花字模板、电商滤镜和平移视口。
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
