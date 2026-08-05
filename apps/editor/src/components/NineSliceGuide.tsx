import { useCallback, useEffect, useRef, useState } from 'react';

type Edge = 'top' | 'right' | 'bottom' | 'left';

interface NineSliceGuideProps {
  dataUrl: string;
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
  onChange: (next: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  }) => void;
}

const LINE = '#22c55e';
const HIT = 10;

/**
 * Visual 9-slice editor: green dashed guides, drag to set insets.
 */
export function NineSliceGuide({
  dataUrl,
  width,
  height,
  top,
  right,
  bottom,
  left,
  onChange,
}: NineSliceGuideProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    edge: Edge;
    startX: number;
    startY: number;
    origin: { top: number; right: number; bottom: number; left: number };
  } | null>(null);
  const [displaySize, setDisplaySize] = useState({ w: width, h: height });

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const update = () => {
      const maxW = el.clientWidth || 480;
      const maxH = Math.min(420, Math.max(220, el.clientHeight || 320));
      const scale = Math.min(maxW / width, maxH / height, 2);
      setDisplaySize({
        w: Math.max(1, Math.round(width * scale)),
        h: Math.max(1, Math.round(height * scale)),
      });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width, height]);

  const scaleX = displaySize.w / width;
  const scaleY = displaySize.h / height;

  const clampInsets = useCallback(
    (next: { top: number; right: number; bottom: number; left: number }) => {
      let t = Math.round(Math.max(0, next.top));
      let r = Math.round(Math.max(0, next.right));
      let b = Math.round(Math.max(0, next.bottom));
      let l = Math.round(Math.max(0, next.left));
      // Keep a stretchable center (at least 1px) when possible
      if (t + b >= height) {
        if (t >= height) t = height - 1;
        b = Math.max(0, height - t - 1);
      }
      if (l + r >= width) {
        if (l >= width) l = width - 1;
        r = Math.max(0, width - l - 1);
      }
      return { top: t, right: r, bottom: b, left: l };
    },
    [width, height]
  );

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const drag = dragRef.current;
      const box = boxRef.current?.querySelector('[data-nine-stage]') as HTMLElement | null;
      if (!drag || !box) return;
      const rect = box.getBoundingClientRect();
      const localX = (e.clientX - rect.left) / scaleX;
      const localY = (e.clientY - rect.top) / scaleY;

      const next = { ...drag.origin };
      switch (drag.edge) {
        case 'top':
          next.top = Math.min(localY, height - next.bottom - 1);
          break;
        case 'bottom':
          next.bottom = Math.min(height - localY, height - next.top - 1);
          break;
        case 'left':
          next.left = Math.min(localX, width - next.right - 1);
          break;
        case 'right':
          next.right = Math.min(width - localX, width - next.left - 1);
          break;
      }
      onChange(clampInsets(next));
    },
    [clampInsets, height, onChange, scaleX, scaleY, width]
  );

  const endDrag = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', endDrag);
  }, [onPointerMove]);

  const startDrag = (edge: Edge, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      edge,
      startX: e.clientX,
      startY: e.clientY,
      origin: { top, right, bottom, left },
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endDrag);
  };

  useEffect(() => () => endDrag(), [endDrag]);

  const topPx = top * scaleY;
  const bottomPx = bottom * scaleY;
  const leftPx = left * scaleX;
  const rightPx = right * scaleX;

  return (
    <div ref={boxRef} className="w-full">
      <div className="mb-2 text-[10px] text-slate-500">
        拖动绿色虚线设置九宫边距（也可在下方改数字）
      </div>
      <div className="flex justify-center rounded bg-[repeating-conic-gradient(#1e293b_0%_25%,#0f172a_0%_50%)_0_0/12px_12px] p-3">
        <div
          data-nine-stage
          className="relative select-none"
          style={{ width: displaySize.w, height: displaySize.h }}
        >
          <img
            src={dataUrl}
            alt=""
            draggable={false}
            className="pointer-events-none absolute inset-0 h-full w-full object-fill"
          />

          {/* Soft tint on fixed corners / edges for readability */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: `
                linear-gradient(to bottom, rgba(34,197,94,0.12) 0, rgba(34,197,94,0.12) ${topPx}px, transparent ${topPx}px),
                linear-gradient(to top, rgba(34,197,94,0.12) 0, rgba(34,197,94,0.12) ${bottomPx}px, transparent ${bottomPx}px),
                linear-gradient(to right, rgba(34,197,94,0.12) 0, rgba(34,197,94,0.12) ${leftPx}px, transparent ${leftPx}px),
                linear-gradient(to left, rgba(34,197,94,0.12) 0, rgba(34,197,94,0.12) ${rightPx}px, transparent ${rightPx}px)
              `,
            }}
          />

          {/* Top guide */}
          <GuideLine
            orientation="h"
            offset={topPx}
            label={String(top)}
            onPointerDown={(e) => startDrag('top', e)}
          />
          {/* Bottom guide */}
          <GuideLine
            orientation="h"
            offset={displaySize.h - bottomPx}
            label={String(bottom)}
            labelSide="below"
            onPointerDown={(e) => startDrag('bottom', e)}
          />
          {/* Left guide */}
          <GuideLine
            orientation="v"
            offset={leftPx}
            label={String(left)}
            onPointerDown={(e) => startDrag('left', e)}
          />
          {/* Right guide */}
          <GuideLine
            orientation="v"
            offset={displaySize.w - rightPx}
            label={String(right)}
            labelSide="right"
            onPointerDown={(e) => startDrag('right', e)}
          />

          {/* Intersection dots */}
          <Dot x={leftPx} y={topPx} />
          <Dot x={displaySize.w - rightPx} y={topPx} />
          <Dot x={leftPx} y={displaySize.h - bottomPx} />
          <Dot x={displaySize.w - rightPx} y={displaySize.h - bottomPx} />
        </div>
      </div>
    </div>
  );
}

