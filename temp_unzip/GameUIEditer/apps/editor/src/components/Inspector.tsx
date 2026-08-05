import { findNodeInDocument, TextNode } from '@game-ui/document';
import { useEditorStore } from '../store/editorStore';

export function Inspector() {
  const document = useEditorStore((s) => s.document);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const setTransform = useEditorStore((s) => s.setTransform);
  const flushTransform = useEditorStore((s) => s.flushTransform);
  const renameSelected = useEditorStore((s) => s.renameSelected);
  const updateText = useEditorStore((s) => s.updateText);

  const id = selectedIds[0];
  const found = id ? findNodeInDocument(document, id) : null;
  const node = found?.node;

  if (!node) {
    return (
      <div className="border-t border-slate-800 p-3 text-xs text-slate-500">
        选中图层以编辑属性
      </div>
    );
  }

  const t = node.transform;

  const field = (
    label: string,
    key: 'x' | 'y' | 'width' | 'height' | 'rotation' | 'opacity',
    step = 1
  ) => (
    <label className="flex items-center gap-2 text-[11px] text-slate-400">
      <span className="w-8 shrink-0">{label}</span>
      <input
        type="number"
        step={step}
        value={Number(t[key].toFixed(key === 'opacity' ? 2 : 1))}
        disabled={node.locked}
        onChange={(e) => {
          const v = Number(e.target.value);
          setTransform(node.id, { [key]: v }, false);
        }}
        onBlur={() => flushTransform()}
        className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200 disabled:opacity-40"
      />
    </label>
  );

  return (
    <div className="max-h-[45%] overflow-auto border-t border-slate-800 p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
        属性 · {node.type}
      </div>
      <label className="mb-2 flex items-center gap-2 text-[11px] text-slate-400">
        <span className="w-8 shrink-0">名称</span>
        <input
          value={node.name}
          disabled={node.locked}
          onChange={(e) => renameSelected(e.target.value)}
          className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200 disabled:opacity-40"
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        {field('X', 'x')}
        {field('Y', 'y')}
        {field('W', 'width')}
        {field('H', 'height')}
        {field('R', 'rotation')}
        {field('A', 'opacity', 0.05)}
      </div>

      {node.type === 'rect' && (
        <p className="mt-2 text-[10px] text-slate-500">填充: {node.fill}</p>
      )}
      {node.type === 'sprite' && (
        <p className="mt-2 text-[10px] text-slate-500">
          精灵 {node.assetId}
          {node.nineSlice ? ' · 九宫拉伸' : ''}
        </p>
      )}

      {node.type === 'text' && (
        <TextProps
          node={node}
          disabled={node.locked}
          onChange={(patch) => updateText(node.id, patch)}
        />
      )}
    </div>
  );
}

