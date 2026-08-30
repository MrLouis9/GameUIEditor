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
const HIT = 14;
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 8;

/**
 * Visual 9-slice editor: green dashed guides (drag), wheel zoom.
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
  const viewportRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    edge: Edge;
    origin: { top: number; right: number; bottom: number; left: number };
  } | null>(null);
  const scaleRef = useRef({ x: 1, y: 1 });
  const insetsRef = useRef({ top, right, bottom, left });
  const onChangeRef = useRef(onChange);

  const [fitScale, setFitScale] = useState(1);
  const [userZoom, setUserZoom] = useState(1);

  insetsRef.current = { top, right, bottom, left };
  onChangeRef.current = onChange;

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const update = () => {
      const pad = 24;
      const maxW = Math.max(80, el.clientWidth - pad);
      const maxH = Math.max(80, el.clientHeight - pad);
      const next = Math.min(maxW / width, maxH / height, 4);
      setFitScale(Number.isFinite(next) && next > 0 ? next : 1);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width, height]);

  const scale = fitScale * userZoom;
  const displayW = Math.max(1, Math.round(width * scale));
  const displayH = Math.max(1, Math.round(height * scale));
  scaleRef.current = { x: displayW / width, y: displayH / height };

  const clampInsets = useCallback(
    (next: { top: number; right: number; bottom: number; left: number }) => {
      let t = Math.round(Math.max(0, next.top));
      let r = Math.round(Math.max(0, next.right));
      let b = Math.round(Math.max(0, next.bottom));
      let l = Math.round(Math.max(0, next.left));
      if (t + b >= height) {
        if (t >= height) t = Math.max(0, height - 1);
        b = Math.max(0, height - t - 1);
      }
      if (l + r >= width) {
        if (l >= width) l = Math.max(0, width - 1);
        r = Math.max(0, width - l - 1);
      }
      return { top: t, right: r, bottom: b, left: l };
    },
    [width, height]
  );

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const drag = dragRef.current;
      const stage = stageRef.current;
      if (!drag || !stage) return;
      const rect = stage.getBoundingClientRect();
      const { x: sx, y: sy } = scaleRef.current;
      const localX = (e.clientX - rect.left) / sx;
      const localY = (e.clientY - rect.top) / sy;
      const next = { ...drag.origin };
      switch (drag.edge) {
        case 'top':
          next.top = Math.min(Math.max(0, localY), height - next.bottom - 1);
          break;
        case 'bottom':
          next.bottom = Math.min(
            Math.max(0, height - localY),
            height - next.top - 1
          );
          break;
        case 'left':
          next.left = Math.min(Math.max(0, localX), width - next.right - 1);
          break;
        case 'right':
          next.right = Math.min(
            Math.max(0, width - localX),
            width - next.left - 1
          );
          break;
      }
      onChangeRef.current(clampInsets(next));
    },
    [clampInsets, height, width]
  );

  const endDrag = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', endDrag);
    window.removeEventListener('pointercancel', endDrag);
  }, [onPointerMove]);

  const startDrag = (edge: Edge, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = {
      edge,
      origin: { ...insetsRef.current },
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
  };

  useEffect(() => () => endDrag(), [endDrag]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      setUserZoom((z) =>
        Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number((z * factor).toFixed(3))))
      );
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const topPx = top * scaleRef.current.y;
  const bottomPx = bottom * scaleRef.current.y;
  const leftPx = left * scaleRef.current.x;
  const rightPx = right * scaleRef.current.x;

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500">
        <span>拖动绿色虚线设置边距 · 滚轮缩放 · 上下为 0 时仅左右九宫（竖向整体缩放）</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded border border-slate-700 px-1.5 py-0.5 text-slate-400 hover:bg-slate-800"
            onClick={() => setUserZoom((z) => Math.max(ZOOM_MIN, z / 1.25))}
          >
            −
          </button>
          <button
            type="button"
            className="min-w-[3.5rem] rounded border border-slate-700 px-1.5 py-0.5 text-slate-300 hover:bg-slate-800"
            title="重置缩放"
            onClick={() => setUserZoom(1)}
          >
            {Math.round(userZoom * 100)}%
          </button>
          <button
            type="button"
            className="rounded border border-slate-700 px-1.5 py-0.5 text-slate-400 hover:bg-slate-800"
            onClick={() => setUserZoom((z) => Math.min(ZOOM_MAX, z * 1.25))}
          >
            +
          </button>
        </div>
      </div>
      <div
        ref={viewportRef}
        className="min-h-0 flex-1 overflow-auto rounded bg-[repeating-conic-gradient(#1e293b_0%_25%,#0f172a_0%_50%)_0_0/12px_12px]"
      >
        <div className="flex min-h-full min-w-full items-center justify-center p-3">
          <div
            ref={stageRef}
            data-nine-stage
            className="relative shrink-0 select-none"
            style={{ width: displayW, height: displayH }}
          >
            <img
              src={dataUrl}
              alt=""
              draggable={false}
              className="pointer-events-none absolute inset-0 h-full w-full object-fill"
            />

            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background: `
                linear-gradient(to bottom, rgba(34,197,94,0.14) 0, rgba(34,197,94,0.14) ${topPx}px, transparent ${topPx}px),
                linear-gradient(to top, rgba(34,197,94,0.14) 0, rgba(34,197,94,0.14) ${bottomPx}px, transparent ${bottomPx}px),
                linear-gradient(to right, rgba(34,197,94,0.14) 0, rgba(34,197,94,0.14) ${leftPx}px, transparent ${leftPx}px),
                linear-gradient(to left, rgba(34,197,94,0.14) 0, rgba(34,197,94,0.14) ${rightPx}px, transparent ${rightPx}px)
              `,
              }}
            />

            <GuideLine
              orientation="h"
              offset={topPx}
              label={`上 ${top}`}
              onPointerDown={(e) => startDrag('top', e)}
            />
            <GuideLine
              orientation="h"
              offset={displayH - bottomPx}
              label={`下 ${bottom}`}
              labelSide="below"
              onPointerDown={(e) => startDrag('bottom', e)}
            />
            <GuideLine
              orientation="v"
              offset={leftPx}
              label={`左 ${left}`}
              onPointerDown={(e) => startDrag('left', e)}
            />
            <GuideLine
              orientation="v"
              offset={displayW - rightPx}
              label={`右 ${right}`}
              labelSide="right"
              onPointerDown={(e) => startDrag('right', e)}
            />

            <Dot x={leftPx} y={topPx} />
            <Dot x={displayW - rightPx} y={topPx} />
            <Dot x={leftPx} y={displayH - bottomPx} />
            <Dot x={displayW - rightPx} y={displayH - bottomPx} />
          </div>
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
      className="absolute z-10 touch-none"
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
                top: HIT / 2 - 1,
                borderTop: `2px dashed ${LINE}`,
              }
            : {
                top: 0,
                bottom: 0,
                left: HIT / 2 - 1,
                borderLeft: `2px dashed ${LINE}`,
              }
        }
      />
      <span
        className="pointer-events-none absolute whitespace-nowrap rounded bg-emerald-500 px-1 text-[9px] font-bold leading-tight text-white shadow"
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
      className="pointer-events-none absolute z-20 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-emerald-400 shadow"
      style={{ left: x, top: y }}
    />
  );
}
