import { useCallback, useRef, type PointerEvent, type ReactNode } from 'react';

export type ScrubOptions = {
  value: number;
  step?: number;
  disabled?: boolean;
  min?: number;
  max?: number;
  /** Pixels of horizontal drag per one `step`. Default 3. */
  sensitivity?: number;
  onChange: (v: number) => void;
  /** Called when pointer is released after a scrub. */
  onCommit?: () => void;
};

function clamp(n: number, min?: number, max?: number): number {
  let v = n;
  if (min != null && Number.isFinite(min)) v = Math.max(min, v);
  if (max != null && Number.isFinite(max)) v = Math.min(max, v);
  return v;
}

function decimalsOf(step: number): number {
  const s = String(step);
  const i = s.indexOf('.');
  return i < 0 ? 0 : s.length - i - 1;
}

/**
 * Horizontal drag-to-scrub (Figma-style).
 * Shift = finer (0.1× step), Alt = coarser (10× step).
 */
export function useLabelScrub({
  value,
  step = 1,
  disabled,
  min,
  max,
  sensitivity = 3,
  onChange,
  onCommit,
}: ScrubOptions) {
  const drag = useRef<{
    pointerId: number;
    startX: number;
    startValue: number;
    moved: boolean;
  } | null>(null);

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      if (disabled || e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const el = e.currentTarget;
      el.setPointerCapture(e.pointerId);
      drag.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startValue: Number.isFinite(value) ? value : 0,
        moved: false,
      };
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
    },
    [disabled, value]
  );

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      const d = drag.current;
      if (!d || e.pointerId !== d.pointerId) return;
      const dx = e.clientX - d.startX;
      if (!d.moved && Math.abs(dx) < 2) return;
      d.moved = true;

      let unit = step;
      if (e.shiftKey) unit = step * 0.1;
      else if (e.altKey) unit = step * 10;

      const ticks = dx / Math.max(1, sensitivity);
      const precision = Math.max(decimalsOf(step), decimalsOf(unit), 4);
      const next = clamp(
        Number((d.startValue + ticks * unit).toFixed(precision)),
        min,
        max
      );
      onChange(next);
    },
    [step, sensitivity, min, max, onChange]
  );

  const endDrag = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      const d = drag.current;
      if (!d || e.pointerId !== d.pointerId) return;
      drag.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (d.moved) onCommit?.();
    },
    [onCommit]
  );

  return {
    scrubProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      style: {
        cursor: disabled ? undefined : ('ew-resize' as const),
        touchAction: 'none' as const,
      },
      title: disabled ? undefined : '按住左右拖动调节数值（Shift 精细 / Alt 粗调）',
    },
  };
}

/** Label that scrubs an associated numeric value when dragged horizontally. */
export function ScrubLabel({
  children,
  className = '',
  ...scrub
}: ScrubOptions & { children: ReactNode; className?: string }) {
  const { scrubProps } = useLabelScrub(scrub);
  return (
    <span
      {...scrubProps}
      className={`select-none ${disabledClass(scrub.disabled)} ${className}`}
    >
      {children}
    </span>
  );
}

function disabledClass(disabled?: boolean) {
  return disabled ? 'opacity-40' : 'hover:text-slate-300';
}
