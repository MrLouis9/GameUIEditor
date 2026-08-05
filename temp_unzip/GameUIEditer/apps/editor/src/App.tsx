import { useEffect } from 'react';
import { useEditorStore } from './store/editorStore';
import { Toolbar } from './components/Toolbar';
import { LayerPanel } from './components/LayerPanel';
import { PropertiesPanel } from './components/PropertiesPanel';
import { AssetDock } from './components/AssetDock';
import { PixiCanvas } from './canvas/PixiCanvas';
import { FeedbackHost } from './ui/feedback';

/**
 * Layout:
 * [ Toolbar ]
 * [ Layers | Canvas ] [ Properties (full height) ]
 * [     AssetDock   ]
 */
export default function App() {
  useHotkeys();

  return (
    <div className="flex h-full flex-col">
      <FeedbackHost />
      <Toolbar />
      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1">
            <div className="flex w-60 shrink-0 flex-col border-r border-slate-800">
              <LayerPanel />
            </div>
            <main className="relative min-w-0 flex-1">
              <PixiCanvas />
              <div className="pointer-events-none absolute bottom-3 left-3 rounded bg-black/50 px-2 py-1 text-[11px] text-slate-400">
                图层 Ctrl 多选 / Shift 范围 · 拖拽排序嵌套 · Esc 取消选中 · Space 平移
              </div>
            </main>
          </div>
          <AssetDock />
        </div>
        <PropertiesPanel />
      </div>
    </div>
  );
}

function useHotkeys() {
  useEffect(() => {
    let spaceHand = false;
    let toolBeforeSpace: 'select' | 'hand' | null = null;

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.tagName === 'SELECT'
      ) {
        return;
      }

      const store = useEditorStore.getState();
      const mod = e.ctrlKey || e.metaKey;

      if (e.key === 'Escape') {
        e.preventDefault();
        store.clearSelection();
        return;
      }

      if (e.code === 'Space' && !mod && !e.repeat) {
        e.preventDefault();
        if (!spaceHand) {
          spaceHand = true;
          toolBeforeSpace = store.tool;
          store.setTool('hand');
        }
        return;
      }

      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) store.redo();
        else store.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        store.redo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        store.copySelection();
        return;
      }
      if (mod && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        store.pasteClipboard();
        return;
      }
      if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        store.duplicateSelection();
        return;
      }
      if (mod && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        store.groupSelection();
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        store.deleteSelection();
        return;
      }
      if (e.key.toLowerCase() === 'v') store.setTool('select');
      if (e.key.toLowerCase() === 'h') store.setTool('hand');
      if (e.key.toLowerCase() === 'f') store.addFrame();
      if (e.key.toLowerCase() === 't' && !mod) store.addText();
      if (e.key.toLowerCase() === 'r' && !mod) store.addRect();
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && spaceHand) {
        spaceHand = false;
        const restore = toolBeforeSpace ?? 'select';
        toolBeforeSpace = null;
        useEditorStore.getState().setTool(restore);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);
}