function GuideLine({
  orientation,
  offset,
  label,
  labelSide,
  onPointerDown,
}: {
  orientation: 'h' | 'v';
  offset: number;
  label: string;
  labelSide?: 'below' | 'right';
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  const isH = orientation === 'h';
  return (
    <div
      className="absolute z-10"
      style={
        isH
          ? {
              left: 0,
              right: 0,
              top: offset,
              height: HIT,
              marginTop: -HIT / 2,
              cursor: 'ns-resize',
            }
          : {
              top: 0,
              bottom: 0,
              left: offset,
              width: HIT,
              marginLeft: -HIT / 2,
              cursor: 'ew-resize',
            }
      }
      onPointerDown={onPointerDown}
    >
      <div
        className="pointer-events-none absolute"
        style={
          isH
            ? {
                left: 0,
                right: 0,
                top: HIT / 2 - 0.5,
                borderTop: `2px dashed ${LINE}`,
              }
            : {
                top: 0,
                bottom: 0,
                left: HIT / 2 - 0.5,
                borderLeft: `2px dashed ${LINE}`,
              }
        }
      />
      <span
        className="pointer-events-none absolute rounded bg-emerald-500 px-1 text-[9px] font-bold leading-tight text-white"
        style={
          isH
            ? {
                left: '50%',
                transform: 'translateX(-50%)',
                ...(labelSide === 'below'
                  ? { top: HIT / 2 + 2 }
                  : { bottom: HIT / 2 + 2 }),
              }
            : {
                top: '50%',
                transform: 'translateY(-50%)',
                ...(labelSide === 'right'
                  ? { left: HIT / 2 + 4 }
                  : { right: HIT / 2 + 4 }),
              }
        }
      >
        {label}
      </span>
    </div>
  );
}

function Dot({ x, y }: { x: number; y: number }) {
  return (
    <div
      className="pointer-events-none absolute z-20 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-emerald-400"
      style={{ left: x, top: y }}
    />
  );
}
