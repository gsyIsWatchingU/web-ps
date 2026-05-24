type HelpCenterProps = {
  onClose: () => void;
};

const quickSteps = [
  "先导入图片，确认当前投放比例，再决定是裁剪还是扩图。",
  "如果需要调整构图，点击“裁剪”进入裁剪模式，在画布上拖动裁剪框并点击“应用裁剪”。",
  "如果只是想做标记或批注，点击“涂鸦”直接在画布上手绘，画完会生成可编辑涂鸦图层。",
  "如果想基于图片生成 3D 模型，点击“立体创作”，填写图片 URL（可选）和提示词后点击生成。",
  "等待任务完成后，点击下载按钮获取生成的 3D 模型文件。"
];

const toolGuides = [
  ["选择", "选中画布中的图层，然后在右侧继续调位置、透明度、文字样式等属性。"],
  ["平移", "拖动画布视口，适合放大后检查细节或移动查看局部。"],
  ["裁剪", "进入裁剪模式，在画布上调整裁剪框，并通过“应用裁剪”正式提交结果。"],
  ["涂鸦", "在画布上自由手绘，生成新的涂鸦图层，后续还能再选中、移动、缩放和改颜色。"],
  ["文字", "添加标题、价格、优惠券等文案模板，并在右侧继续细调。"],
  ["滤镜", "快速套用画面预设，并继续微调亮度、对比度、锐度等参数。"],
  ["立体创作", "基于图片生成 3D 模型，支持当前图层图片或自定义 URL 图片，生成后提供下载入口。"],
  ["装饰", "添加贴片、徽章、高亮条等辅助元素，补强卖点表达。"]
];

const faqs = [
  ["立体创作为什么显示不支持？", "立体创作需要可访问的 http/https URL 图片。如果当前图层是本地上传或 base64 图片，可以在右侧面板输入自定义图片 URL。"],
  ["立体创作失败怎么办？", "原图不会被影响。你可以调整提示词后重试，或检查网络和 API 配置。"],
  ["立体创作生成的文件在哪里下载？", "任务成功后，会在右侧面板显示下载按钮和文件名，点击即可下载。"],
  ["帮助页会清空当前画布吗？", "不会。关闭帮助页后会回到原来的编辑状态。"]
];

export function HelpCenter({ onClose }: HelpCenterProps) {
  return (
    <div className="help-center">
      <div className="help-center__hero">
        <div>
          <p className="eyebrow">帮助中心</p>
          <h1>Web 修图工作台教程</h1>
          <p className="help-center__intro">
            这套教程面向运营、设计和投放同学，帮助你把 AI 初稿快速修成可投放素材。
          </p>
        </div>
        <button className="app-shell__help-button" onClick={onClose} type="button">
          返回编辑器
        </button>
      </div>

      <section className="help-center__section">
        <div className="help-center__copy">
          <h2>快速上手</h2>
          <ol className="help-center__list">
            {quickSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
        <img alt="工作区结构说明" className="help-center__image" src="/help/layout-overview.svg" />
      </section>

      <section className="help-center__section">
        <div className="help-center__copy">
          <h2>工作区结构</h2>
          <ul className="help-center__list">
            <li>左侧：工具入口、导入按钮和图层列表。</li>
            <li>中间：直接在网格背景上的画布工作区，可拖动、缩放、裁剪和涂鸦。</li>
            <li>右侧：比例设置、滤镜、立体创作、导出和当前图层属性。</li>
          </ul>
        </div>
        <img alt="工作流概览" className="help-center__image" src="/help/workflow-overview.svg" />
      </section>

      <section className="help-center__section">
        <div className="help-center__copy">
          <h2>工具说明</h2>
          <ul className="help-center__list">
            {toolGuides.filter(([title]) => title !== "平移").map(([title, description]) => (
              <li key={title}>
                <strong>{title}</strong>：{description}
              </li>
            ))}
          </ul>
        </div>
        <img alt="工具按钮说明图" className="help-center__image" src="/help/tool-guide.svg" />
      </section>

      <section className="help-center__section">
        <div className="help-center__copy">
          <h2>立体创作怎么用</h2>
          <ol className="help-center__list">
            <li>先选中图片（或直接在右侧输入自定义图片 URL）。</li>
            <li>点击左侧“立体创作”工具。</li>
            <li>在右侧填写生成提示词，描述图片内容。</li>
            <li>点击“生成 3D 模型”按钮，等待任务完成。</li>
            <li>任务成功后，点击下载按钮获取 3D 模型文件。</li>
          </ol>
        </div>
        <img alt="立体创作流程" className="help-center__image" src="/help/ai3d.svg" />
      </section>

      <section className="help-center__section">
        <div className="help-center__copy">
          <h2>裁剪怎么用</h2>
          <ol className="help-center__list">
            <li>先选中图片，再点击“裁剪”。</li>
            <li>在画布上拖动裁剪框，或拖四角手柄改变裁剪范围。</li>
            <li>右侧的比例按钮和滑杆可以用来精调位置和尺寸。</li>
            <li>确认后点击“应用裁剪”；如果想放弃本次调整，点击“取消裁剪”。</li>
          </ol>
        </div>
        <img alt="裁剪模式示意" className="help-center__image" src="/help/layout-overview.svg" />
      </section>

      <section className="help-center__section">
        <div className="help-center__copy">
          <h2>常见问题</h2>
          <ul className="help-center__list">
            {faqs.map(([title, answer]) => (
              <li key={title}>
                <strong>{title}</strong>：{answer}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
