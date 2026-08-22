import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Eye,
  EyeOff,
  Link2,
  Link2Off,
  Lock,
  Minus,
  Plus,
  RotateCcw,
  Unlock,
} from 'lucide-react';
import {
  AutoLayout,
  DEFAULT_LAYOUT,
  DEFAULT_CONSTRAINTS,
  TextNode,
  findNodeInDocument,
  getActivePage,
  NODE_ROLES,
  NODE_UI_STATES,
  suggestComponentKey,
  findInteractionForNode,
  lintNodeIssuesForNode,
  type Document,
  type NodeRole,
  type NodeUiState,
  type HorizontalConstraint,
  type VerticalConstraint,
  type Constraints,
  type TextShadow,
  type SceneNode,
  normalizeTextShadow,
} from '@game-ui/document';
import { getTransformDraft, useEditorStore } from '../store/editorStore';
import { ColorPickerPopover, normalizeHex } from './ColorPicker';
import { toast } from '../ui/feedback';
import { ScrubLabel } from '../ui/NumberField';
import { DarkSelect } from './DarkSelect';

function sameValue<T>(values: T[]): T | null {
  if (!values.length) return null;
  const first = values[0]!;
  for (let i = 1; i < values.length; i++) {
    if (values[i] !== first) return null;
  }
  return first;
}

