type HelpCenterProps = {
  onClose: () => void;
};

const quickSteps = [
  "先导入图片，确认当前投放比例，再决定是裁剪还是扩图。",
  "如果需要调整构图，点击“裁剪”进入裁剪模式，在画布上拖动裁剪框并点击“应用裁剪”。",
  "如果只是想做标记或批注，点击“涂鸦”直接在画布上手绘，画完会生成可编辑涂鸦图层。",
  "如果图片局部不满意，点击“圈选修复区域”圈出问题位置，必要时用“擦除圈选区域”缩小范围。",
  "圈选完成后，点击“执行局部修复”，等待 AI 返回新的修复结果。"
];

const toolGuides = [
  ["选择", "选中画布中的图层，然后在右侧继续调位置、透明度、文字样式等属性。"],
  ["平移", "拖动画布视口，适合放大后检查细节或移动查看局部。"],
  ["裁剪", "进入裁剪模式，在画布上调整裁剪框，并通过“应用裁剪”正式提交结果。"],
  ["涂鸦", "在画布上自由手绘，生成新的涂鸦图层，后续还能再选中、移动、缩放和改颜色。"],
  ["圈选修复区域", "圈出需要 AI 修复的区域，这一步只是定义修复范围，还不会直接改图。"],
  ["擦除圈选区域", "擦掉误选范围，缩小 AI 需要处理的局部区域。"],
  ["执行局部修复", "对当前圈选区域发起 AI 局部修复，修完后会替换当前图片图层内容。"],
  ["文字", "添加标题、价格、优惠券等文案模板，并在右侧继续细调。"],
  ["滤镜", "快速套用画面预设，并继续微调亮度、对比度、锐度等参数。"],
  ["装饰", "添加贴片、徽章、高亮条等辅助元素，补强卖点表达。"]
];

const faqs = [
  ["圈选后为什么图片还没变化？", "“圈选修复区域”只是在标记 AI 需要处理的区域。圈完之后，还要点击“执行局部修复”才会真正开始改图。"],
  ["AI 修复失败怎么办？", "原图不会被直接抹掉。你可以调整圈选范围或提示词后重试，也可以先裁剪避开问题区域。"],
  ["涂鸦和圈选修复区域有什么区别？", "涂鸦会生成正式图层，属于画面内容；圈选修复区域只是临时蒙版，不会在刷新后保留，也不会直接参与导出。"],
  ["帮助页会清空当前画布吗？", "不会。关闭帮助页后会回到原来的编辑状态。"]
];

export function HelpCenter({ onClose }: HelpCenterProps) {
  return (
    <div className="help-center">
      <div className="help-center__hero">
        <div>
          <p className="eyebrow">Help Center</p>
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
          <h2>5 步快速上手</h2>
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
            <li>中间：直接在网格背景上的画布工作区，可拖动、缩放、裁剪、涂鸦和圈选修复范围。</li>
            <li>右侧：比例设置、滤镜、AI 修复、导出和当前图层属性。</li>
          </ul>
        </div>
        <img alt="工作流概览" className="help-center__image" src="/help/workflow-overview.svg" />
      </section>

      <section className="help-center__section">
        <div className="help-center__copy">
          <h2>工具说明</h2>
          <ul className="help-center__list">
            {toolGuides.map(([title, description]) => (
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
          <h2>AI 局部修复怎么用</h2>
          <ol className="help-center__list">
            <li>先选中图片图层。</li>
            <li>点击“圈选修复区域”，在画布上圈出不满意的位置。</li>
            <li>如果范围画大了，点击“擦除圈选区域”把误选区域擦掉。</li>
            <li>在右侧填写修复提示词，然后点击“执行局部修复”。</li>
            <li>修复结果不满意时，可以重新圈选并再次执行。</li>
          </ol>
        </div>
        <img alt="AI 局部修复流程" className="help-center__image" src="/help/ai-repair.svg" />
      </section>

      <section className="help-center__section">
        <div className="help-center__copy">
          <h2>裁剪怎么用</h2>
          <ol className="help-center__list">
            <li>先选中图片图层，再点击“裁剪”。</li>
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
