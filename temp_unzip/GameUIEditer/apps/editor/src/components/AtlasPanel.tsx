import { useEffect, useMemo, useState } from 'react';
import { Download, FileJson, Image as ImageIcon, RefreshCw } from 'lucide-react';
import {
  DEFAULT_PACK_SETTINGS,
  PackedSheet,
  PackSettings,
  SpriteItem,
  drawPackedSheet,
  generateAtlasJSON,
  generateAtlasCSS,
  loadImage,
  packSprites,
} from '@game-ui/atlas';
import { getAssetsInAtlas } from '@game-ui/document';
import { useEditorStore } from '../store/editorStore';

export function AtlasPanel() {
  const document = useEditorStore((s) => s.document);
  const setActiveAtlas = useEditorStore((s) => s.setActiveAtlas);
  const assets = useMemo(() => getAssetsInAtlas(document), [document]);
  const activeAtlas = document.atlases.find((a) => a.id === document.activeAtlasId);

  const [settings, setSettings] = useState<PackSettings>({ ...DEFAULT_PACK_SETTINGS });
  const [sheet, setSheet] = useState<PackedSheet | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canPack = assets.length > 0;
  const atlasKey = `${document.activeAtlasId}:${assets.map((a) => `${a.id}:${a.dataUrl.length}`).join(',')}`;

  const pack = async () => {
    if (!assets.length) return;
    setBusy(true);
    setError(null);
    try {
      const sprites: SpriteItem[] = [];
      for (const asset of assets) {
        const img = await loadImage(asset.dataUrl);
        sprites.push({
          id: asset.id,
          name: asset.name,
          width: asset.width,
          height: asset.height,
          originalWidth: asset.width,
          originalHeight: asset.height,
          trimmed: false,
          trimOffset: { x: 0, y: 0 },
          dataUrl: asset.dataUrl,
          imgElement: img,
          nineSlice: asset.nineSlice,
        });
      }
      const result = packSprites(sprites, settings);
      setSheet(result);
      const canvas = drawPackedSheet(result, settings.backgroundColor, settings.scale);
      setPreviewUrl(canvas.toDataURL('image/png'));
    } catch (e) {
      setError(e instanceof Error ? e.message : '拼合失败');
      setSheet(null);
      setPreviewUrl(null);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (assets.length) void pack();
    else {
      setSheet(null);
      setPreviewUrl(null);
    }
  }, [atlasKey]);

  const stats = useMemo(() => {
    if (!sheet) return null;
    return {
      size: `${sheet.width}×${sheet.height}`,
      packed: sheet.packedItems.length,
      unfit: sheet.unfittedItems.length,
      efficiency: `${sheet.efficiency.toFixed(1)}%`,
    };
  }, [sheet]);

  const fileBase = (activeAtlas?.name || 'atlas').replace(/[\\/:*?"<>|]/g, '_');

  const downloadPng = () => {
    if (!previewUrl) return;
    const a = window.document.createElement('a');
    a.href = previewUrl;
    a.download = `${fileBase}.png`;
    a.click();
  };

  const downloadJson = () => {
    if (!sheet) return;
    let content: string;
    let filename: string;
    if (settings.format === 'css') {
      content = generateAtlasCSS(sheet, `${fileBase}.png`, settings.scale);
      filename = `${fileBase}.css`;
    } else {
      content = generateAtlasJSON(
        sheet,
        `${fileBase}.png`,
        settings.format,
        settings.scale
      );
      filename = `${fileBase}.json`;
    }
    const blob = new Blob([content], {
      type: settings.format === 'css' ? 'text/css' : 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <aside className="relative flex w-72 shrink-0 flex-col border-l border-slate-800 bg-slate-900/80">
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
        图集拼合
        <button
          type="button"
          disabled={!canPack || busy}
          onClick={() => void pack()}
          className="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-1 text-[11px] normal-case text-sky-300 hover:bg-slate-700 disabled:opacity-40"
        >
          <RefreshCw size={12} className={busy ? 'animate-spin' : ''} />
          重新拼合
        </button>
      </div>

      <div className="border-b border-slate-800 px-3 py-2">
        <label className="block text-[11px] text-slate-500">
          当前图集
          <select
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
            value={document.activeAtlasId}
            onChange={(e) => setActiveAtlas(e.target.value)}
          >
            {document.atlases.map((atlas) => (
              <option key={atlas.id} value={atlas.id}>
                {atlas.name} ({getAssetsInAtlas(document, atlas.id).length})
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="space-y-2 border-b border-slate-800 p-3 text-xs text-slate-400">
        <label className="flex items-center justify-between gap-2">
          <span>算法</span>
          <select
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200"
            value={settings.algorithm}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                algorithm: e.target.value as PackSettings['algorithm'],
              }))
            }
          >
            <option value="growing-binpacker">Growing Bin</option>
            <option value="shelf">Shelf</option>
          </select>
        </label>
        <label className="flex items-center justify-between gap-2">
          <span>间距</span>
          <input
            type="number"
            min={0}
            className="w-20 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200"
            value={settings.spacing}
            onChange={(e) =>
              setSettings((s) => ({ ...s, spacing: Number(e.target.value) || 0 }))
            }
          />
        </label>
        <label className="flex items-center justify-between gap-2">
          <span>边距</span>
          <input
            type="number"
            min={0}
            className="w-20 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200"
            value={settings.padding}
            onChange={(e) =>
              setSettings((s) => ({ ...s, padding: Number(e.target.value) || 0 }))
            }
          />
        </label>
        <label className="flex items-center justify-between gap-2">
          <span>导出格式</span>
          <select
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200"
            value={settings.format}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                format: e.target.value as PackSettings['format'],
              }))
            }
          >
            <option value="json-hash">JSON Hash</option>
            <option value="json-array">JSON Array</option>
            <option value="css">CSS</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.forcePowerOfTwo}
            onChange={(e) =>
              setSettings((s) => ({ ...s, forcePowerOfTwo: e.target.checked }))
            }
          />
          强制 2 的幂
        </label>
        <button
          type="button"
          className="w-full rounded bg-slate-800 py-1.5 text-sky-300 hover:bg-slate-700"
          disabled={!canPack || busy}
          onClick={() => void pack()}
        >
          应用设置并拼合
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3">
        {!canPack && (
          <p className="text-xs text-slate-500">当前图集无资源，请先在资源库上传。</p>
        )}
        {error && <p className="mb-2 text-xs text-red-400">{error}</p>}
        {stats && (
          <div className="mb-2 grid grid-cols-2 gap-1 text-[11px] text-slate-400">
            <span>尺寸 {stats.size}</span>
            <span>利用率 {stats.efficiency}</span>
            <span>已装入 {stats.packed}</span>
            <span>未装入 {stats.unfit}</span>
          </div>
        )}
        {previewUrl && (
          <div className="overflow-auto rounded border border-slate-800 bg-[repeating-conic-gradient(#1e293b_0%_25%,#0f172a_0%_50%)_0_0/12px_12px] p-2">
            <img src={previewUrl} alt="atlas preview" className="mx-auto max-w-full" />
          </div>
        )}
      </div>

      <div className="flex gap-2 border-t border-slate-800 p-3">
        <button
          type="button"
          disabled={!previewUrl}
          onClick={downloadPng}
          className="inline-flex flex-1 items-center justify-center gap-1 rounded bg-slate-800 py-2 text-xs text-slate-200 hover:bg-slate-700 disabled:opacity-40"
        >
          <ImageIcon size={14} />
          PNG
        </button>
        <button
          type="button"
          disabled={!sheet}
          onClick={downloadJson}
          className="inline-flex flex-1 items-center justify-center gap-1 rounded bg-sky-700 py-2 text-xs text-white hover:bg-sky-600 disabled:opacity-40"
        >
          <FileJson size={14} />
          JSON
        </button>
        <button
          type="button"
          disabled={!previewUrl || !sheet}
          onClick={() => {
            downloadPng();
            downloadJson();
          }}
          className="inline-flex items-center justify-center gap-1 rounded border border-slate-700 px-2 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40"
          title="同时下载"
        >
          <Download size={14} />
        </button>
      </div>
    </aside>
  );
}