function TextProps({
  node,
  disabled,
  onChange,
}: {
  node: TextNode;
  disabled: boolean;
  onChange: (patch: Partial<TextNode>) => void;
}) {
  const n = {
    content: node.content ?? '',
    fontSize: node.fontSize ?? 28,
    fontFamily: node.fontFamily ?? 'Microsoft YaHei, PingFang SC, sans-serif',
    fontWeight: node.fontWeight ?? 'normal',
    fontStyle: node.fontStyle ?? 'normal',
    color: node.color ?? '#ffffff',
    align: node.align ?? 'left',
    verticalAlign: node.verticalAlign ?? 'top',
    lineHeight: node.lineHeight ?? 0,
    letterSpacing: node.letterSpacing ?? 0,
    wordWrap: node.wordWrap !== false,
    strokeColor: node.strokeColor ?? '#000000',
    strokeWidth: node.strokeWidth ?? 0,
  };

  return (
    <div className="mt-3 space-y-2 border-t border-slate-800 pt-3">
      <div className="text-[11px] font-semibold text-slate-400">文本</div>

      <label className="block text-[11px] text-slate-400">
        内容
        <textarea
          value={n.content}
          disabled={disabled}
          rows={3}
          onChange={(e) => onChange({ content: e.target.value })}
          className="mt-1 w-full resize-y rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200 disabled:opacity-40"
        />
      </label>

      <label className="flex items-center gap-2 text-[11px] text-slate-400">
        <span className="w-14 shrink-0">字号</span>
        <input
          type="number"
          min={8}
          value={n.fontSize}
          disabled={disabled}
          onChange={(e) => onChange({ fontSize: Math.max(8, Number(e.target.value) || 8) })}
          className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200 disabled:opacity-40"
        />
      </label>

      <label className="flex items-center gap-2 text-[11px] text-slate-400">
        <span className="w-14 shrink-0">字体</span>
        <select
          value={n.fontFamily}
          disabled={disabled}
          onChange={(e) => onChange({ fontFamily: e.target.value })}
          className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200 disabled:opacity-40"
        >
          <option value="Microsoft YaHei, PingFang SC, sans-serif">雅黑 / 苹方</option>
          <option value="SimSun, Songti SC, serif">宋体</option>
          <option value="SimHei, Heiti SC, sans-serif">黑体</option>
          <option value="KaiTi, Kaiti SC, serif">楷体</option>
          <option value="Arial, Helvetica, sans-serif">Arial</option>
          <option value="Georgia, serif">Georgia</option>
          <option value="Courier New, monospace">Courier</option>
        </select>
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex items-center gap-2 text-[11px] text-slate-400">
          <span className="w-10 shrink-0">粗细</span>
          <select
            value={n.fontWeight}
            disabled={disabled}
            onChange={(e) =>
              onChange({ fontWeight: e.target.value as TextNode['fontWeight'] })
            }
            className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200 disabled:opacity-40"
          >
            <option value="normal">常规</option>
            <option value="bold">粗体</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-[11px] text-slate-400">
          <span className="w-10 shrink-0">样式</span>
          <select
            value={n.fontStyle}
            disabled={disabled}
            onChange={(e) =>
              onChange({ fontStyle: e.target.value as TextNode['fontStyle'] })
            }
            className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200 disabled:opacity-40"
          >
            <option value="normal">正常</option>
            <option value="italic">斜体</option>
          </select>
        </label>
      </div>

      <label className="flex items-center gap-2 text-[11px] text-slate-400">
        <span className="w-14 shrink-0">颜色</span>
        <input
          type="color"
          value={normalizeHex(n.color)}
          disabled={disabled}
          onChange={(e) => onChange({ color: e.target.value })}
          className="h-7 w-10 cursor-pointer rounded border border-slate-700 bg-slate-950 disabled:opacity-40"
        />
        <input
          value={n.color}
          disabled={disabled}
          onChange={(e) => onChange({ color: e.target.value })}
          className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200 disabled:opacity-40"
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex items-center gap-2 text-[11px] text-slate-400">
          <span className="w-10 shrink-0">对齐</span>
          <select
            value={n.align}
            disabled={disabled}
            onChange={(e) => onChange({ align: e.target.value as TextNode['align'] })}
            className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200 disabled:opacity-40"
          >
            <option value="left">左</option>
            <option value="center">中</option>
            <option value="right">右</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-[11px] text-slate-400">
          <span className="w-10 shrink-0">垂直</span>
          <select
            value={n.verticalAlign}
            disabled={disabled}
            onChange={(e) =>
              onChange({ verticalAlign: e.target.value as TextNode['verticalAlign'] })
            }
            className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200 disabled:opacity-40"
          >
            <option value="top">顶</option>
            <option value="middle">中</option>
            <option value="bottom">底</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex items-center gap-2 text-[11px] text-slate-400">
          <span className="w-10 shrink-0">行高</span>
          <input
            type="number"
            min={0}
            title="0 = 自动"
            value={n.lineHeight}
            disabled={disabled}
            onChange={(e) => onChange({ lineHeight: Math.max(0, Number(e.target.value) || 0) })}
            className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200 disabled:opacity-40"
          />
        </label>
        <label className="flex items-center gap-2 text-[11px] text-slate-400">
          <span className="w-10 shrink-0">字距</span>
          <input
            type="number"
            value={n.letterSpacing}
            disabled={disabled}
            onChange={(e) => onChange({ letterSpacing: Number(e.target.value) || 0 })}
            className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200 disabled:opacity-40"
          />
        </label>
      </div>

      <label className="flex items-center gap-2 text-[11px] text-slate-400">
        <input
          type="checkbox"
          checked={n.wordWrap}
          disabled={disabled}
          onChange={(e) => onChange({ wordWrap: e.target.checked })}
        />
        自动换行
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex items-center gap-2 text-[11px] text-slate-400">
          <span className="w-10 shrink-0">描边</span>
          <input
            type="number"
            min={0}
            value={n.strokeWidth}
            disabled={disabled}
            onChange={(e) =>
              onChange({ strokeWidth: Math.max(0, Number(e.target.value) || 0) })
            }
            className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200 disabled:opacity-40"
          />
        </label>
        <label className="flex items-center gap-2 text-[11px] text-slate-400">
          <span className="w-10 shrink-0">描边色</span>
          <input
            type="color"
            value={normalizeHex(n.strokeColor)}
            disabled={disabled || n.strokeWidth <= 0}
            onChange={(e) => onChange({ strokeColor: e.target.value })}
            className="h-7 w-full cursor-pointer rounded border border-slate-700 bg-slate-950 disabled:opacity-40"
          />
        </label>
      </div>
    </div>
  );
}

function normalizeHex(color: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color;
  if (/^#[0-9a-fA-F]{3}$/.test(color)) {
    const r = color[1];
    const g = color[2];
    const b = color[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return '#ffffff';
}
