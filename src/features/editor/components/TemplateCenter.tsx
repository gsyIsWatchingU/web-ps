import { useMemo, useState } from "react";
import {
  platformPresets,
  templateDefinitions,
  businessComponentPresets,
  type PlatformPresetId,
  type TemplateDefinitionId,
  getPlatformPreset
} from "../model/ecommerce";

type TemplateCenterProps = {
  hasDraft: boolean;
  activeTemplateName: string | null;
  onUseTemplate: (templateId: TemplateDefinitionId, platformPresetId: PlatformPresetId) => void;
  onContinueDraft: () => void;
  onStartFreeEdit: (platformPresetId: PlatformPresetId) => void;
};

export function TemplateCenter({
  hasDraft,
  activeTemplateName,
  onUseTemplate,
  onContinueDraft,
  onStartFreeEdit
}: TemplateCenterProps) {
  const [selectedPlatformId, setSelectedPlatformId] = useState<PlatformPresetId>("douyin-product");
  const [failedPreviews, setFailedPreviews] = useState<Record<string, boolean>>({});

  const selectedPlatform = getPlatformPreset(selectedPlatformId);
  const visibleTemplates = useMemo(
    () =>
      templateDefinitions.filter(
        (template) =>
          template.platformPresetId === selectedPlatformId ||
          getPlatformPreset(template.platformPresetId).canvasPresetId === selectedPlatform.canvasPresetId
      ),
    [selectedPlatform.canvasPresetId, selectedPlatformId]
  );

  return (
    <section className="template-center">
      <div className="template-center__hero">
        <div>
          <p className="eyebrow">模板工作流</p>
          <h2>先选平台，再从高频模板开始出图</h2>
          <p className="workspace__meta">
            把 AI 初稿快速加工成可投放素材。先确定平台规格，再挑选商品主图、带货封面、促销海报、直播预热或内容封面模板。
          </p>
        </div>
        <div className="template-center__actions">
          {hasDraft ? (
            <button className="app-shell__help-button" onClick={onContinueDraft} type="button">
              继续当前草稿{activeTemplateName ? ` · ${activeTemplateName}` : ""}
            </button>
          ) : null}
          <button className="app-shell__primary-button" onClick={() => onStartFreeEdit(selectedPlatformId)} type="button">
            从空白画布开始
          </button>
        </div>
      </div>

      <div className="template-center__layout">
        <section className="workspace__section">
          <h3>1. 选择平台 / 场景</h3>
          <div className="workspace__preset-grid">
            {platformPresets.map((preset) => (
              <button
                key={preset.id}
                className={`workspace__preset-button ${selectedPlatformId === preset.id ? "is-active" : ""}`}
                onClick={() => setSelectedPlatformId(preset.id)}
                type="button"
              >
                <strong>{preset.label}</strong>
                <span className="workspace__meta">
                  {preset.sceneTag} · {preset.recommendedFormat.toUpperCase()}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="workspace__section">
          <h3>2. 选择模板</h3>
          <div className="template-center__grid">
            {visibleTemplates.map((template) => {
              const hasPreview = Boolean(template.previewImage) && !failedPreviews[template.id];

              return (
                <article className="template-center__card" key={template.id}>
                  <div className="template-center__preview-shell">
                    {hasPreview ? (
                      <img
                        alt={`${template.label} preview`}
                        className="template-center__preview-image"
                        onError={() =>
                          setFailedPreviews((current) => ({
                            ...current,
                            [template.id]: true
                          }))
                        }
                        src={template.previewImage}
                      />
                    ) : (
                      <div className="template-center__preview-fallback">
                        <strong>{template.label}</strong>
                        <span>预览不可用</span>
                      </div>
                    )}
                    <div className="template-center__preview-overlay">
                      <span className="workspace__chip workspace__chip--accent">{selectedPlatform.label}</span>
                      <span className="workspace__chip workspace__chip--muted">{template.sceneGroupLabel}</span>
                    </div>
                  </div>

                  <div className="template-center__card-top">
                    <div className="template-center__card-heading">
                      <strong>{template.label}</strong>
                      <p className="workspace__meta">{template.sceneType}</p>
                    </div>
                    <span className="template-center__layout-label">{template.layoutVariantLabel}</span>
                  </div>

                  <p className="template-center__description">{template.description}</p>
                  <p className="workspace__footer-note">{template.usageTip}</p>

                  <div className="template-center__tags">
                    {template.componentIds.map((componentId) => {
                      const component = businessComponentPresets.find((item) => item.id === componentId);

                      return (
                        <span className="workspace__chip" key={componentId}>
                          {component?.label ?? componentId}
                        </span>
                      );
                    })}
                  </div>

                  <button
                    className="workspace__export-button template-center__cta"
                    onClick={() => onUseTemplate(template.id, selectedPlatformId)}
                    type="button"
                  >
                    用这个模板开始
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </section>
  );
}
