type HelpCenterProps = {
  onClose: () => void;
};

const quickSteps = [
  "导入 AIGC 商品图或海报初稿。",
  "先在右侧切换投放比例，再决定裁剪还是扩图。",
  "需要突出卖点时，添加花字模板或装饰标签。",
  "图片不满意时，用涂抹选区后执行 AI 局部修复。",
  "确认成品后导出，或回填到图文流程。"
];

const toolGuides = [
  ["选择", "选中图层，移动位置，改透明度、文字样式和滤镜。"],
  ["平移", "拖动画布视口，适合放大后检查局部。"],
  ["裁剪", "调整构图，把素材适配到 1:1、4:5、9:16。"],
  ["涂抹", "在图片上框出需要 AI 修复的区域。"],
  ["橡皮擦", "擦掉多余蒙版，缩小 AI 修复范围。"],
  ["局部修复", "把当前蒙版区域发送给 AI 做局部重绘。"],
  ["花字", "添加主标题、价格角标、优惠券标签和卖点高亮条。"],
  ["滤镜", "套用电商滤镜预设，或做一键增强和细调。"],
  ["装饰", "补充角标、飘带、高亮条等营销元素。"]
];

const faqs = [
  ["AI 修复失败怎么办？", "原图不会被覆盖，可以调整蒙版后重试，或先用裁剪避开问题区域。"],
  ["什么时候用 AI 扩图？", "当你必须适配新比例，但主体不能被裁掉时，优先用 AI 扩图。"],
  ["帮助页会清空当前画布吗？", "不会，关闭帮助后会回到原来的编辑状态。"]
];

export function HelpCenter({ onClose }: HelpCenterProps) {
  return (
    <div className="help-center">
      <div className="help-center__hero">
        <div>
          <p className="eyebrow">Help Center</p>
          <h1>Web 修图工作台教程</h1>
          <p className="help-center__intro">
            这套教程面向商家、运营和投放同学，帮助你把 AI 初稿快速修成可投放素材。
          </p>
        </div>
        <button className="app-shell__help-button" onClick={onClose} type="button">
          返回编辑器
        </button>
      </div>

      <section className="help-center__section">
        <div className="help-center__copy">
          <h2>快速开始</h2>
          <p>第一次使用时，只需要按下面 5 步走一遍。</p>
          <ol className="help-center__list">
            {quickSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
        <img
          alt="页面布局总览"
          className="help-center__image"
          src="/help/layout-overview.svg"
        />
      </section>

      <section className="help-center__section">
        <div className="help-center__copy">
          <h2>页面布局说明</h2>
          <p>左侧管任务和图层，中间专注改图，右侧负责细调和导出。</p>
          <ul className="help-center__list">
            <li>左侧：任务入口、导入按钮、图层列表。</li>
            <li>中间：主画布、撤销重做、导出入口。</li>
            <li>右侧：比例、裁剪、滤镜、AI 修复、导出与回填。</li>
          </ul>
        </div>
        <img
          alt="完整出图流程示意"
          className="help-center__image"
          src="/help/workflow-overview.svg"
        />
      </section>

      <section className="help-center__section">
        <div className="help-center__copy">
          <h2>任务入口按钮说明</h2>
          <p>先理解按钮作用，再上手会更快。</p>
          <ul className="help-center__list">
            {toolGuides.map(([title, description]) => (
              <li key={title}>
                <strong>{title}</strong>：{description}
              </li>
            ))}
          </ul>
        </div>
        <img
          alt="任务入口按钮说明图"
          className="help-center__image"
          src="/help/tool-guide.svg"
        />
      </section>

      <section className="help-center__section">
        <div className="help-center__copy">
          <h2>AI 局部修复怎么用</h2>
          <p>适合修掉背景杂物、瑕疵边缘和不想重生成的小问题。</p>
          <ol className="help-center__list">
            <li>选中图片层，点击“涂抹”，把不满意的区域圈出来。</li>
            <li>如果范围画大了，用“橡皮擦”缩小蒙版。</li>
            <li>在右侧填写修复提示词，点击“执行 AI 局部修复”。</li>
            <li>如果结果不理想，直接撤销，改蒙版或提示词后重试。</li>
          </ol>
        </div>
        <img
          alt="AI 局部修复流程示意"
          className="help-center__image"
          src="/help/ai-repair.svg"
        />
      </section>

      <section className="help-center__section">
        <div className="help-center__copy">
          <h2>AI 扩图怎么用</h2>
          <p>适合主体不能裁掉，但又必须适配 4:5 或 9:16 投放位的场景。</p>
          <ol className="help-center__list">
            <li>先在右侧确认目标比例。</li>
            <li>填写扩图提示词，说明希望延展什么背景。</li>
            <li>点击“一键 AI 扩图”，等待返回新的成图。</li>
            <li>扩图后再检查花字和安全区位置，必要时微调构图。</li>
          </ol>
        </div>
        <img
          alt="AI 扩图前后示意"
          className="help-center__image"
          src="/help/ai-extend.svg"
        />
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
