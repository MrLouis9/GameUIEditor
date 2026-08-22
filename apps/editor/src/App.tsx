import { useCallback, useEffect, useState } from 'react';
import { useEditorStore } from './store/editorStore';
import { Toolbar } from './components/Toolbar';
import { LayerPanel } from './components/LayerPanel';
import { PropertiesPanel } from './components/PropertiesPanel';
import { AssetDock } from './components/AssetDock';
import { PixiCanvas } from './canvas/PixiCanvas';
import { FeedbackHost } from './ui/feedback';
import { CollapsedRail } from './layout/CollapsedRail';
import { ResizeHandle } from './layout/ResizeHandle';
import {
  PANEL_COLLAPSE,
  PANEL_DEFAULTS,
  clampBottomHeight,
  clampLeftWidth,
  clampRightWidth,
  loadPanelLayout,
  savePanelLayout,
  type PanelLayoutState,
} from './layout/panelLayout';

/**
 * Layout:
 * [ Toolbar ]
 * [ Layers | Canvas | Properties ]
 * [     AssetDock (under left+canvas)  ]
 */
export default function App() {
  useHotkeys();
  const [layout, setLayout] = useState<PanelLayoutState>(() => loadPanelLayout());

  useEffect(() => {
    savePanelLayout(layout);
  }, [layout]);

  const resizeLeft = useCallback((dx: number) => {
    setLayout((prev) => {
      if (prev.leftCollapsed) return prev;
      const next = prev.leftWidth + dx;
      if (next < PANEL_COLLAPSE.left) {
        return { ...prev, leftCollapsed: true };
      }
      return { ...prev, leftWidth: clampLeftWidth(next) };
    });
  }, []);

  const resizeRight = useCallback((dx: number) => {
    setLayout((prev) => {
      if (prev.rightCollapsed) return prev;
      // Handle is on the left edge of the right panel: drag left (neg) → wider
      const next = prev.rightWidth - dx;
      if (next < PANEL_COLLAPSE.right) {
        return { ...prev, rightCollapsed: true };
      }
      return { ...prev, rightWidth: clampRightWidth(next) };
    });
  }, []);

  const resizeBottom = useCallback((dy: number) => {
    setLayout((prev) => {
      if (prev.bottomCollapsed) return prev;
      // Handle on top edge: drag up (neg) → taller
      const next = prev.bottomHeight - dy;
      if (next < PANEL_COLLAPSE.bottom) {
        return { ...prev, bottomCollapsed: true };
      }
      return { ...prev, bottomHeight: clampBottomHeight(next) };
    });
  }, []);

  return (
    <div className="flex h-full flex-col">
      <FeedbackHost />
      <Toolbar />
      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1">
            {layout.leftCollapsed ? (
              <CollapsedRail
                side="left"
                label="图层"
                onExpand={() =>
                  setLayout((p) => ({
                    ...p,
                    leftCollapsed: false,
                    leftWidth: Math.max(p.leftWidth, PANEL_DEFAULTS.leftWidth),
                  }))
                }
              />
            ) : (
              <div
                className="relative flex shrink-0 flex-col border-r border-slate-800"
                style={{ width: layout.leftWidth }}
              >
                <LayerPanel />
                <ResizeHandle
                  axis="x"
                  edge="right"
                  title="拖动调整图层宽度 · 过窄将收纳"
                  onDrag={resizeLeft}
                />
              </div>
            )}
            <main className="relative min-w-0 flex-1">
              <PixiCanvas />
              <div className="pointer-events-none absolute bottom-3 left-3 rounded bg-black/50 px-2 py-1 text-[11px] text-slate-400">
                图层 Ctrl 多选 / Shift 范围 · Ctrl 拖组不钻子节点 · 方向键平移 · Esc
                取消 · Space / 中键 平移
              </div>
            </main>
          </div>

          {layout.bottomCollapsed ? (
            <CollapsedRail
              side="bottom"
              label="资源库"
              onExpand={() =>
                setLayout((p) => ({
                  ...p,
                  bottomCollapsed: false,
                  bottomHeight: Math.max(
                    p.bottomHeight,
                    PANEL_DEFAULTS.bottomHeight
                  ),
                }))
              }
            />
          ) : (
            <div
              className="relative shrink-0 overflow-hidden"
              style={{ height: layout.bottomHeight }}
            >
              <ResizeHandle
                axis="y"
                edge="top"
                title="拖动调整资源库高度 · 过矮将收纳"
                onDrag={resizeBottom}
              />
              <AssetDock
                fillHeight
                onRequestCollapse={() =>
                  setLayout((p) => ({ ...p, bottomCollapsed: true }))
                }
              />
            </div>
          )}
        </div>

        {layout.rightCollapsed ? (
          <CollapsedRail
            side="right"
            label="属性"
            onExpand={() =>
              setLayout((p) => ({
                ...p,
                rightCollapsed: false,
                rightWidth: Math.max(p.rightWidth, PANEL_DEFAULTS.rightWidth),
              }))
            }
          />
        ) : (
          <div
            className="relative flex shrink-0 flex-col"
            style={{ width: layout.rightWidth }}
          >
            <ResizeHandle
              axis="x"
              edge="left"
              title="拖动调整属性宽度 · 过窄将收纳"
              onDrag={resizeRight}
            />
            <PropertiesPanel />
          </div>
        )}
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

      if (
        e.key === 'ArrowLeft' ||
        e.key === 'ArrowRight' ||
        e.key === 'ArrowUp' ||
        e.key === 'ArrowDown'
      ) {
        if (!store.selectedIds.length) return;
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx =
          e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy =
          e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        store.nudgeSelection(dx, dy);
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
