import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

type ModalSize = 'md' | 'lg' | 'xl';

type ResizeEdge =
  | 'n'
  | 's'
  | 'e'
  | 'w'
  | 'ne'
  | 'nw'
  | 'se'
  | 'sw';

/** Full-viewport centered dialog (portaled to body). */
export function Modal({
  title,
  children,
  onClose,
  wide,
  size,
  footer,
  resizable,
  defaultWidth,
  defaultHeight,
  minWidth = 420,
  minHeight = 320,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  /** @deprecated use size="lg" */
  wide?: boolean;
  size?: ModalSize;
  footer?: React.ReactNode;
  /** Drag edges / corners to resize the dialog. */
  resizable?: boolean;
  defaultWidth?: number;
  defaultHeight?: number;
  minWidth?: number;
  minHeight?: number;
}) {
  const resolved: ModalSize = size ?? (wide ? 'lg' : 'md');
  const presetW =
    defaultWidth ??
    (resolved === 'xl' ? 960 : resolved === 'lg' ? 720 : 448);
  const presetH =
    defaultHeight ??
    (resolved === 'xl' ? 720 : resolved === 'lg' ? 640 : 520);

  const [box, setBox] = useState(() => ({
    w: Math.min(presetW, typeof window !== 'undefined' ? window.innerWidth - 32 : presetW),
    h: Math.min(presetH, typeof window !== 'undefined' ? window.innerHeight - 32 : presetH),
  }));

  const dragRef = useRef<{
    edge: ResizeEdge;
    startX: number;
    startY: number;
    startW: number;
    startH: number;
  } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const onResizeMove = useCallback(
    (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      let w = d.startW;
      let h = d.startH;
      if (d.edge.includes('e')) w = d.startW + dx;
      if (d.edge.includes('w')) w = d.startW - dx;
      if (d.edge.includes('s')) h = d.startH + dy;
      if (d.edge.includes('n')) h = d.startH - dy;
      const maxW = window.innerWidth - 24;
      const maxH = window.innerHeight - 24;
      setBox({
        w: Math.min(maxW, Math.max(minWidth, Math.round(w))),
        h: Math.min(maxH, Math.max(minHeight, Math.round(h))),
      });
    },
    [minHeight, minWidth]
  );

  const endResize = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener('pointermove', onResizeMove);
    window.removeEventListener('pointerup', endResize);
    window.removeEventListener('pointercancel', endResize);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, [onResizeMove]);

  const startResize = (edge: ResizeEdge, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      edge,
      startX: e.clientX,
      startY: e.clientY,
      startW: box.w,
      startH: box.h,
    };
    document.body.style.userSelect = 'none';
    document.body.style.cursor =
      edge === 'e' || edge === 'w'
        ? 'ew-resize'
        : edge === 'n' || edge === 's'
          ? 'ns-resize'
          : edge === 'ne' || edge === 'sw'
            ? 'nesw-resize'
            : 'nwse-resize';
    window.addEventListener('pointermove', onResizeMove);
    window.addEventListener('pointerup', endResize);
    window.addEventListener('pointercancel', endResize);
  };

  useEffect(() => () => endResize(), [endResize]);

  const widthClass = resizable
    ? ''
    : resolved === 'xl'
      ? 'max-w-6xl max-h-[min(92vh,900px)] w-full'
      : resolved === 'lg'
        ? 'max-w-3xl max-h-[min(90vh,820px)] w-full'
        : 'max-w-md max-h-[min(90vh,820px)] w-full';

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/65 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`relative flex flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl ${widthClass}`}
        style={
          resizable
            ? { width: box.w, height: box.h, maxWidth: '100%', maxHeight: '100%' }
            : undefined
        }
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
          <button
            type="button"
            title="关闭"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            <X size={16} />
          </button>
        </div>
        <div
          className={`min-h-0 flex-1 p-4 ${
            resizable ? 'flex flex-col overflow-hidden' : 'overflow-auto'
          }`}
        >
          {children}
        </div>
        {footer && (
          <div className="shrink-0 border-t border-slate-800 px-4 py-3">{footer}</div>
        )}

        {resizable && (
          <>
            <ResizeHandle edge="n" onPointerDown={(e) => startResize('n', e)} />
            <ResizeHandle edge="s" onPointerDown={(e) => startResize('s', e)} />
            <ResizeHandle edge="e" onPointerDown={(e) => startResize('e', e)} />
            <ResizeHandle edge="w" onPointerDown={(e) => startResize('w', e)} />
            <ResizeHandle edge="ne" onPointerDown={(e) => startResize('ne', e)} />
            <ResizeHandle edge="nw" onPointerDown={(e) => startResize('nw', e)} />
            <ResizeHandle edge="se" onPointerDown={(e) => startResize('se', e)} />
            <ResizeHandle edge="sw" onPointerDown={(e) => startResize('sw', e)} />
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

function ResizeHandle({
  edge,
  onPointerDown,
}: {
  edge: ResizeEdge;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  const base = 'absolute z-30 touch-none';
  const style: React.CSSProperties = {};
  let className = base;

  switch (edge) {
    case 'n':
      className += ' left-2 right-2 top-0 h-1.5 cursor-ns-resize';
      break;
    case 's':
      className += ' left-2 right-2 bottom-0 h-1.5 cursor-ns-resize';
      break;
    case 'e':
      className += ' top-2 bottom-2 right-0 w-1.5 cursor-ew-resize';
      break;
    case 'w':
      className += ' top-2 bottom-2 left-0 w-1.5 cursor-ew-resize';
      break;
    case 'ne':
      className += ' right-0 top-0 h-3 w-3 cursor-nesw-resize';
      break;
    case 'nw':
      className += ' left-0 top-0 h-3 w-3 cursor-nwse-resize';
      break;
    case 'se':
      className += ' bottom-0 right-0 h-3.5 w-3.5 cursor-nwse-resize';
      break;
    case 'sw':
      className += ' bottom-0 left-0 h-3 w-3 cursor-nesw-resize';
      break;
  }

  return (
    <div
      className={className}
      style={style}
      onPointerDown={onPointerDown}
      title="拖动调节窗口大小"
    />
  );
}
