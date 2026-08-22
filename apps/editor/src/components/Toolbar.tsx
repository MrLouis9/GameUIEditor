import { useState } from 'react';
import {
  AlignHorizontalDistributeCenter,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyStart,
  AlignVerticalDistributeCenter,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  ClipboardPaste,
  Copy,
  CopyPlus,
  Eye,
  EyeOff,
  FilePlus,
  FolderOpen,
  Frame,
  Group,
  Hand,
  Lock,
  MousePointer2,
  Package,
  Redo2,
  Save,
  Square,
  Trash2,
  Type,
  Undo2,
  Unlock,
} from 'lucide-react';
import { AlignMode, DESIGN_PRESETS } from '@game-ui/document';
import { useEditorStore } from '../store/editorStore';
import { AiHandoffModal } from './AiHandoffModal';
import { confirmDialog, toast } from '../ui/feedback';

export function Toolbar() {
  const tool = useEditorStore((s) => s.tool);
  const setTool = useEditorStore((s) => s.setTool);
  const canUndo = useEditorStore((s) => s.canUndo);
  const canRedo = useEditorStore((s) => s.canRedo);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const addFrame = useEditorStore((s) => s.addFrame);
  const addRect = useEditorStore((s) => s.addRect);
  const addText = useEditorStore((s) => s.addText);
  const deleteSelection = useEditorStore((s) => s.deleteSelection);
  const groupSelection = useEditorStore((s) => s.groupSelection);
  const duplicateSelection = useEditorStore((s) => s.duplicateSelection);
  const copySelection = useEditorStore((s) => s.copySelection);
  const pasteClipboard = useEditorStore((s) => s.pasteClipboard);
  const setLocked = useEditorStore((s) => s.setLocked);
  const setVisible = useEditorStore((s) => s.setVisible);
  const newDocument = useEditorStore((s) => s.newDocument);
  const exportJson = useEditorStore((s) => s.exportJson);
  const importJsonFile = useEditorStore((s) => s.importJsonFile);
  const setDesignPreset = useEditorStore((s) => s.setDesignPreset);
  const designWidth = useEditorStore((s) => s.document.designSize.width);
  const designHeight = useEditorStore((s) => s.document.designSize.height);
  const alignSelection = useEditorStore((s) => s.alignSelection);
  const persist = useEditorStore((s) => s.persist);
  const camera = useEditorStore((s) => s.camera);
  const setCamera = useEditorStore((s) => s.setCamera);

  const [handoffOpen, setHandoffOpen] = useState(false);

  const presetId =
    DESIGN_PRESETS.find(
      (p) => p.width === designWidth && p.height === designHeight
    )?.id ?? 'custom';

  const align = (mode: AlignMode) => () => alignSelection(mode);


  const onSaveProject = () => {
    exportJson();
    persist();
    toast('项目已保存为 .gameui.json，可拷到其他机器用「打开项目」继续', 'success');
  };

  const onOpenProject = async (file: File) => {
    const ok = await confirmDialog({
      title: '打开项目 / Prefab',
      message: `打开「${file.name}」。完整项目会替换当前画布；若是界面 Prefab（kind=gameui.prefab）则合并进当前工程并替换当前页（图集像素需另导）。确定？`,
      confirmLabel: '打开',
      danger: true,
    });
    if (!ok) return;
    try {
      await importJsonFile(file);
      persist();
      toast(`已打开：${file.name}`, 'success');
    } catch (err) {
      toast(
        `打开失败：${err instanceof Error ? err.message : '文件格式无效'}`,
        'error'
      );
    }
  };

  const onNewDocument = async () => {
    const ok = await confirmDialog({
      title: '新建文档',
      message: '当前画布会被清空（本地已自动保存的可刷新恢复）。确定新建？',
      confirmLabel: '新建',
      danger: true,
    });
    if (ok) newDocument();
  };

  return (
    <header className="flex h-12 shrink-0 items-center gap-1 border-b border-slate-800 bg-slate-900 px-3">
      {handoffOpen && (
        <AiHandoffModal onClose={() => setHandoffOpen(false)} />
      )}

      <div className="mr-2 text-sm font-semibold tracking-wide text-sky-300">
        GameUIEditer
      </div>

      <IconBtn title="选择 (V)" active={tool === 'select'} onClick={() => setTool('select')}>
        <MousePointer2 size={16} />
      </IconBtn>
      <IconBtn title="平移 (H / 按住 Space)" active={tool === 'hand'} onClick={() => setTool('hand')}>
        <Hand size={16} />
      </IconBtn>

      <Sep />

      <IconBtn title="撤销 Ctrl+Z" disabled={!canUndo} onClick={undo}>
        <Undo2 size={16} />
      </IconBtn>
      <IconBtn title="重做 Ctrl+Y / Ctrl+Shift+Z" disabled={!canRedo} onClick={redo}>
        <Redo2 size={16} />
      </IconBtn>

      <Sep />

      <IconBtn title="Frame (F)" onClick={addFrame}>
        <Frame size={16} />
      </IconBtn>
      <IconBtn title="矩形 (R)" onClick={addRect}>
        <Square size={16} />
      </IconBtn>
      <IconBtn title="文本 (T)" onClick={addText}>
        <Type size={16} />
      </IconBtn>
      <IconBtn title="打组 Ctrl+G" onClick={groupSelection}>
        <Group size={16} />
      </IconBtn>
      <IconBtn title="复制 Ctrl+C" onClick={copySelection}>
        <Copy size={16} />
      </IconBtn>
      <IconBtn title="粘贴 Ctrl+V" onClick={pasteClipboard}>
        <ClipboardPaste size={16} />
      </IconBtn>
      <IconBtn title="再制 Ctrl+D" onClick={duplicateSelection}>
        <CopyPlus size={16} />
      </IconBtn>
      <IconBtn title="删除" onClick={deleteSelection}>
        <Trash2 size={16} />
      </IconBtn>
      <IconBtn title="锁定" onClick={() => setLocked(true)}>
        <Lock size={16} />
      </IconBtn>
      <IconBtn title="解锁" onClick={() => setLocked(false)}>
        <Unlock size={16} />
      </IconBtn>
      <IconBtn title="隐藏" onClick={() => setVisible(false)}>
        <EyeOff size={16} />
      </IconBtn>
      <IconBtn title="显示" onClick={() => setVisible(true)}>
        <Eye size={16} />
      </IconBtn>

      <Sep />

      <IconBtn title="左对齐" onClick={align('left')}>
        <AlignHorizontalJustifyStart size={16} />
      </IconBtn>
      <IconBtn title="水平居中" onClick={align('center-h')}>
        <AlignHorizontalJustifyCenter size={16} />
      </IconBtn>
      <IconBtn title="右对齐" onClick={align('right')}>
        <AlignHorizontalJustifyEnd size={16} />
      </IconBtn>
      <IconBtn title="顶对齐" onClick={align('top')}>
        <AlignVerticalJustifyStart size={16} />
      </IconBtn>
      <IconBtn title="垂直居中" onClick={align('center-v')}>
        <AlignVerticalJustifyCenter size={16} />
      </IconBtn>
      <IconBtn title="底对齐" onClick={align('bottom')}>
        <AlignVerticalJustifyEnd size={16} />
      </IconBtn>
      <IconBtn title="水平分布 (需≥3)" onClick={align('distribute-h')}>
        <AlignHorizontalDistributeCenter size={16} />
      </IconBtn>
      <IconBtn title="垂直分布 (需≥3)" onClick={align('distribute-v')}>
        <AlignVerticalDistributeCenter size={16} />
      </IconBtn>

      <Sep />

      <select
        className="h-8 rounded border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200"
        value={presetId}
        onChange={(e) => setDesignPreset(e.target.value)}
      >
        {DESIGN_PRESETS.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
        {presetId === 'custom' && (
          <option value="custom">
            自定义 {designWidth}×{designHeight}
          </option>
        )}
      </select>

      <button
        type="button"
        title="缩放百分比（滚轮缩放画布）"
        className="ml-1 h-8 min-w-[52px] rounded border border-slate-700 bg-slate-950 px-2 text-[11px] text-slate-300 hover:bg-slate-800"
        onClick={() => setCamera({ zoom: 1, x: 40, y: 40 })}
      >
        {Math.round(camera.zoom * 100)}%
      </button>

      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          title="保存完整项目（含切图）为 .gameui.json，可带到其他机器继续编辑"
          onClick={onSaveProject}
          className="inline-flex h-8 items-center gap-1.5 rounded border border-slate-600 bg-slate-800 px-2.5 text-[11px] font-medium text-slate-100 hover:bg-slate-700"
        >
          <Save size={14} />
          保存项目
        </button>
        <label
          title="打开 .gameui.json 项目文件，继续编辑"
          className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded border border-slate-600 bg-slate-800 px-2.5 text-[11px] font-medium text-slate-100 hover:bg-slate-700"
        >
          <FolderOpen size={14} />
          打开项目
          <input
            type="file"
            accept=".gameui.json,.json,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onOpenProject(f);
              e.target.value = '';
            }}
          />
        </label>
        <button
          type="button"
          onClick={() => {
            persist();
            setHandoffOpen(true);
          }}
          className="inline-flex h-8 items-center gap-1.5 rounded border border-sky-700/60 bg-sky-950/40 px-2.5 text-[11px] font-medium text-sky-300 hover:bg-sky-900/50"
        >
          <Package size={14} />
          AI 交接
        </button>
        <IconBtn title="新建文档" onClick={() => void onNewDocument()}>
          <FilePlus size={16} />
        </IconBtn>
      </div>
    </header>
  );
}

function Sep() {
  return <div className="mx-1 h-5 w-px bg-slate-700" />;
}

function IconBtn({
  children,
  onClick,
  title,
  active,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-8 w-8 items-center justify-center rounded border border-transparent text-slate-300 hover:bg-slate-800 disabled:opacity-30 ${
        active ? 'bg-slate-800 text-sky-300 border-slate-600' : ''
      }`}
    >
      {children}
    </button>
  );
}
