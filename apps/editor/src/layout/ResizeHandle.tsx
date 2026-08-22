import { useEffect, useRef } from 'react';

type Axis = 'x' | 'y';

type Props = {
  axis: Axis;
  /** Positive delta grows the panel being resized (caller interprets direction). */
  onDrag: (delta: number) => void;
  onDragEnd?: () => void;
  /** Visual side of the handle relative to the panel */
  edge: 'left' | 'right' | 'top' | 'bottom';
  title?: string;
};

/**
 * Thin drag strip between panels. Uses pointer capture for smooth resize.
 */
export function ResizeHandle({ axis, onDrag, onDragEnd, edge, title }: Props) {
  const startRef = useRef<number | null>(null);
  const activeRef = useRef(false);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!activeRef.current || startRef.current == null) return;
      const pos = axis === 'x' ? e.clientX : e.clientY;
      const delta = pos - startRef.current;
      startRef.current = pos;
      if (delta !== 0) onDrag(delta);
    };
    const onUp = () => {
      if (!activeRef.current) return;
      activeRef.current = false;
      startRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      onDragEnd?.();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [axis, onDrag, onDragEnd]);

  const cursor = axis === 'x' ? 'col-resize' : 'row-resize';
  const edgeClass =
    edge === 'right'
      ? 'right-0 top-0 h-full w-1.5 translate-x-1/2'
      : edge === 'left'
        ? 'left-0 top-0 h-full w-1.5 -translate-x-1/2'
        : edge === 'top'
          ? 'left-0 top-0 h-1.5 w-full -translate-y-1/2'
          : 'bottom-0 left-0 h-1.5 w-full translate-y-1/2';

  return (
    <div
      role="separator"
      aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'}
      title={title ?? '拖动调整大小'}
      className={`absolute z-20 ${edgeClass} cursor-${cursor === 'col-resize' ? 'col-resize' : 'row-resize'} bg-transparent hover:bg-sky-500/40 active:bg-sky-500/50`}
      style={{ cursor }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        activeRef.current = true;
        startRef.current = axis === 'x' ? e.clientX : e.clientY;
        document.body.style.cursor = cursor;
        document.body.style.userSelect = 'none';
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      }}
    />
  );
}
