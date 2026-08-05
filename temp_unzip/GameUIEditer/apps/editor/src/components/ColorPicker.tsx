import { useEffect, useMemo, useRef, useState } from 'react';
import { Pipette } from 'lucide-react';
import { ScrubLabel } from '../ui/NumberField';

const RECENT_KEY = 'gameui-recent-colors';
const MAX_RECENT = 16;

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return ['#4f6ef7', '#ffffff', '#000000', '#0b1100'];
    return JSON.parse(raw) as string[];
  } catch {
    return ['#4f6ef7', '#ffffff', '#000000'];
  }
}

function pushRecent(hex: string) {
  const list = [hex, ...loadRecent().filter((c) => c.toLowerCase() !== hex.toLowerCase())].slice(
    0,
    MAX_RECENT
  );
  localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  return list;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = normalizeHex(hex).slice(1);
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.min(255, Math.max(0, Math.round(n)));
  return `#${[clamp(r), clamp(g), clamp(b)]
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('')}`;
}

export function normalizeHex(color: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(color)) {
    return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`.toLowerCase();
  }
  return '#ffffff';
}

function rgbToHsv(r: number, g: number, b: number) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
}

function hsvToRgb(h: number, s: number, v: number) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (h < 60) [rp, gp, bp] = [c, x, 0];
  else if (h < 120) [rp, gp, bp] = [x, c, 0];
  else if (h < 180) [rp, gp, bp] = [0, c, x];
  else if (h < 240) [rp, gp, bp] = [0, x, c];
  else if (h < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];
  return {
    r: Math.round((rp + m) * 255),
    g: Math.round((gp + m) * 255),
    b: Math.round((bp + m) * 255),
  };
}

export function ColorPickerPopover({
  color,
  alpha,
  onChange,
  onClose,
}: {
  color: string;
  alpha: number;
  onChange: (hex: string, alpha: number) => void;
  onClose: () => void;
}) {
  const hex = normalizeHex(color);
  const rgb = hexToRgb(hex);
  const initial = useMemo(() => rgbToHsv(rgb.r, rgb.g, rgb.b), [hex]);
  const [h, setH] = useState(initial.h);
  const [s, setS] = useState(initial.s);
  const [v, setV] = useState(initial.v);
  const [a, setA] = useState(alpha);
  const [recent, setRecent] = useState(loadRecent);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
    setH(hsv.h);
    setS(hsv.s);
    setV(hsv.v);
  }, [hex]);

  useEffect(() => {
    setA(alpha);
  }, [alpha]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const commit = (nh: number, ns: number, nv: number, na: number) => {
    const next = hsvToRgb(nh, ns, nv);
    const nextHex = rgbToHex(next.r, next.g, next.b);
    onChange(nextHex, na);
  };

  const hueRgb = hsvToRgb(h, 1, 1);
  const hueColor = rgbToHex(hueRgb.r, hueRgb.g, hueRgb.b);

  return (
    <div
      ref={panelRef}
      className="absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border border-[#3a3a3a] bg-[#2a2a2a] p-3 shadow-2xl"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="mb-2 flex items-center gap-2 text-xs text-slate-300">
        <Pipette size={14} className="text-slate-400" />
        <span className="rounded bg-[#1e1e1e] px-2 py-1">纯色</span>
      </div>

      <div
        className="relative h-32 w-full cursor-crosshair rounded"
        style={{
          background: `
            linear-gradient(to top, #000, transparent),
            linear-gradient(to right, #fff, ${hueColor})
          `,
        }}
        onPointerDown={(e) => {
          const el = e.currentTarget;
          const move = (ev: PointerEvent) => {
            const rect = el.getBoundingClientRect();
            const ns = Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width));
            const nv = 1 - Math.min(1, Math.max(0, (ev.clientY - rect.top) / rect.height));
            setS(ns);
            setV(nv);
            commit(h, ns, nv, a);
          };
          move(e.nativeEvent);
          const up = () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
            const rgb = hsvToRgb(h, s, v);
            setRecent(pushRecent(rgbToHex(rgb.r, rgb.g, rgb.b)));
          };
          window.addEventListener('pointermove', move);
          window.addEventListener('pointerup', up);
        }}
      >
        <div
          className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
          style={{ left: `${s * 100}%`, top: `${(1 - v) * 100}%` }}
        />
      </div>

      <input
        type="range"
        min={0}
        max={360}
        value={h}
        onChange={(e) => {
          const nh = Number(e.target.value);
          setH(nh);
          commit(nh, s, v, a);
        }}
        className="mt-2 h-3 w-full cursor-pointer appearance-none rounded-full"
        style={{
          background:
            'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
        }}
      />

      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(a * 1000) / 10}
        onChange={(e) => {
          const na = Number(e.target.value) / 100;
          setA(na);
          commit(h, s, v, na);
        }}
        className="mt-2 h-3 w-full cursor-pointer appearance-none rounded-full"
        style={{
          background: `linear-gradient(to right, transparent, ${hex}),
            repeating-conic-gradient(#666 0% 25%, #999 0% 50%) 0 0 / 8px 8px`,
        }}
      />

      <div className="mt-2 grid grid-cols-4 gap-1.5 text-[11px] text-slate-400">
        {(['r', 'g', 'b'] as const).map((key) => (
          <label key={key} className="flex flex-col gap-0.5">
            <ScrubLabel
              className="uppercase text-slate-400"
              value={rgb[key]}
              step={1}
              min={0}
              max={255}
              onChange={(v) => {
                const next = { ...rgb, [key]: Math.round(Math.min(255, Math.max(0, v))) };
                const nextHex = rgbToHex(next.r, next.g, next.b);
                const hsv = rgbToHsv(next.r, next.g, next.b);
                setH(hsv.h);
                setS(hsv.s);
                setV(hsv.v);
                onChange(nextHex, a);
              }}
            >
              {key}
            </ScrubLabel>
            <input
              type="number"
              min={0}
              max={255}
              value={rgb[key]}
              onChange={(e) => {
                const next = { ...rgb, [key]: Number(e.target.value) || 0 };
                const nextHex = rgbToHex(next.r, next.g, next.b);
                const hsv = rgbToHsv(next.r, next.g, next.b);
                setH(hsv.h);
                setS(hsv.s);
                setV(hsv.v);
                onChange(nextHex, a);
              }}
              className="num-field rounded border-0 bg-[#1e1e1e] px-1.5 py-1 text-slate-200"
            />
          </label>
        ))}
        <label className="flex flex-col gap-0.5">
          <ScrubLabel
            className="text-slate-400"
            value={Number((a * 100).toFixed(1))}
            step={1}
            min={0}
            max={100}
            onChange={(v) => {
              const na = Math.min(1, Math.max(0, v / 100));
              setA(na);
              onChange(hex, na);
            }}
          >
            A
          </ScrubLabel>
          <input
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={Number((a * 100).toFixed(1))}
            onChange={(e) => {
              const na = Math.min(100, Math.max(0, Number(e.target.value) || 0)) / 100;
              setA(na);
              onChange(hex, na);
            }}
            className="num-field rounded border-0 bg-[#1e1e1e] px-1.5 py-1 text-slate-200"
          />
        </label>
      </div>

      <label className="mt-2 flex items-center gap-2 text-[11px] text-slate-400">
        <span>#</span>
        <input
          value={hex.slice(1)}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
            if (raw.length === 6) {
              const nextHex = `#${raw}`;
              const nextRgb = hexToRgb(nextHex);
              const hsv = rgbToHsv(nextRgb.r, nextRgb.g, nextRgb.b);
              setH(hsv.h);
              setS(hsv.s);
              setV(hsv.v);
              onChange(nextHex, a);
              setRecent(pushRecent(nextHex));
            }
          }}
          className="w-full rounded border-0 bg-[#1e1e1e] px-2 py-1 font-mono text-slate-200"
        />
      </label>

      <div className="mt-3">
        <div className="mb-1.5 text-[10px] uppercase tracking-wide text-slate-500">
          最近使用的颜色
        </div>
        <div className="grid grid-cols-8 gap-1">
          {recent.map((c) => (
            <button
              key={c}
              type="button"
              title={c}
              className="h-5 w-5 rounded border border-black/40"
              style={{ background: c }}
              onClick={() => {
                const nextRgb = hexToRgb(c);
                const hsv = rgbToHsv(nextRgb.r, nextRgb.g, nextRgb.b);
                setH(hsv.h);
                setS(hsv.s);
                setV(hsv.v);
                onChange(c, a);
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
