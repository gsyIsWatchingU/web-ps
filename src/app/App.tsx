import { useState } from "react";
import { EditorWorkspace } from "../features/editor/components/EditorWorkspace";
import { HelpCenter } from "../features/editor/components/HelpCenter";

export function App() {
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <div>
          <p className="eyebrow">TikTok Shop Editing Loop</p>
          <h1>Web 修图工作台</h1>
          <p className="workspace__meta">
            面向 AIGC 带货图的二次精修工作台，支持裁剪、花字、滤镜、AI 局部修复、
            AI 扩图和导出回填。
          </p>
        </div>
        <div className="app-shell__header-actions">
          <div className="app-shell__summary">
            <span>React + Vite</span>
            <span>Fabric.js Runtime</span>
            <span>Zustand Store</span>
          </div>
          <button
            className="app-shell__help-button"
            onClick={() => setIsHelpOpen((value) => !value)}
            type="button"
          >
            {isHelpOpen ? "返回编辑器" : "帮助"}
          </button>
        </div>
      </header>

      {isHelpOpen ? <HelpCenter onClose={() => setIsHelpOpen(false)} /> : <EditorWorkspace />}
    </div>
  );
}
