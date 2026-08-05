import {
  Download,
  FileJson,
  Image as ImageIcon,
  RefreshCw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  DEFAULT_PACK_SETTINGS,
  PackedSheet,
  PackSettings,
  SpriteItem,
  drawPackedSheet,
  generateAtlasCSS,
  generateAtlasJSON,
  loadImage,
  packSprites,
} from '@game-ui/atlas';
import type { Asset } from '@game-ui/document';
import { Modal } from './Modal';
import { ScrubLabel } from '../ui/NumberField';

const PACK_SETTINGS_PREFIX = 'gameui-pack-settings:';

function loadPackSettings(atlasId: string): PackSettings {
  try {
    const raw = localStorage.getItem(PACK_SETTINGS_PREFIX + atlasId);
    if (!raw) return { ...DEFAULT_PACK_SETTINGS };
    return { ...DEFAULT_PACK_SETTINGS, ...(JSON.parse(raw) as Partial<PackSettings>) };
  } catch {
    return { ...DEFAULT_PACK_SETTINGS };
  }
}

function savePackSettings(atlasId: string, settings: PackSettings) {
  localStorage.setItem(PACK_SETTINGS_PREFIX + atlasId, JSON.stringify(settings));
}

export function AtlasPackModal({
  atlasId,
  assets,
  atlasName,
  onClose,
}: {
  atlasId: string;
  assets: Asset[];
  atlasName: string;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<PackSettings>(() => loadPackSettings(atlasId));
  const [applied, setApplied] = useState<PackSettings>(() => loadPackSettings(atlasId));
  const [sheet, setSheet] = useState<PackedSheet | null>(null);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showBorder, setShowBorder] = useState(true);
  const [zoom, setZoom] = useState(0.25);
  const [dirty, setDirty] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const packGen = useRef(0);
  const debounceRef = useRef<number>(0);
  const assetsKey = assets.map((a) => `${a.id}:${a.width}x${a.height}`).join(',');

  const pack = async (settings: PackSettings, fitZoom = false) => {
    if (!assets.length) {
      setSheet(null);
      setExportUrl(null);
      return;
    }
    const gen = ++packGen.current;
    setBusy(true);
    try {
      const sprites: SpriteItem[] = [];
      for (const asset of assets) {
        const img = await loadImage(asset.dataUrl);
        const nw = img.naturalWidth || img.width || asset.width;
        const nh = img.naturalHeight || img.height || asset.height;
        sprites.push({
          id: asset.id,
          name: asset.name,
          width: nw,
          height: nh,
          originalWidth: nw,
          originalHeight: nh,
          trimmed: false,
          trimOffset: { x: 0, y: 0 },
          dataUrl: asset.dataUrl,
          imgElement: img,
          nineSlice: asset.nineSlice,
        });
      }
      const result = packSprites(sprites, settings);
      if (gen !== packGen.current) return;
      setSheet(result);
      setExportUrl(
        drawPackedSheet(result, 'transparent', settings.scale, {
          showBorder: false,
        }).toDataURL('image/png')
      );
      if (fitZoom) {
        const vw = viewportRef.current?.clientWidth ?? 640;
        const vh = viewportRef.current?.clientHeight ?? 480;
        const z = Math.min(
          1,
          (vw - 32) / settings.maxWidth,
          (vh - 32) / settings.maxHeight
        );
        setZoom(Math.max(0.05, Number(z.toFixed(3))));
      }
    } finally {
      if (gen === packGen.current) setBusy(false);
    }
  };

  const applyAndPack = (fitZoom = false) => {
    const next = { ...draft };
    setApplied(next);
    savePackSettings(atlasId, next);
    setDirty(false);
    void pack(next, fitZoom);
  };

  useEffect(() => {
    const saved = loadPackSettings(atlasId);
    setDraft(saved);
    setApplied(saved);
    setDirty(false);
    void pack(saved, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atlasId]);

  useEffect(() => {
    void pack(applied, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetsKey]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      setZoom((z) => Math.min(4, Math.max(0.05, Number((z * factor).toFixed(3)))));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const patch = <K extends keyof PackSettings>(key: K, value: PackSettings[K]) => {
    setDraft((s) => {
      const next = { ...s, [key]: value };
      window.clearTimeout(debounceRef.current);
      setDirty(true);
      debounceRef.current = window.setTimeout(() => {
        setApplied(next);
        savePackSettings(atlasId, next);
        setDirty(false);
        void pack(next, false);
      }, 450);
      return next;
    });
  };

  useEffect(() => {
    return () => window.clearTimeout(debounceRef.current);
  }, []);

  const fileBase = atlasName.replace(/[\\/:*?"<>|]/g, '_');

  const downloadPng = () => {
    if (!sheet) return;
    const url = drawPackedSheet(sheet, 'transparent', applied.scale).toDataURL(
      'image/png'
    );
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `${fileBase}.png`;
    a.click();
  };

  const downloadData = () => {
    if (!sheet) return;
    let content: string;
    let ext: string;
    if (applied.format === 'css') {
      content = generateAtlasCSS(sheet, `${fileBase}.png`, applied.scale);
      ext = 'css';
    } else {
      const canvas = drawPackedSheet(sheet, 'transparent', applied.scale);
      content = generateAtlasJSON(
        sheet,
        `${fileBase}.png`,
        applied.format,
        applied.scale
      );
      // Keep JSON meta.size locked to the PNG we would download
      try {
        const parsed = JSON.parse(content) as {
          meta: Record<string, unknown>;
        };
        parsed.meta = {
          ...parsed.meta,
          image: `${fileBase}.png`,
          size: { w: canvas.width, h: canvas.height },
        };
        content = JSON.stringify(parsed, null, 2);
      } catch {
        /* keep */
      }
      ext = 'json';
    }
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `${fileBase}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const bgW = applied.maxWidth * zoom;
  const bgH = applied.maxHeight * zoom;
  const effW = (sheet?.width ?? 0) * zoom;
  const effH = (sheet?.height ?? 0) * zoom;

  return (
    <Modal
      title={`图集拼合 · ${atlasName}`}
      onClose={onClose}
      size="xl"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-3 text-slate-400">
            <div className="flex items-center gap-1">
              <button
                type="button"
                title="缩小"
                className="rounded p-1.5 hover:bg-slate-800 hover:text-slate-200"
                onClick={() =>
                  setZoom((z) => Math.max(0.05, Number((z / 1.25).toFixed(3))))
                }
              >
                <ZoomOut size={14} />
              </button>
              <button
                type="button"
                className="min-w-[52px] rounded px-2 py-1 hover:bg-slate-800 hover:text-slate-200"
                title="适应窗口"
                onClick={() => {
                  const vw = viewportRef.current?.clientWidth ?? 640;
                  const vh = viewportRef.current?.clientHeight ?? 480;
                  const z = Math.min(
                    1,
                    (vw - 32) / applied.maxWidth,
                    (vh - 32) / applied.maxHeight
                  );
                  setZoom(Math.max(0.05, Number(z.toFixed(3))));
                }}
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                title="放大"
                className="rounded p-1.5 hover:bg-slate-800 hover:text-slate-200"
                onClick={() =>
                  setZoom((z) => Math.min(4, Number((z * 1.25).toFixed(3))))
                }
              >
                <ZoomIn size={14} />
              </button>
            </div>
            {sheet && (
              <span className="tabular-nums text-slate-300">
                有效层 {sheet.width}×{sheet.height}px
                <span className="mx-2 text-slate-600">·</span>
                利用率 {sheet.efficiency.toFixed(1)}%
                <span className="mx-2 text-slate-600">·</span>
                {sheet.packedItems.length} / {assets.length}
                {sheet.unfittedItems.length > 0 && (
                  <span className="ml-2 text-amber-400">
                    未装入 {sheet.unfittedItems.length}
                  </span>
                )}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!sheet}
              className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-3 py-1.5 text-slate-200 disabled:opacity-40"
              onClick={downloadPng}
            >
              <ImageIcon size={14} />
              PNG
            </button>
            <button
              type="button"
              disabled={!sheet}
              className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-3 py-1.5 text-slate-200 disabled:opacity-40"
              onClick={downloadData}
            >
              <FileJson size={14} />
              数据
            </button>
            <button
              type="button"
              disabled={!sheet}
              className="inline-flex items-center gap-1 rounded-md bg-sky-600 px-3 py-1.5 text-white disabled:opacity-40"
              onClick={() => {
                downloadPng();
                downloadData();
              }}
            >
              <Download size={14} />
              全部下载
            </button>
          </div>
        </div>
      }
    >
      <div className="flex h-[min(70vh,640px)] gap-4 text-xs text-slate-400">
        <div className="flex w-56 shrink-0 flex-col gap-2 overflow-y-auto pr-1">
          <label className="flex flex-col gap-1">
            排版算法
            <select
              className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-200"
              value={draft.algorithm}
              onChange={(e) =>
                patch('algorithm', e.target.value as PackSettings['algorithm'])
              }
            >
              <option value="growing-binpacker">自适应二叉树（紧凑）</option>
              <option value="shelf">货架行算法</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            图片排序
            <select
              className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-200"
              value={draft.sortMethod}
              onChange={(e) =>
                patch('sortMethod', e.target.value as PackSettings['sortMethod'])
              }
            >
              <option value="area-desc">按面积：大→小</option>
              <option value="max-side-desc">按最长边：大→小</option>
              <option value="height-desc">按高度：大→小</option>
              <option value="width-desc">按宽度：大→小</option>
              <option value="name-asc">按名称</option>
            </select>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              最大宽
              <select
                className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-200"
                value={draft.maxWidth}
                onChange={(e) => patch('maxWidth', Number(e.target.value))}
              >
                {[256, 512, 1024, 2048, 4096].map((n) => (
                  <option key={n} value={n}>
                    {n} px
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              最大高
              <select
                className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-200"
                value={draft.maxHeight}
                onChange={(e) => patch('maxHeight', Number(e.target.value))}
              >
                {[256, 512, 1024, 2048, 4096].map((n) => (
                  <option key={n} value={n}>
                    {n} px
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex items-center gap-2 text-slate-300">
            <input
              type="checkbox"
              checked={draft.forcePowerOfTwo}
              onChange={(e) => patch('forcePowerOfTwo', e.target.checked)}
            />
            强制 2 的幂 (POT)
          </label>
          <label className="flex items-center gap-2 text-slate-300">
            <input
              type="checkbox"
              checked={draft.forceSquare}
              onChange={(e) => patch('forceSquare', e.target.checked)}
            />
            强制正方形
          </label>
          <label className="flex items-center gap-2 text-slate-300">
            <input
              type="checkbox"
              checked={draft.trim}
              onChange={(e) => patch('trim', e.target.checked)}
            />
            自动裁剪透明边
          </label>

          <label className="flex flex-col gap-1">
            <ScrubLabel
              className="text-slate-400"
              value={draft.spacing}
              step={1}
              min={0}
              onChange={(v) => patch('spacing', Math.max(0, Math.round(v)))}
            >
              间距 Spacing
            </ScrubLabel>
            <input
              type="number"
              min={0}
              className="num-field rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-200"
              value={draft.spacing}
              onChange={(e) =>
                patch('spacing', Math.max(0, Number(e.target.value) || 0))
              }
            />
          </label>
          <label className="flex flex-col gap-1">
            <ScrubLabel
              className="text-slate-400"
              value={draft.padding}
              step={1}
              min={0}
              onChange={(v) => patch('padding', Math.max(0, Math.round(v)))}
            >
              边距 Padding
            </ScrubLabel>
            <input
              type="number"
              min={0}
              className="num-field rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-200"
              value={draft.padding}
              onChange={(e) =>
                patch('padding', Math.max(0, Number(e.target.value) || 0))
              }
            />
          </label>

          <label className="flex flex-col gap-1">
            导出格式
            <select
              className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-200"
              value={draft.format}
              onChange={(e) =>
                patch('format', e.target.value as PackSettings['format'])
              }
            >
              <option value="json-hash">JSON Hash</option>
              <option value="json-array">JSON Array</option>
              <option value="css">CSS</option>
            </select>
          </label>

          <label className="flex items-center gap-2 text-slate-300">
            <input
              type="checkbox"
              checked={showBorder}
              onChange={(e) => setShowBorder(e.target.checked)}
            />
            显示精灵边框
          </label>

          <button
            type="button"
            disabled={!assets.length || busy}
            onClick={() => applyAndPack(false)}
            className="mt-1 inline-flex items-center justify-center gap-1 rounded-md bg-sky-600 py-2 text-white hover:bg-sky-500 disabled:opacity-40"
          >
            <RefreshCw size={14} className={busy ? 'animate-spin' : ''} />
            {busy ? '拼合中…' : dirty ? '应用中…' : '重新拼合'}
          </button>
          {dirty && (
            <p className="text-[10px] text-slate-500">
              参数已改，约 0.5s 后自动拼合
            </p>
          )}

          <p className="mt-auto text-[10px] leading-relaxed text-slate-500">
            棋盘格 = 背景层（最大画布 {applied.maxWidth}×{applied.maxHeight}）
            <br />
            切图区域 = 图片有效层（透明底）
          </p>
        </div>

        <div
          ref={viewportRef}
          className="relative min-h-0 min-w-0 flex-1 overflow-auto rounded-lg border border-slate-800 bg-[#0f172a]"
          title="滚轮缩放"
        >
          {!assets.length ? (
            <p className="absolute inset-0 flex items-center justify-center text-slate-600">
              当前图集无资源，请先上传切图
            </p>
          ) : (
            <div className="inline-block p-4">
              <div
                className="relative border border-slate-600/40 shadow-inner"
                style={{
                  width: bgW,
                  height: bgH,
                  backgroundImage:
                    'repeating-conic-gradient(#2a2a2a 0% 25%, #1e1e1e 0% 50%)',
                  backgroundSize: `${Math.max(8, 16 * zoom)}px ${Math.max(8, 16 * zoom)}px`,
                }}
              >
                {/* Transparent effective layer — checkers show through */}
                {sheet && sheet.width > 0 && (
                  <div
                    className="absolute left-0 top-0 overflow-hidden border border-sky-400/70"
                    style={{ width: effW, height: effH }}
                  >
                    {exportUrl && (
                      <img
                        src={exportUrl}
                        alt="effective atlas"
                        draggable={false}
                        className="block"
                        style={{
                          width: effW,
                          height: effH,
                          imageRendering: zoom >= 1.5 ? 'pixelated' : 'auto',
                        }}
                      />
                    )}
                    {showBorder &&
                      sheet.packedItems.map((item) => (
                        <div
                          key={item.sprite.id}
                          className="pointer-events-none absolute border border-sky-400/80"
                          style={{
                            left: item.x * zoom,
                            top: item.y * zoom,
                            width: item.width * zoom,
                            height: item.height * zoom,
                          }}
                        />
                      ))}
                  </div>
                )}
                {busy && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 text-slate-200">
                    拼合中…
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