export function PropertiesPanel() {
  const document = useEditorStore((s) => s.document);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const isTransforming = useEditorStore((s) => s.isTransforming);
  const setTransform = useEditorStore((s) => s.setTransform);
  const setSelectionTransform = useEditorStore((s) => s.setSelectionTransform);
  const flushTransform = useEditorStore((s) => s.flushTransform);
  const renameNode = useEditorStore((s) => s.renameNode);
  const updateText = useEditorStore((s) => s.updateText);
  const updateSelectionText = useEditorStore((s) => s.updateSelectionText);
  const updateNodeStyle = useEditorStore((s) => s.updateNodeStyle);
  const updateSelectionStyle = useEditorStore((s) => s.updateSelectionStyle);
  const updateNodeSemantics = useEditorStore((s) => s.updateNodeSemantics);
  const setConstraints = useEditorStore((s) => s.setConstraints);
  const upsertInteraction = useEditorStore((s) => s.upsertInteraction);
  const setLocked = useEditorStore((s) => s.setLocked);
  const setVisible = useEditorStore((s) => s.setVisible);
  const resetSpriteGeometry = useEditorStore((s) => s.resetSpriteGeometry);
  const updateSpriteStateAssets = useEditorStore((s) => s.updateSpriteStateAssets);
  const setNodeActiveState = useEditorStore((s) => s.setNodeActiveState);

  const [aspectLock, setAspectLock] = useState(false);
  const [fillPicker, setFillPicker] = useState(false);
  const [strokePicker, setStrokePicker] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const renameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const transformDoc =
    isTransforming && getTransformDraft() ? getTransformDraft()! : document;

  const page = getActivePage(document);
  const nodes = selectedIds
    .map((id) => findNodeInDocument(document, id)?.node)
    .filter((n): n is SceneNode => !!n);
  const transformNodes = selectedIds
    .map((id) => findNodeInDocument(transformDoc, id)?.node)
    .filter((n): n is SceneNode => !!n);
  const multi = nodes.length > 1;
  const node = nodes[0];
  const isRoot = !!(node && page && node.id === page.root.id);
  const allLocked = nodes.length > 0 && nodes.every((n) => n.locked);
  const allSameType = nodes.length > 0 && nodes.every((n) => n.type === nodes[0]!.type);
  const allText = allSameType && nodes[0]?.type === 'text';
  const primaryNodeId = node?.id ?? '';
  const primaryNodeName = node?.name ?? '';

  useEffect(() => {
    setNameDraft(primaryNodeName);
  }, [primaryNodeId, primaryNodeName]);

  useEffect(
    () => () => {
      if (renameTimerRef.current) clearTimeout(renameTimerRef.current);
    },
    []
  );

  const [, setTransformTick] = useState(0);
  useEffect(() => {
    if (!isTransforming) return;
    let raf = 0;
    const tick = () => {
      setTransformTick((n) => n + 1);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isTransforming]);

  if (!node || nodes.length === 0) {
    return (
      <aside className="flex h-full min-w-0 w-full flex-col border-l border-slate-800 bg-slate-900">
        <div className="border-b border-slate-800 px-3 py-2.5 text-[12px] font-medium text-slate-400">
          属性
        </div>
        <div className="space-y-3 p-4 text-xs leading-relaxed text-slate-500">
          <p>选中图层以编辑属性。</p>
          <ol className="list-decimal space-y-1.5 pl-4 text-[11px]">
            <li>从底栏拖切图到画布，或创建 Frame / 文本 / 矩形</li>
            <li>需要导出给程序/AI 时，再填「语义 / AI 交接」里的角色与 Key</li>
            <li>点工具栏「AI 交接」下载 zip 给另一个 AI</li>
          </ol>
        </div>
      </aside>
    );
  }

  const applyTransform = (
    patch: Partial<{
      x: number;
      y: number;
      width: number;
      height: number;
      rotation: number;
      opacity: number;
    }>,
    commit = false
  ) => {
    if (multi) setSelectionTransform(patch, commit);
    else setTransform(node.id, patch, commit);
  };

  const applyStyle: typeof updateNodeStyle = (_id, patch) => {
    if (multi) updateSelectionStyle(patch);
    else updateNodeStyle(node.id, patch);
  };

  const applyText = (
    patch: Parameters<typeof updateText>[1]
  ) => {
    if (multi) updateSelectionText(patch);
    else updateText(node.id, patch);
  };

  const w = sameValue(transformNodes.map((n) => n.transform.width));
  const h = sameValue(transformNodes.map((n) => n.transform.height));
  const x = sameValue(transformNodes.map((n) => n.transform.x));
  const y = sameValue(transformNodes.map((n) => n.transform.y));
  const rotation = sameValue(transformNodes.map((n) => n.transform.rotation));
  const opacity = sameValue(transformNodes.map((n) => n.transform.opacity ?? 1));
  const corner = sameValue(nodes.map((n) => n.cornerRadius ?? 0));
  const scaleX = sameValue(nodes.map((n) => n.scaleX ?? 1));
  const scaleY = sameValue(nodes.map((n) => n.scaleY ?? 1));
  const visible = sameValue(nodes.map((n) => n.visible));
  const locked = sameValue(nodes.map((n) => n.locked));
  const clipContent = sameValue(nodes.map((n) => !!n.clipContent));
  const layoutMode = sameValue(nodes.map((n) => (n.layout ?? DEFAULT_LAYOUT).mode));
  const layoutGap = sameValue(nodes.map((n) => (n.layout ?? DEFAULT_LAYOUT).gap));
  const layoutPadding = sameValue(
    nodes.map((n) => (n.layout ?? DEFAULT_LAYOUT).padding)
  );
  const layoutColumns = sameValue(
    nodes.map((n) => (n.layout ?? DEFAULT_LAYOUT).columns)
  );
  const layoutRows = sameValue(nodes.map((n) => (n.layout ?? DEFAULT_LAYOUT).rows));
  const layoutPrimary = sameValue(
    nodes.map((n) => (n.layout ?? DEFAULT_LAYOUT).primaryAlign)
  );
  const layoutCounter = sameValue(
    nodes.map((n) => (n.layout ?? DEFAULT_LAYOUT).counterAlign)
  );

  const fillValues = nodes.map((n) =>
    n.type === 'text' ? n.color : n.fill ?? ''
  );
  const fill = sameValue(fillValues);
  const fillOpacity = sameValue(
    nodes.map((n) => (n.type === 'text' ? 1 : n.fillOpacity ?? 1))
  );
  const strokeColor = sameValue(nodes.map((n) => n.strokeColor ?? ''));
  const strokeWidth = sameValue(nodes.map((n) => n.strokeWidth ?? 0));
  const strokeOpacity = sameValue(nodes.map((n) => n.strokeOpacity ?? 1));
  const hasStroke =
    nodes.some((n) => (n.strokeWidth ?? 0) > 0 || !!n.strokeColor) &&
    (strokeWidth === null || strokeWidth > 0 || !!strokeColor);

  const t = node.transform;
  const layout = node.layout ?? DEFAULT_LAYOUT;
  const ratio = t.width > 0 ? t.height / t.width : 1;
  const fillHex = normalizeHex(
    fill || (node.type === 'text' ? node.color : node.fill || '#4f6ef7')
  );

  const setSize = (key: 'width' | 'height', value: number) => {
    const v = Math.max(1, value);
    if (!aspectLock || multi) {
      applyTransform({ [key]: v }, false);
      return;
    }
    if (key === 'width') {
      applyTransform({ width: v, height: Math.max(1, v * ratio) }, false);
    } else {
      applyTransform(
        { height: v, width: Math.max(1, ratio > 0 ? v / ratio : v) },
        false
      );
    }
  };

  const constraints = node.constraints ?? DEFAULT_CONSTRAINTS;
  const typeLabel = allSameType
    ? node.type
    : `混合(${[...new Set(nodes.map((n) => n.type))].join('/')})`;

  const commitRename = (value: string) => {
    const next = value.trim();
    if (next && next !== node.name) renameNode(node.id, next);
  };

  const onNameChange = (value: string) => {
    setNameDraft(value);
    if (renameTimerRef.current) clearTimeout(renameTimerRef.current);
    renameTimerRef.current = setTimeout(() => commitRename(value), 300);
  };

  const onNameBlur = () => {
    if (renameTimerRef.current) clearTimeout(renameTimerRef.current);
    commitRename(nameDraft);
  };

  return (
    <aside className="flex h-full min-w-0 w-full flex-col border-l border-slate-800 bg-slate-900 text-slate-200">
      <div className="border-b border-slate-800 px-3 py-2.5 text-[12px] font-medium text-slate-300">
        属性 · {typeLabel}
        {multi && (
          <span className="ml-2 font-normal text-sky-400/90">
            已选 {nodes.length} 个
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="space-y-3 px-3 py-3">
          {!multi ? (
            <input
              value={nameDraft}
              disabled={node.locked}
              onChange={(e) => onNameChange(e.target.value)}
              onBlur={onNameBlur}
              className="w-full rounded-md border-0 bg-slate-800 px-2.5 py-1.5 text-[12px] text-white outline-none focus:ring-1 focus:ring-sky-500/40 disabled:opacity-40"
            />
          ) : (
            <div className="rounded-md bg-slate-800/80 px-2.5 py-1.5 text-[11px] text-slate-400">
              多选批量编辑公共属性；不同值显示为 —
            </div>
          )}

          {!multi && !isRoot && (
            <ConstraintsSection
              locked={node.locked}
              constraints={constraints}
              onChange={(patch) => setConstraints(node.id, patch)}
            />
          )}

          {!multi && (
            <SemanticsSection
              doc={document}
              nodeId={node.id}
              locked={node.locked}
              role={node.role ?? 'none'}
              componentKey={node.componentKey ?? ''}
              displayName={node.name}
              states={node.states ?? ['normal']}
              activeState={node.activeState ?? 'normal'}
              bindingData={node.binding?.dataPath ?? ''}
              bindingEvent={node.binding?.event ?? ''}
              locKey={node.locKey ?? ''}
              notes={node.notes ?? ''}
              isText={node.type === 'text'}
              interaction={findInteractionForNode(document, node)}
              onPatchSemantics={(patch) => updateNodeSemantics(node.id, patch)}
              onPatchInteraction={(patch) => {
                const nextKey =
                  patch.preferKey !== undefined
                    ? patch.preferKey
                    : node.componentKey;
                const target = (nextKey && nextKey.trim()) || node.id;
                upsertInteraction({
                  target,
                  onClick: patch.onClick,
                  navigate: patch.navigate,
                  api: patch.api,
                  animation: patch.animation,
                  notes: patch.notes,
                });
              }}
            />
          )}

          <div className="flex items-center gap-1.5">
            <div className="flex min-w-0 flex-1 items-center rounded-md bg-slate-800 px-2 py-1.5 text-[12px]">
              <ScrubLabel
                className="mr-1 shrink-0 text-slate-500"
                value={
                  opacity == null
                    ? 100
                    : Math.round(opacity * 1000) / 10
                }
                step={1}
                min={0}
                max={100}
                disabled={allLocked}
                onChange={(v) =>
                  applyTransform(
                    { opacity: Math.min(1, Math.max(0, v / 100)) },
                    false
                  )
                }
                onCommit={() => flushTransform()}
              >
                不透明度
              </ScrubLabel>
              <span className="mr-0.5 text-slate-500">%</span>
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                disabled={allLocked}
                placeholder={opacity == null ? '—' : undefined}
                value={
                  opacity == null
                    ? ''
                    : Math.round(opacity * 1000) / 10
                }
                onChange={(e) => {
                  if (e.target.value === '') return;
                  applyTransform(
                    {
                      opacity: Math.min(
                        1,
                        Math.max(0, (Number(e.target.value) || 0) / 100)
                      ),
                    },
                    false
                  );
                }}
                onBlur={() => flushTransform()}
                className="num-field min-w-0 flex-1 bg-transparent text-white outline-none disabled:opacity-40 placeholder:text-slate-500"
              />
            </div>
            <IconTiny
              title={visible === false ? '显示' : '隐藏'}
              onClick={() => setVisible(!(visible ?? true))}
            >
              {visible === false ? <EyeOff size={14} /> : <Eye size={14} />}
            </IconTiny>
            <IconTiny
              title={locked === true ? '解锁' : '锁定'}
              onClick={() => setLocked(!(locked ?? false))}
            >
              {locked === true ? <Lock size={14} /> : <Unlock size={14} />}
            </IconTiny>
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
            <Field
              label="W"
              value={w == null ? null : round(w)}
              disabled={allLocked}
              onChange={(v) => setSize('width', v)}
              onBlur={flushTransform}
            />
            <button
              type="button"
              title={aspectLock ? '解除比例锁定' : '锁定宽高比'}
              disabled={multi}
              onClick={() => setAspectLock((v) => !v)}
              className={`rounded p-1 ${
                aspectLock ? 'text-sky-400' : 'text-slate-500 hover:text-slate-300'
              } disabled:opacity-30`}
            >
              {aspectLock ? <Link2 size={14} /> : <Link2Off size={14} />}
            </button>
            <Field
              label="H"
              value={h == null ? null : round(h)}
              disabled={allLocked}
              onChange={(v) => setSize('height', v)}
              onBlur={flushTransform}
            />
            <Field
              label="X"
              value={x == null ? null : round(x)}
              disabled={allLocked}
              onChange={(v) => applyTransform({ x: v }, false)}
              onBlur={flushTransform}
            />
            <span />
            <Field
              label="Y"
              value={y == null ? null : round(y)}
              disabled={allLocked}
              onChange={(v) => applyTransform({ y: v }, false)}
              onBlur={flushTransform}
            />
            <Field
              label={<RotateCcw size={12} />}
              title="旋转"
              value={rotation == null ? null : round(rotation)}
              disabled={allLocked}
              onChange={(v) => applyTransform({ rotation: v }, false)}
              onBlur={flushTransform}
            />
            <span />
            <Field
              label="R"
              title="圆角"
              value={corner == null ? null : round(corner)}
              disabled={allLocked}
              onChange={(v) =>
                applyStyle(node.id, { cornerRadius: Math.max(0, v) })
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <Field
              label="SX"
              title="缩放 X（按住标签左右拖动）"
              value={scaleX == null ? null : round(scaleX)}
              step={0.05}
              disabled={allLocked}
              onChange={(v) =>
                applyStyle(node.id, { scaleX: v === 0 ? 0.01 : v })
              }
            />
            <Field
              label="SY"
              title="缩放 Y（按住标签左右拖动）"
              value={scaleY == null ? null : round(scaleY)}
              step={0.05}
              disabled={allLocked}
              onChange={(v) =>
                applyStyle(node.id, { scaleY: v === 0 ? 0.01 : v })
              }
            />
          </div>
        </div>

        <PropSection title="布局">
          <div className="space-y-2 px-3 pb-3">
            <div className="flex gap-1">
              {(
                [
                  { mode: 'none', label: '无' },
                  { mode: 'horizontal', label: '横向' },
                  { mode: 'vertical', label: '纵向' },
                  { mode: 'grid', label: '网格' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.mode}
                  type="button"
                  disabled={allLocked}
                  title={opt.label}
                  onClick={() =>
                    applyStyle(node.id, { layout: { mode: opt.mode } })
                  }
                  className={`flex-1 rounded-md px-1 py-1.5 text-[10px] disabled:opacity-40 ${
                    layoutMode === opt.mode
                      ? 'bg-[#3a3a3a] text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {(layoutMode ?? layout.mode) !== 'none' && layoutMode !== null && (
              <>
                <div className="grid grid-cols-2 gap-1.5">
                  <Field
                    label="间距"
                    value={layoutGap}
                    disabled={allLocked}
                    onChange={(v) =>
                      applyStyle(node.id, { layout: { gap: Math.max(0, v) } })
                    }
                  />
                  <Field
                    label="边距"
                    value={layoutPadding}
                    disabled={allLocked}
                    onChange={(v) =>
                      applyStyle(node.id, {
                        layout: { padding: Math.max(0, v) },
                      })
                    }
                  />
                </div>
                {layoutMode === 'grid' && (
                  <div className="grid grid-cols-2 gap-1.5">
                    <Field
                      label="列"
                      value={layoutColumns}
                      disabled={allLocked}
                      onChange={(v) =>
                        applyStyle(node.id, {
                          layout: { columns: Math.max(1, v || 1) },
                        })
                      }
                    />
                    <Field
                      label="行"
                      title="0 = 自动"
                      value={layoutRows}
                      disabled={allLocked}
                      onChange={(v) =>
                        applyStyle(node.id, {
                          layout: { rows: Math.max(0, v) },
                        })
                      }
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-1.5">
                  <SelectField
                    label="主轴"
                    value={layoutPrimary ?? layout.primaryAlign}
                    mixed={layoutPrimary == null}
                    disabled={allLocked}
                    onChange={(v) =>
                      applyStyle(node.id, {
                        layout: {
                          primaryAlign: v as AutoLayout['primaryAlign'],
                        },
                      })
                    }
                    options={[
                      { value: 'start', label: '起始' },
                      { value: 'center', label: '居中' },
                      { value: 'end', label: '末端' },
                      { value: 'space-between', label: '两端' },
                    ]}
                  />
                  <SelectField
                    label="交叉"
                    value={layoutCounter ?? layout.counterAlign}
                    mixed={layoutCounter == null}
                    disabled={allLocked}
                    onChange={(v) =>
                      applyStyle(node.id, {
                        layout: {
                          counterAlign: v as AutoLayout['counterAlign'],
                        },
                      })
                    }
                    options={[
                      { value: 'start', label: '起始' },
                      { value: 'center', label: '居中' },
                      { value: 'end', label: '末端' },
                    ]}
                  />
                </div>
              </>
            )}
          </div>
        </PropSection>

        <PropSection title="填充">
          <div className="relative px-3 pb-3">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={allLocked}
                onClick={() => {
                  setStrokePicker(false);
                  setFillPicker((v) => !v);
                }}
                className="h-7 w-7 shrink-0 rounded border border-black/50 disabled:opacity-40"
                style={{
                  background:
                    fill == null
                      ? 'repeating-conic-gradient(#555 0% 25%, #333 0% 50%) 50% / 8px 8px'
                      : fill
                        ? fill
                        : 'repeating-conic-gradient(#555 0% 25%, #333 0% 50%) 50% / 8px 8px',
                }}
              />
              <input
                value={fill == null ? '' : fill.replace(/^#/, '')}
                disabled={allLocked}
                placeholder={fill == null ? '—' : '无'}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
                  if (raw.length === 6) {
                    const hex = `#${raw}`;
                    if (allText) applyText({ color: hex });
                    else if (!nodes.some((n) => n.type === 'text')) {
                      applyStyle(node.id, { fill: hex });
                    } else {
                      // mixed types including text: set both paths
                      for (const n of nodes) {
                        if (n.type === 'text') updateText(n.id, { color: hex });
                        else updateNodeStyle(n.id, { fill: hex });
                      }
                    }
                  } else if (!raw && !allText) {
                    applyStyle(node.id, { fill: undefined });
                  }
                }}
                className="min-w-0 flex-1 rounded-md border-0 bg-slate-800 px-2 py-1.5 font-mono text-[12px] text-white outline-none disabled:opacity-40 placeholder:text-slate-500"
              />
              <div className="flex w-[72px] items-center rounded-md bg-slate-800 px-1.5 py-1.5 text-[12px]">
                <ScrubLabel
                  className="mr-0.5 text-slate-500"
                  value={
                    fillOpacity == null
                      ? 100
                      : Number((fillOpacity * 100).toFixed(1))
                  }
                  step={1}
                  min={0}
                  max={100}
                  disabled={allLocked || allText}
                  onChange={(v) =>
                    applyStyle(node.id, {
                      fillOpacity: Math.min(1, Math.max(0, v / 100)),
                    })
                  }
                >
                  %
                </ScrubLabel>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  disabled={allLocked || allText}
                  placeholder={fillOpacity == null ? '—' : undefined}
                  value={
                    fillOpacity == null
                      ? ''
                      : Number((fillOpacity * 100).toFixed(1))
                  }
                  onChange={(e) => {
                    if (e.target.value === '') return;
                    applyStyle(node.id, {
                      fillOpacity: Math.min(
                        1,
                        Math.max(0, (Number(e.target.value) || 0) / 100)
                      ),
                    });
                  }}
                  className="num-field w-full bg-transparent text-white outline-none disabled:opacity-40 placeholder:text-slate-500"
                />
              </div>
              {!allText && (
                <button
                  type="button"
                  title="移除填充"
                  disabled={allLocked}
                  onClick={() => applyStyle(node.id, { fill: undefined })}
                  className="text-slate-500 hover:text-slate-200 disabled:opacity-40"
                >
                  <Minus size={14} />
                </button>
              )}
            </div>
            {fillPicker && (
              <ColorPickerPopover
                color={fillHex}
                alpha={fillOpacity ?? 1}
                onChange={(hex, alpha) => {
                  if (allText) applyText({ color: hex });
                  else if (!nodes.some((n) => n.type === 'text')) {
                    applyStyle(node.id, { fill: hex, fillOpacity: alpha });
                  } else {
                    for (const n of nodes) {
                      if (n.type === 'text') updateText(n.id, { color: hex });
                      else
                        updateNodeStyle(n.id, {
                          fill: hex,
                          fillOpacity: alpha,
                        });
                    }
                  }
                }}
                onClose={() => setFillPicker(false)}
              />
            )}
          </div>
        </PropSection>

        <PropSection
          title="描边"
          action={
            !hasStroke ? (
              <button
                type="button"
                title="添加描边"
                disabled={allLocked}
                onClick={() =>
                  applyStyle(node.id, {
                    strokeColor: '#ffffff',
                    strokeWidth: 1,
                    strokeOpacity: 1,
                  })
                }
                className="text-slate-500 hover:text-slate-200 disabled:opacity-40"
              >
                <Plus size={14} />
              </button>
            ) : undefined
          }
        >
          {hasStroke && (
            <div className="relative space-y-2 px-3 pb-3">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={allLocked}
                  onClick={() => {
                    setFillPicker(false);
                    setStrokePicker((v) => !v);
                  }}
                  className="h-7 w-7 shrink-0 rounded border border-black/50 disabled:opacity-40"
                  style={{
                    background:
                      strokeColor == null
                        ? 'repeating-conic-gradient(#555 0% 25%, #333 0% 50%) 50% / 8px 8px'
                        : strokeColor || '#ffffff',
                  }}
                />
                <input
                  value={
                    strokeColor == null ? '' : strokeColor.replace(/^#/, '')
                  }
                  disabled={allLocked}
                  placeholder={strokeColor == null ? '—' : undefined}
                  onChange={(e) => {
                    const raw = e.target.value
                      .replace(/[^0-9a-fA-F]/g, '')
                      .slice(0, 6);
                    if (raw.length === 6) {
                      applyStyle(node.id, { strokeColor: `#${raw}` });
                    }
                  }}
                  className="min-w-0 flex-1 rounded-md border-0 bg-slate-800 px-2 py-1.5 font-mono text-[12px] text-white outline-none disabled:opacity-40 placeholder:text-slate-500"
                />
                <div className="flex w-[72px] items-center rounded-md bg-slate-800 px-1.5 py-1.5 text-[12px]">
                  <ScrubLabel
                    className="mr-0.5 text-slate-500"
                    value={
                      strokeOpacity == null
                        ? 100
                        : Number((strokeOpacity * 100).toFixed(1))
                    }
                    step={1}
                    min={0}
                    max={100}
                    disabled={allLocked}
                    onChange={(v) =>
                      applyStyle(node.id, {
                        strokeOpacity: Math.min(1, Math.max(0, v / 100)),
                      })
                    }
                  >
                    %
                  </ScrubLabel>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    disabled={allLocked}
                    placeholder={strokeOpacity == null ? '—' : undefined}
                    value={
                      strokeOpacity == null
                        ? ''
                        : Number((strokeOpacity * 100).toFixed(1))
                    }
                    onChange={(e) => {
                      if (e.target.value === '') return;
                      applyStyle(node.id, {
                        strokeOpacity: Math.min(
                          1,
                          Math.max(0, (Number(e.target.value) || 0) / 100)
                        ),
                      });
                    }}
                    className="num-field w-full bg-transparent text-white outline-none disabled:opacity-40 placeholder:text-slate-500"
                  />
                </div>
                <button
                  type="button"
                  title="移除描边"
                  disabled={allLocked}
                  onClick={() =>
                    applyStyle(node.id, {
                      strokeWidth: 0,
                      strokeColor: undefined,
                    })
                  }
                  className="text-slate-500 hover:text-slate-200 disabled:opacity-40"
                >
                  <Minus size={14} />
                </button>
              </div>
              <Field
                label="粗细"
                value={strokeWidth}
                disabled={allLocked}
                onChange={(v) =>
                  applyStyle(node.id, { strokeWidth: Math.max(0, v) })
                }
              />
              {strokePicker && (
                <ColorPickerPopover
                  color={normalizeHex(strokeColor || '#ffffff')}
                  alpha={strokeOpacity ?? 1}
                  onChange={(hex, alpha) =>
                    applyStyle(node.id, {
                      strokeColor: hex,
                      strokeOpacity: alpha,
                      strokeWidth:
                        (strokeWidth ?? node.strokeWidth) > 0
                          ? strokeWidth ?? node.strokeWidth
                          : 1,
                    })
                  }
                  onClose={() => setStrokePicker(false)}
                />
              )}
            </div>
          )}
        </PropSection>

        {allText && node.type === 'text' && (
          <PropSection
            title="阴影"
            action={
              <button
                type="button"
                disabled={allLocked}
                title={
                  normalizeTextShadow(node.shadow).enabled
                    ? '关闭阴影'
                    : '开启阴影'
                }
                onClick={() => {
                  const cur = normalizeTextShadow(node.shadow);
                  applyText({
                    shadow: { ...cur, enabled: !cur.enabled },
                  });
                }}
                className="text-[10px] text-sky-400 hover:text-sky-300 disabled:opacity-40"
              >
                {normalizeTextShadow(node.shadow).enabled ? '关闭' : '开启'}
              </button>
            }
          >
            {normalizeTextShadow(node.shadow).enabled && (
              <TextShadowFields
                locked={allLocked}
                shadow={normalizeTextShadow(node.shadow)}
                onChange={(patch) =>
                  applyText({
                    shadow: { ...normalizeTextShadow(node.shadow), ...patch },
                  })
                }
              />
            )}
          </PropSection>
        )}

        {!allText && (
          <PropSection title="遮罩 / ScrollView">
            <div className="px-3 pb-3">
              <label className="flex items-start gap-2 text-[11px] leading-snug text-slate-400">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={clipContent === true}
                  ref={(el) => {
                    if (el) el.indeterminate = clipContent == null;
                  }}
                  disabled={allLocked}
                  onChange={(e) =>
                    applyStyle(node.id, { clipContent: e.target.checked })
                  }
                />
                裁剪子节点（超出隐藏，适合道具列表滚动区域）
                {clipContent == null && (
                  <span className="text-slate-600">· 混合</span>
                )}
              </label>
            </div>
          </PropSection>
        )}

        {allText && node.type === 'text' && (
          <PropSection title="文本">
            <div className="space-y-2 px-3 pb-3">
              {!multi && (
                <textarea
                  value={node.content ?? ''}
                  disabled={node.locked}
                  rows={3}
                  onChange={(e) => updateText(node.id, { content: e.target.value })}
                  className="w-full resize-y rounded-md border-0 bg-slate-800 px-2 py-1.5 text-[12px] text-white outline-none disabled:opacity-40"
                />
              )}
              <div className="grid grid-cols-2 gap-1.5">
                <Field
                  label="字号"
                  value={sameValue(
                    nodes.map((n) =>
                      n.type === 'text' ? n.fontSize ?? 28 : 28
                    )
                  )}
                  disabled={allLocked}
                  onChange={(v) =>
                    applyText({ fontSize: Math.max(8, v) })
                  }
                />
                <Field
                  label="行距"
                  value={sameValue(
                    nodes.map((n) => {
                      if (n.type !== 'text') return 0;
                      const fs = n.fontSize ?? 28;
                      return n.lineHeight > 0
                        ? n.lineHeight
                        : Math.round(fs * 1.25);
                    })
                  )}
                  disabled={allLocked}
                  onChange={(v) =>
                    applyText({ lineHeight: Math.max(0, Math.round(v)) })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <SelectField
                  label="水平对齐"
                  value={
                    sameValue(
                      nodes.map((n) =>
                        n.type === 'text' ? n.align || 'left' : 'left'
                      )
                    ) ?? 'left'
                  }
                  mixed={
                    sameValue(
                      nodes.map((n) =>
                        n.type === 'text' ? n.align || 'left' : 'left'
                      )
                    ) == null
                  }
                  disabled={allLocked}
                  onChange={(v) =>
                    applyText({ align: v as TextNode['align'] })
                  }
                  options={[
                    { value: 'left', label: '左' },
                    { value: 'center', label: '中' },
                    { value: 'right', label: '右' },
                  ]}
                />
                <SelectField
                  label="垂直对齐"
                  value={
                    sameValue(
                      nodes.map((n) =>
                        n.type === 'text'
                          ? n.verticalAlign || 'top'
                          : 'top'
                      )
                    ) ?? 'top'
                  }
                  mixed={
                    sameValue(
                      nodes.map((n) =>
                        n.type === 'text'
                          ? n.verticalAlign || 'top'
                          : 'top'
                      )
                    ) == null
                  }
                  disabled={allLocked}
                  onChange={(v) =>
                    applyText({
                      verticalAlign: v as TextNode['verticalAlign'],
                    })
                  }
                  options={[
                    { value: 'top', label: '上' },
                    { value: 'middle', label: '中' },
                    { value: 'bottom', label: '下' },
                  ]}
                />
              </div>
              <SelectField
                label="字体"
                value={
                  sameValue(
                    nodes.map((n) =>
                      n.type === 'text'
                        ? n.fontFamily ||
                          'Microsoft YaHei, PingFang SC, sans-serif'
                        : ''
                    )
                  ) ?? 'Microsoft YaHei, PingFang SC, sans-serif'
                }
                mixed={
                  sameValue(
                    nodes.map((n) =>
                      n.type === 'text'
                        ? n.fontFamily ||
                          'Microsoft YaHei, PingFang SC, sans-serif'
                        : ''
                    )
                  ) == null
                }
                disabled={allLocked}
                onChange={(v) => applyText({ fontFamily: v })}
                options={[
                  {
                    value: 'Microsoft YaHei, PingFang SC, sans-serif',
                    label: '雅黑 / 苹方',
                  },
                  { value: 'SimSun, Songti SC, serif', label: '宋体' },
                  { value: 'SimHei, Heiti SC, sans-serif', label: '黑体' },
                  { value: 'Arial, Helvetica, sans-serif', label: 'Arial' },
                ]}
              />
              <div className="grid grid-cols-2 gap-1.5">
                <SelectField
                  label="粗细"
                  value={
                    sameValue(
                      nodes.map((n) =>
                        n.type === 'text' ? n.fontWeight || 'normal' : 'normal'
                      )
                    ) ?? 'normal'
                  }
                  mixed={
                    sameValue(
                      nodes.map((n) =>
                        n.type === 'text' ? n.fontWeight || 'normal' : 'normal'
                      )
                    ) == null
                  }
                  disabled={allLocked}
                  onChange={(v) =>
                    applyText({
                      fontWeight: v as TextNode['fontWeight'],
                    })
                  }
                  options={[
                    { value: 'normal', label: '常规' },
                    { value: 'bold', label: '粗体' },
                  ]}
                />
                <SelectField
                  label="样式"
                  value={
                    sameValue(
                      nodes.map((n) =>
                        n.type === 'text' ? n.fontStyle || 'normal' : 'normal'
                      )
                    ) ?? 'normal'
                  }
                  mixed={
                    sameValue(
                      nodes.map((n) =>
                        n.type === 'text' ? n.fontStyle || 'normal' : 'normal'
                      )
                    ) == null
                  }
                  disabled={allLocked}
                  onChange={(v) =>
                    applyText({
                      fontStyle: v as TextNode['fontStyle'],
                    })
                  }
                  options={[
                    { value: 'normal', label: '常规' },
                    { value: 'italic', label: '斜体' },
                  ]}
                />
              </div>
              <label className="flex items-center gap-2 text-[11px] text-slate-400">
                <input
                  type="checkbox"
                  checked={
                    sameValue(
                      nodes.map((n) =>
                        n.type === 'text' ? n.wordWrap !== false : true
                      )
                    ) !== false
                  }
                  ref={(el) => {
                    if (el) {
                      el.indeterminate =
                        sameValue(
                          nodes.map((n) =>
                            n.type === 'text' ? n.wordWrap !== false : true
                          )
                        ) == null;
                    }
                  }}
                  disabled={allLocked}
                  onChange={(e) =>
                    applyText({ wordWrap: e.target.checked })
                  }
                />
                自动换行
              </label>
            </div>
          </PropSection>
        )}

        {!multi &&
          node.type === 'sprite' &&
          (node.role === 'toggle' || node.role === 'tab') && (
            <StateArtSection
              locked={node.locked}
              role={node.role}
              activeState={node.activeState ?? 'normal'}
              assetId={node.assetId}
              stateAssets={node.stateAssets}
              assets={document.assets}
              onPatchAssets={(patch) => updateSpriteStateAssets(node.id, patch)}
              onSetActive={(s) => setNodeActiveState(node.id, s)}
            />
          )}

        {!multi &&
          node.type === 'sprite' &&
          (() => {
            const spriteAsset = document.assets.find((a) => a.id === node.assetId);
            return (
              <div className="flex items-center gap-2 border-t border-slate-800 px-3 py-2">
                <div className="min-w-0 flex-1 text-[10px] text-slate-500">
                  精灵 {node.assetId}
                  {node.nineSlice ? ' · 九宫' : ''}
                  {spriteAsset && (
                    <span className="ml-1 text-slate-600">
                      · 原图 {spriteAsset.width}×{spriteAsset.height}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  disabled={node.locked || !spriteAsset}
                  title="重置为资源原始宽高，缩放 1，旋转 0°（位置不变）"
                  onClick={() => {
                    resetSpriteGeometry(node.id);
                    toast('已重置尺寸 / 缩放 / 旋转', 'success');
                  }}
                  className="inline-flex shrink-0 items-center gap-1 rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800 hover:text-sky-300 disabled:opacity-40"
                >
                  <RotateCcw size={12} />
                  重置
                </button>
              </div>
            );
          })()}
      </div>
    </aside>
  );
}

function PropSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-t border-slate-800">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-[11px] font-semibold text-slate-400">{title}</span>
        {action}
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  title,
  value,
  step = 1,
  min,
  max,
  disabled,
  onChange,
  onBlur,
}: {
  label: React.ReactNode;
  title?: string;
  value: number | null;
  step?: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  onChange: (v: number) => void;
  onBlur?: () => void;
}) {
  const display = value == null ? 0 : value;
  const nudge = (dir: 1 | -1) => {
    if (disabled) return;
    let next = Number((display + dir * step).toFixed(6));
    if (min != null) next = Math.max(min, next);
    if (max != null) next = Math.min(max, next);
    onChange(next);
    onBlur?.();
  };

  return (
    <div
      title={title}
      className="flex min-w-0 items-center gap-1 rounded-md bg-slate-800 px-2 py-1 text-[12px]"
    >
      <ScrubLabel
        className="shrink-0 text-slate-500"
        value={display}
        step={step}
        min={min}
        max={max}
        disabled={disabled}
        onChange={onChange}
        onCommit={onBlur}
      >
        {label}
      </ScrubLabel>
      <input
        type="number"
        step={step}
        min={min}
        max={max}
        value={value == null ? '' : value}
        placeholder="—"
        disabled={disabled}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '' || raw === '-') return;
          const n = Number(raw);
          if (!Number.isFinite(n)) return;
          let next = n;
          if (min != null) next = Math.max(min, next);
          if (max != null) next = Math.min(max, next);
          onChange(next);
        }}
        onBlur={onBlur}
        className="num-field min-w-0 flex-1 bg-transparent text-white outline-none disabled:opacity-40 placeholder:text-slate-500"
      />
      <div className="flex shrink-0 flex-col">
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          aria-label="increase"
          onClick={() => nudge(1)}
          className="rounded-t px-0.5 text-slate-500 hover:bg-slate-700 hover:text-slate-200 disabled:opacity-40"
        >
          <ChevronUp size={10} />
        </button>
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          aria-label="decrease"
          onClick={() => nudge(-1)}
          className="rounded-b px-0.5 text-slate-500 hover:bg-slate-700 hover:text-slate-200 disabled:opacity-40"
        >
          <ChevronDown size={10} />
        </button>
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  mixed,
  disabled,
  onChange,
  options,
}: {
  label: string;
  value: string;
  mixed?: boolean;
  disabled?: boolean;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1.5 rounded-md bg-slate-800 px-2 py-1.5 text-[11px] text-slate-400">
      <span className="shrink-0">{label}</span>
      <DarkSelect
        value={mixed ? '' : value}
        disabled={disabled}
        onChange={(v) => {
          if (mixed && !v) return;
          onChange(v);
        }}
        options={
          mixed
            ? [{ value: '', label: '—' }, ...options]
            : options
        }
        className="flex-1"
      />
    </div>
  );
}

function IconTiny({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="rounded p-1.5 text-slate-500 hover:bg-slate-800 hover:text-slate-200"
    >
      {children}
    </button>
  );
}

function round(n: number) {
  return Number(n.toFixed(1));
}


function ConstraintsSection({
  locked,
  constraints,
  onChange,
}: {
  locked: boolean;
  constraints: Constraints;
  onChange: (patch: Partial<Constraints>) => void;
}) {
  const h = constraints.horizontal;
  const v = constraints.vertical;

  const hLeft = h === 'left' || h === 'left-right';
  const hRight = h === 'right' || h === 'left-right';
  const hCenter = h === 'center';
  const hScale = h === 'scale';
  const vTop = v === 'top' || v === 'top-bottom';
  const vBottom = v === 'bottom' || v === 'top-bottom';
  const vCenter = v === 'center';
  const vScale = v === 'scale';

  const setHorizontal = (next: HorizontalConstraint) => onChange({ horizontal: next });
  const setVertical = (next: VerticalConstraint) => onChange({ vertical: next });

  const cycleHorizontalEdge = (edge: 'left' | 'right') => {
    if (h === 'scale') {
      setHorizontal(edge === 'left' ? 'left' : 'right');
      return;
    }
    if (edge === 'left') {
      if (h === 'left') setHorizontal('center');
      else if (h === 'right') setHorizontal('left-right');
      else if (h === 'left-right') setHorizontal('right');
      else if (h === 'center') setHorizontal('left');
      else setHorizontal('left');
    } else {
      if (h === 'right') setHorizontal('center');
      else if (h === 'left') setHorizontal('left-right');
      else if (h === 'left-right') setHorizontal('left');
      else if (h === 'center') setHorizontal('right');
      else setHorizontal('right');
    }
  };

  const cycleVerticalEdge = (edge: 'top' | 'bottom') => {
    if (v === 'scale') {
      setVertical(edge === 'top' ? 'top' : 'bottom');
      return;
    }
    if (edge === 'top') {
      if (v === 'top') setVertical('center');
      else if (v === 'bottom') setVertical('top-bottom');
      else if (v === 'top-bottom') setVertical('bottom');
      else if (v === 'center') setVertical('top');
      else setVertical('top');
    } else {
      if (v === 'bottom') setVertical('center');
      else if (v === 'top') setVertical('top-bottom');
      else if (v === 'top-bottom') setVertical('top');
      else if (v === 'center') setVertical('bottom');
      else setVertical('bottom');
    }
  };

  const hLabel: Record<HorizontalConstraint, string> = {
    left: '左',
    right: '右',
    center: '水平居中',
    'left-right': '左右拉伸',
    scale: '水平缩放',
  };
  const vLabel: Record<VerticalConstraint, string> = {
    top: '顶',
    bottom: '底',
    center: '垂直居中',
    'top-bottom': '上下拉伸',
    scale: '垂直缩放',
  };

  return (
    <div className="space-y-2 rounded-md border border-slate-800 bg-slate-950/60 p-2">
      <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
        约束 · 相对父节点
      </div>
      <p className="text-[10px] leading-snug text-slate-600">
        父节点或画布尺寸变化时，子节点如何跟随（类似 Figma Constraints）。与工具栏对齐不同。
      </p>

      <div className="flex items-start gap-3">
        <div className="relative mx-auto h-[88px] w-[88px] shrink-0 rounded-md border border-slate-700 bg-slate-900">
          <button type="button" disabled={locked} title="顶边约束" onClick={() => cycleVerticalEdge('top')}
            className={`absolute left-1/2 top-1.5 h-1.5 w-7 -translate-x-1/2 rounded-sm ${vTop && !vScale ? 'bg-sky-400' : 'bg-slate-600'} disabled:opacity-40`} />
          <button type="button" disabled={locked} title="底边约束" onClick={() => cycleVerticalEdge('bottom')}
            className={`absolute bottom-1.5 left-1/2 h-1.5 w-7 -translate-x-1/2 rounded-sm ${vBottom && !vScale ? 'bg-sky-400' : 'bg-slate-600'} disabled:opacity-40`} />
          <button type="button" disabled={locked} title="左边约束" onClick={() => cycleHorizontalEdge('left')}
            className={`absolute left-1.5 top-1/2 h-7 w-1.5 -translate-y-1/2 rounded-sm ${hLeft && !hScale ? 'bg-sky-400' : 'bg-slate-600'} disabled:opacity-40`} />
          <button type="button" disabled={locked} title="右边约束" onClick={() => cycleHorizontalEdge('right')}
            className={`absolute right-1.5 top-1/2 h-7 w-1.5 -translate-y-1/2 rounded-sm ${hRight && !hScale ? 'bg-sky-400' : 'bg-slate-600'} disabled:opacity-40`} />
          <button type="button" disabled={locked} title="居中"
            onClick={() => onChange({ horizontal: hCenter ? 'left' : 'center', vertical: vCenter ? 'top' : 'center' })}
            className={`absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-sm border ${hCenter || vCenter ? 'border-sky-400 bg-sky-400/30' : 'border-slate-500 bg-slate-800'} disabled:opacity-40`} />
          {(hScale || vScale) && (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[9px] text-amber-300/90">缩放</span>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <label className="flex flex-col gap-0.5 text-[11px] text-slate-400">
            <span>水平</span>
            <DarkSelect
              disabled={locked}
              value={h}
              onChange={(v) => setHorizontal(v as HorizontalConstraint)}
              options={(Object.keys(hLabel) as HorizontalConstraint[]).map((k) => ({ value: k, label: hLabel[k] }))}
              buttonClassName="rounded-md bg-slate-800 px-2 py-1.5"
            />
          </label>
          <label className="flex flex-col gap-0.5 text-[11px] text-slate-400">
            <span>垂直</span>
            <DarkSelect
              disabled={locked}
              value={v}
              onChange={(v) => setVertical(v as VerticalConstraint)}
              options={(Object.keys(vLabel) as VerticalConstraint[]).map((k) => ({ value: k, label: vLabel[k] }))}
              buttonClassName="rounded-md bg-slate-800 px-2 py-1.5"
            />
          </label>
          <p className="text-[10px] text-slate-600">当前：{hLabel[h]} · {vLabel[v]}</p>
        </div>
      </div>
    </div>
  );
}

const ROLE_LABELS: Record<NodeRole, string> = {
  none: '无',
  button: '按钮',
  input: '输入',
  toggle: '开关',
  list: '列表',
  listItem: '列表项',
  scroll: '滚动',
  label: '文案',
  image: '图片',
  panel: '面板',
  icon: '图标',
  progress: '进度',
  dynamicValue: '动态数值',
  tab: '页签',
  other: '其他',
};

const STATE_LABELS: Record<NodeUiState, string> = {
  normal: '常态',
  pressed: '按下',
  disabled: '禁用',
  selected: '选中',
  hover: '悬停',
};

function SemanticsSection({
  doc,
  nodeId,
  locked,
  role,
  componentKey,
  displayName,
  states,
  activeState,
  bindingData,
  bindingEvent,
  locKey,
  notes,
  isText,
  interaction,
  onPatchSemantics,
  onPatchInteraction,
}: {
  doc: Document;
  nodeId: string;
  locked: boolean;
  role: NodeRole;
  componentKey: string;
  displayName: string;
  states: NodeUiState[];
  activeState: NodeUiState;
  bindingData: string;
  bindingEvent: string;
  locKey: string;
  notes: string;
  isText: boolean;
  interaction?: {
    onClick?: string;
    navigate?: string;
    api?: string;
    animation?: string;
    notes?: string;
  };
  onPatchSemantics: (patch: {
    role?: NodeRole;
    componentKey?: string | undefined;
    states?: NodeUiState[];
    activeState?: NodeUiState;
    binding?: { dataPath?: string; event?: string } | undefined;
    locKey?: string | undefined;
    notes?: string | undefined;
  }) => void;
  onPatchInteraction: (patch: {
    preferKey?: string;
    onClick?: string;
    navigate?: string;
    api?: string;
    animation?: string;
    notes?: string;
  }) => void;
}) {
  const issues = useMemo(
    () => lintNodeIssuesForNode(doc, nodeId),
    [doc, nodeId]
  );
  const showInteraction = role !== 'none' || !!componentKey || !!interaction;
  const hasAdvanced =
    states.length > 1 ||
    activeState !== 'normal' ||
    !!bindingData ||
    !!bindingEvent ||
    !!notes ||
    !!locKey ||
    showInteraction;
  const [advancedOpen, setAdvancedOpen] = useState(hasAdvanced);
  const stateOptions = states.length
    ? NODE_UI_STATES.filter((s) => states.includes(s))
    : (['normal'] as NodeUiState[]);

  const toggleState = (s: NodeUiState) => {
    const has = states.includes(s);
    const next = has ? states.filter((x) => x !== s) : [...states, s];
    onPatchSemantics({ states: next.length ? next : ['normal'] });
  };

  const generateKey = () => {
    const key = suggestComponentKey(role === 'none' ? 'other' : role, displayName);
    onPatchSemantics({ componentKey: key });
    if (/[\u4e00-\u9fff]/.test(displayName)) {
      toast('中文名已生成稳定 Key，建议再改成业务英文（如 btn_login）', 'info');
    }
  };

  return (
    <div className="space-y-2 rounded-md border border-slate-800 bg-slate-950/60 p-2">
      <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
        语义 / AI 交接
      </div>
      <p className="text-[10px] leading-snug text-slate-600">
        日常做图可忽略。点工具栏「AI 交接」导出时，给程序/AI 看的说明，不影响画布预览。
      </p>

      <SelectField
        label="角色"
        value={role}
        disabled={locked}
        onChange={(v) => onPatchSemantics({ role: v as NodeRole })}
        options={NODE_ROLES.map((r) => ({
          value: r,
          label: ROLE_LABELS[r],
        }))}
      />

      <div className="flex gap-1">
        <label className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-1.5 rounded-md bg-slate-800 px-2 py-1.5 text-[11px] text-slate-400">
            <span className="shrink-0">Key</span>
            <input
              value={componentKey}
              disabled={locked}
              placeholder="btn_login"
              onChange={(e) =>
                onPatchSemantics({
                  componentKey: e.target.value || undefined,
                })
              }
              className="min-w-0 flex-1 bg-transparent font-mono text-[11px] text-white outline-none disabled:opacity-40"
            />
          </span>
          <span className="px-0.5 text-[10px] text-slate-600">
            可选。按钮等可交互元素建议填，如 btn_login
          </span>
        </label>
        <button
          type="button"
          disabled={locked}
          title="按角色生成 componentKey"
          onClick={generateKey}
          className="h-[34px] shrink-0 rounded-md bg-slate-800 px-2 text-[10px] text-sky-400 hover:bg-slate-700 disabled:opacity-40"
        >
          生成
        </button>
      </div>

      {issues.length > 0 && (
        <ul className="space-y-1 rounded border border-amber-900/40 bg-amber-950/20 px-2 py-1.5 text-[10px] text-amber-200/90">
          {issues.map((i) => (
            <li key={i.code} className="flex items-start gap-1">
              <span className="min-w-0 flex-1">
                {i.message}
                {i.suggestion ? ` → ${i.suggestion}` : ''}
              </span>
              {i.suggestion && (
                <button
                  type="button"
                  className="shrink-0 text-sky-400 hover:underline"
                  onClick={() =>
                    onPatchSemantics({ componentKey: i.suggestion })
                  }
                >
                  应用
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => setAdvancedOpen((o) => !o)}
        className="flex w-full items-center gap-1 rounded-md bg-slate-900/80 px-2 py-1.5 text-left text-[10px] text-slate-500 hover:bg-slate-800"
      >
        {advancedOpen ? (
          <ChevronDown className="h-3 w-3 shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0" />
        )}
        <span>高级交接（可选）</span>
        {!advancedOpen && hasAdvanced && (
          <span className="ml-auto text-sky-500/80">已填写</span>
        )}
      </button>

      {advancedOpen && (
        <div className="space-y-2 border-t border-slate-800 pt-2">
      <div>
        <div className="mb-1 text-[10px] text-slate-600">参与状态（仅导出）</div>
        <div className="flex flex-wrap gap-1">
          {NODE_UI_STATES.map((s) => {
            const on = states.includes(s);
            return (
              <button
                key={s}
                type="button"
                disabled={locked}
                onClick={() => toggleState(s)}
                className={`rounded px-1.5 py-0.5 text-[10px] ${
                  on
                    ? 'bg-sky-900/50 text-sky-300'
                    : 'bg-slate-800 text-slate-500'
                } disabled:opacity-40`}
              >
                {STATE_LABELS[s]}
              </button>
            );
          })}
        </div>
      </div>

      <SelectField
        label="默认态"
        value={stateOptions.includes(activeState) ? activeState : stateOptions[0]!}
        disabled={locked}
        onChange={(v) =>
          onPatchSemantics({ activeState: v as NodeUiState })
        }
        options={stateOptions.map((s) => ({
          value: s,
          label: STATE_LABELS[s],
        }))}
      />

      <HintField
        label="数据路径"
        hint="例 user.name — 绑定到界面数据"
        value={bindingData}
        disabled={locked}
        placeholder="user.name"
        onChange={(v) =>
          onPatchSemantics({
            binding: {
              dataPath: v,
              event: bindingEvent || undefined,
            },
          })
        }
      />
      <HintField
        label="绑定事件"
        hint="例 onSubmit — 与下方 onClick 不同，偏数据层"
        value={bindingEvent}
        disabled={locked}
        placeholder="onSubmit"
        onChange={(v) =>
          onPatchSemantics({
            binding: {
              dataPath: bindingData || undefined,
              event: v,
            },
          })
        }
      />

      {isText && (
        <HintField
          label="多语言 Key"
          hint="例 ui.login.title — 正文仅占位"
          value={locKey}
          disabled={locked}
          placeholder="ui.login.title"
          onChange={(v) => onPatchSemantics({ locKey: v || undefined })}
        />
      )}

      <HintField
        label="备注"
        hint="给实现方的自由说明"
        value={notes}
        disabled={locked}
        placeholder=""
        onChange={(v) => onPatchSemantics({ notes: v || undefined })}
      />

      {!showInteraction ? (
        <p className="rounded border border-dashed border-slate-800 px-2 py-2 text-[10px] text-slate-600">
          建议先选角色或填写 Key，再配置点击 / 跳转 / 接口。
        </p>
      ) : (
        <>
          <div className="border-t border-slate-800 pt-2 text-[10px] font-medium uppercase tracking-wider text-slate-500">
            页面交互
          </div>
          {(
            [
              ['onClick', '点击', '例 openShop / submitLogin'],
              ['navigate', '跳转', '例 ShopPage / #settings'],
              ['api', '接口', '例 POST /auth/login'],
              ['animation', '动画', '例 fadeIn'],
              ['notes', '说明', '补充约束'],
            ] as const
          ).map(([field, label, hint]) => (
            <label key={field} className="flex min-w-0 flex-col gap-0.5">
              <span className="flex items-center gap-1.5 rounded-md bg-slate-800 px-2 py-1.5 text-[11px] text-slate-400">
                <span className="w-10 shrink-0">{label}</span>
                <input
                  value={
                    field === 'onClick'
                      ? interaction?.onClick ?? ''
                      : field === 'navigate'
                        ? interaction?.navigate ?? ''
                        : field === 'api'
                          ? interaction?.api ?? ''
                          : field === 'animation'
                            ? interaction?.animation ?? ''
                            : interaction?.notes ?? ''
                  }
                  disabled={locked}
                  placeholder={hint}
                  onChange={(e) => {
                    onPatchInteraction({
                      onClick: interaction?.onClick,
                      navigate: interaction?.navigate,
                      api: interaction?.api,
                      animation: interaction?.animation,
                      notes: interaction?.notes,
                      [field]: e.target.value,
                      preferKey: componentKey,
                    });
                  }}
                  className="min-w-0 flex-1 bg-transparent text-white outline-none disabled:opacity-40"
                />
              </span>
            </label>
          ))}
        </>
      )}
        </div>
      )}
    </div>
  );
}


function TextShadowFields({
  locked,
  shadow,
  onChange,
}: {
  locked: boolean;
  shadow: TextShadow;
  onChange: (patch: Partial<TextShadow>) => void;
}) {
  return (
    <div className="space-y-2 px-3 pb-3">
      <p className="text-[10px] text-slate-600">
        文字投影；导出字段 shadow（enabled / color / alpha / blur / offsetX / offsetY）。
      </p>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={locked}
          className="h-7 w-7 shrink-0 rounded border border-black/50 disabled:opacity-40"
          style={{ background: shadow.color }}
          title="阴影颜色"
          onClick={() => {
            /* color via hex input below */
          }}
        />
        <input
          value={shadow.color.replace(/^#/, '')}
          disabled={locked}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
            if (raw.length === 6) onChange({ color: `#${raw}` });
          }}
          className="min-w-0 flex-1 rounded-md border-0 bg-slate-800 px-2 py-1.5 font-mono text-[12px] text-white outline-none disabled:opacity-40"
        />
        <div className="flex w-[72px] items-center rounded-md bg-slate-800 px-1.5 py-1.5 text-[12px]">
          <ScrubLabel
            className="mr-0.5 text-slate-500"
            value={Number((shadow.alpha * 100).toFixed(0))}
            step={1}
            min={0}
            max={100}
            disabled={locked}
            onChange={(v) => onChange({ alpha: Math.min(1, Math.max(0, v / 100)) })}
          >
            %
          </ScrubLabel>
          <input
            type="number"
            min={0}
            max={100}
            disabled={locked}
            value={Number((shadow.alpha * 100).toFixed(0))}
            onChange={(e) =>
              onChange({
                alpha: Math.min(1, Math.max(0, (Number(e.target.value) || 0) / 100)),
              })
            }
            className="num-field w-full bg-transparent text-white outline-none disabled:opacity-40"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <Field
          label="模糊"
          value={shadow.blur}
          step={0.5}
          min={0}
          disabled={locked}
          onChange={(v) => onChange({ blur: Math.max(0, v) })}
        />
        <Field
          label="X"
          value={shadow.offsetX}
          step={1}
          disabled={locked}
          onChange={(v) => onChange({ offsetX: v })}
        />
        <Field
          label="Y"
          value={shadow.offsetY}
          step={1}
          disabled={locked}
          onChange={(v) => onChange({ offsetY: v })}
        />
      </div>
    </div>
  );
}

function StateArtSection({
  locked,
  role,
  activeState,
  assetId,
  stateAssets,
  assets,
  onPatchAssets,
  onSetActive,
}: {
  locked: boolean;
  role: 'toggle' | 'tab';
  activeState: string;
  assetId: string;
  stateAssets?: Partial<Record<string, string>>;
  assets: { id: string; name: string; dataUrl: string }[];
  onPatchAssets: (patch: { normal?: string; selected?: string }) => void;
  onSetActive: (s: 'normal' | 'selected') => void;
}) {
  const normalId = stateAssets?.normal || assetId;
  const selectedId = stateAssets?.selected || '';
  const options = [
    { value: '', label: '（未指定）' },
    ...assets.map((a) => ({ value: a.id, label: a.name })),
  ];
  const offLabel = role === 'toggle' ? '关闭图' : '未选中图';
  const onLabel = role === 'toggle' ? '打开图' : '选中图';
  const isOn = activeState === 'selected';

  return (
    <div className="space-y-2 border-t border-slate-800 px-3 py-2">
      <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
        {role === 'toggle' ? '开关 · 状态贴图' : '页签 · 状态贴图'}
      </div>
      <p className="text-[10px] leading-snug text-slate-600">
        {role === 'toggle'
          ? '指定打开/关闭两张图；导出 stateAssets.normal / selected，用 activeState 切换。'
          : '同组多个 role=tab 的精灵互斥选中；导出 stateAssets + activeState。'}
      </p>
      <div className="flex items-center gap-2">
        <AssetThumb assets={assets} id={normalId} />
        <div className="min-w-0 flex-1">
          <SelectField
            label={offLabel}
            value={normalId}
            disabled={locked || assets.length === 0}
            onChange={(v) => onPatchAssets({ normal: v || undefined })}
            options={options.filter((o) => o.value !== '')}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <AssetThumb assets={assets} id={selectedId} />
        <div className="min-w-0 flex-1">
          <SelectField
            label={onLabel}
            value={selectedId}
            disabled={locked || assets.length === 0}
            onChange={(v) => onPatchAssets({ selected: v || undefined })}
            options={options}
          />
        </div>
      </div>
      <button
        type="button"
        disabled={locked}
        onClick={() => onSetActive(isOn ? 'normal' : 'selected')}
        className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-[11px] text-slate-200 hover:bg-slate-700 disabled:opacity-40"
      >
        {role === 'toggle'
          ? isOn
            ? '预览：当前为打开 → 点此切到关闭'
            : '预览：当前为关闭 → 点此切到打开'
          : isOn
            ? '预览：当前选中 → 点此取消选中'
            : '预览：设为选中（同组其他页签取消）'}
      </button>
    </div>
  );
}

function AssetThumb({
  assets,
  id,
}: {
  assets: { id: string; name: string; dataUrl: string }[];
  id: string;
}) {
  const a = assets.find((x) => x.id === id);
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded border border-slate-700 bg-slate-950">
      {a ? (
        <img src={a.dataUrl} alt="" className="max-h-full max-w-full object-contain" />
      ) : (
        <span className="text-[9px] text-slate-600">无</span>
      )}
    </div>
  );
}


function HintField({
  label,
  hint,
  value,
  disabled,
  placeholder,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  disabled?: boolean;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-0.5">
      <span className="flex items-center gap-1.5 rounded-md bg-slate-800 px-2 py-1.5 text-[11px] text-slate-400">
        <span className="w-14 shrink-0">{label}</span>
        <input
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1 bg-transparent text-white outline-none disabled:opacity-40"
        />
      </span>
      <span className="px-0.5 text-[10px] text-slate-600">{hint}</span>
    </label>
  );
}

