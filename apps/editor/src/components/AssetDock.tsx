import {
  Download,
  FolderPlus,
  ImagePlus,
  LayoutGrid,
  Pencil,
  Trash2,
  Upload,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import JSZip from 'jszip';
import {
  ASSET_DRAG_MIME,
  Asset,
  encodeAssetDragPayload,
  getAssetsInAtlas,
  NineSlice,
} from '@game-ui/document';
import { useEditorStore } from '../store/editorStore';
import { NineSliceGuide } from './NineSliceGuide';
import { Modal } from './Modal';
import { AtlasPackModal } from './AtlasPackModal';
import { confirmDialog, promptDialog, toast } from '../ui/feedback';
import { ScrubLabel } from '../ui/NumberField';

type AssetDockProps = {
  /** Fill parent height (resizable shell). */
  fillHeight?: boolean;
  /** When set, 「收起」 collapses the whole dock via shell. */
  onRequestCollapse?: () => void;
};

export function AssetDock({ fillHeight, onRequestCollapse }: AssetDockProps) {
  const document = useEditorStore((s) => s.document);
  const addAssetFromFile = useEditorStore((s) => s.addAssetFromFile);
  const upsertAssetFromFile = useEditorStore((s) => s.upsertAssetFromFile);
  const removeAsset = useEditorStore((s) => s.removeAsset);
  const addSprite = useEditorStore((s) => s.addSprite);
  const setActiveAtlas = useEditorStore((s) => s.setActiveAtlas);
  const createAtlas = useEditorStore((s) => s.createAtlas);
  const renameAtlas = useEditorStore((s) => s.renameAtlas);
  const deleteAtlas = useEditorStore((s) => s.deleteAtlas);
  const [packOpen, setPackOpen] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [editingAtlas, setEditingAtlas] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [zipBusy, setZipBusy] = useState(false);

  const assets = useMemo(() => getAssetsInAtlas(document), [document]);
  const activeAtlas = document.atlases.find((a) => a.id === document.activeAtlasId);
  const importAtlasZip = async (file: File) => {
    try {
      const zip = await JSZip.loadAsync(file);
      const manifestEntry =
        zip.file('atlas.json') ??
        Object.values(zip.files).find(
          (f) => !f.dir && /(^|\/)atlas\.json$/i.test(f.name)
        ) ??
        null;
      if (!manifestEntry) {
        toast('ZIP 内缺少 atlas.json', 'error');
        return;
      }
      const raw = await manifestEntry.async('string');
      const manifest = JSON.parse(raw) as {
        atlasName?: string;
        assets?: Array<{
          file: string;
          id?: string;
          name: string;
          nineSlice?: NineSlice;
        }>;
      };
      const list = manifest.assets ?? [];
      if (!list.length) {
        toast('图集里没有切图', 'warn');
        return;
      }

      let imported = 0;
      let updated = 0;
      for (const entry of list) {
        const rel = (entry.file || '').replace(/^\.\//, '');
        const baseName = rel.split('/').pop() || '';
        const imgEntry =
          (rel && zip.file(rel)) ||
          (baseName && zip.file(`sprites/${baseName}`)) ||
          Object.values(zip.files).find(
            (f) => !f.dir && f.name.endsWith(baseName)
          ) ||
          null;
        if (!imgEntry) continue;

        const blob = await imgEntry.async('blob');
        const ext = (baseName.split('.').pop() || 'png').toLowerCase();
        const mime =
          ext === 'jpg' || ext === 'jpeg'
            ? 'image/jpeg'
            : ext === 'webp'
              ? 'image/webp'
              : ext === 'gif'
                ? 'image/gif'
                : 'image/png';
        const spriteName = entry.name || baseName.replace(/\.[^.]+$/, '') || 'sprite';
        const named = new File(
          [blob],
          `${spriteName}.${ext === 'jpeg' ? 'jpg' : ext}`,
          { type: mime }
        );
        // Pass manifest id so UI sprites keep their links after re-import
        const result = await upsertAssetFromFile(named, undefined, {
          assetId: entry.id,
          name: spriteName,
          nineSlice: entry.nineSlice,
        });
        if (result) {
          imported += 1;
          if (result.updated) updated += 1;
        }
      }

      if (manifest.atlasName && activeAtlas) {
        renameAtlas(activeAtlas.id, manifest.atlasName);
      }
      toast(
        updated > 0
          ? `已导入 ${imported} 张（更新 ${updated}，同名/同 ID 已覆盖）`
          : `已导入 ${imported} 张切图到当前图集`,
        'success'
      );
    } catch (err) {
      console.error(err);
      toast(
        `打开图集失败：${err instanceof Error ? err.message : '无效 ZIP'}`,
        'error'
      );
    }
  };

  const downloadAtlasZip = async () => {

    if (!activeAtlas || assets.length === 0) {
      toast('当前图集没有可下载的切图', 'warn');
      return;
    }
    setZipBusy(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder('sprites') ?? zip;
      const usedNames = new Set<string>();

      const extFromDataUrl = (dataUrl: string) => {
        const m = /^data:image\/([a-zA-Z0-9+.-]+);/i.exec(dataUrl);
        const raw = (m?.[1] || 'png').toLowerCase();
        if (raw === 'jpeg') return 'jpg';
        if (raw === 'svg+xml') return 'svg';
        return raw.replace(/[^a-z0-9]/g, '') || 'png';
      };

      const uniqueName = (raw: string, ext: string) => {
        const base =
          raw.replace(/[\\/:*?"<>|]/g, '_').replace(/\.[^.]+$/, '') || 'sprite';
        let name = `${base}.${ext}`;
        let i = 1;
        while (usedNames.has(name.toLowerCase())) {
          name = `${base}_${i++}.${ext}`;
        }
        usedNames.add(name.toLowerCase());
        return name;
      };

      const manifestAssets: Array<{
        file: string;
        id: string;
        name: string;
        width: number;
        height: number;
        nineSlice?: NineSlice;
      }> = [];

      for (const asset of assets) {
        const ext = extFromDataUrl(asset.dataUrl || 'data:image/png;base64,');
        const fileName = uniqueName(asset.name, ext);
        const res = await fetch(asset.dataUrl);
        const blob = await res.blob();
        folder.file(fileName, blob);
        manifestAssets.push({
          file: `sprites/${fileName}`,
          id: asset.id,
          name: asset.name,
          width: asset.width,
          height: asset.height,
          nineSlice: asset.nineSlice,
        });
      }

      zip.file(
        'atlas.json',
        JSON.stringify(
          {
            atlasId: activeAtlas.id,
            atlasName: activeAtlas.name,
            exportedAt: new Date().toISOString(),
            assets: manifestAssets,
          },
          null,
          2
        )
      );

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = window.document.createElement('a');
      const safe = activeAtlas.name.replace(/[\\/:*?"<>|]/g, '_') || 'atlas';
      a.href = url;
      a.download = `${safe}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast('图集 ZIP 已下载', 'success');
    } catch (err) {
      console.error(err);
      toast('打包 ZIP 失败，请重试', 'error');
    } finally {
      setZipBusy(false);
    }
  };

  return (
    <div
      className={
        fillHeight
          ? 'relative flex h-full min-h-0 flex-col border-t border-slate-800 bg-slate-900/95'
          : 'relative flex shrink-0 flex-col border-t border-slate-800 bg-slate-900/95'
      }
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-slate-800 px-3 py-1.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          资源库
        </span>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-slate-400 hover:bg-slate-800 hover:text-sky-300 disabled:opacity-40"
          disabled={assets.length === 0}
          title={
            assets.length === 0 ? '请先上传切图' : '图集拼合'
          }
          onClick={() => setPackOpen(true)}
        >
          <LayoutGrid size={12} />
          图集拼合
        </button>

        <div className="min-w-0 flex-1" />

        <label
          title="打开图集 ZIP（切图 + atlas.json）导入到当前图集"
          className="inline-flex cursor-pointer items-center gap-1 rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800"
        >
          <Upload size={12} />
          打开图集
          <input
            type="file"
            accept=".zip,application/zip"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importAtlasZip(f);
              e.target.value = '';
            }}
          />
        </label>
        <button
          type="button"
          title="保存当前图集为 ZIP（切图 + atlas.json）"
          disabled={!assets.length || zipBusy}
          className="inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800 disabled:opacity-40"
          onClick={() => void downloadAtlasZip()}
        >
          <Download size={12} />
          {zipBusy ? '打包中…' : '保存图集'}
        </button>
        <label className="inline-flex cursor-pointer items-center gap-1 rounded bg-slate-800 px-2 py-1 text-[11px] text-sky-300 hover:bg-slate-700">
          <ImagePlus size={12} />
          上传
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            className="hidden"
            onChange={async (e) => {
              const files = [...(e.target.files ?? [])];
              let added = 0;
              let updated = 0;
              for (const f of files) {
                const result = await upsertAssetFromFile(f);
                if (!result) continue;
                if (result.updated) updated += 1;
                else added += 1;
              }
              e.target.value = '';
              if (added || updated) {
                const parts = [
                  added ? `新增 ${added}` : null,
                  updated ? `更新 ${updated}` : null,
                ].filter(Boolean);
                toast(parts.join(' · '), 'success');
              }
            }}
          />
        </label>
        <button
          type="button"
          className="rounded px-2 py-0.5 text-[11px] text-slate-500 hover:text-slate-300"
          onClick={() => {
            if (onRequestCollapse) onRequestCollapse();
            else setCollapsed((v) => !v);
          }}
        >
          {fillHeight || !collapsed ? '收起' : '展开'}
        </button>
      </div>

      {(fillHeight || !collapsed) && (
        <div
          className={
            fillHeight ? 'flex min-h-0 flex-1' : 'flex h-32 min-h-0'
          }
        >
          {/* Left: multi-atlas list */}
          <div className="flex w-36 shrink-0 flex-col border-r border-slate-800 bg-slate-950/50">
            <div className="flex items-center justify-between border-b border-slate-800 px-2 py-1">
              <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                图集
              </span>
              <button
                type="button"
                title="新建图集"
                className="rounded p-0.5 text-slate-400 hover:bg-slate-800 hover:text-sky-300"
                onClick={() => {
                  void promptDialog({
                    title: '新建图集',
                    defaultValue: '新图集',
                  }).then((name) => {
                    if (name) createAtlas(name);
                  });
                }}
              >
                <FolderPlus size={13} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-1">
              {document.atlases.map((atlas) => {
                const count = getAssetsInAtlas(document, atlas.id).length;
                const active = atlas.id === document.activeAtlasId;
                return (
                  <button
                    key={atlas.id}
                    type="button"
                    onClick={() => setActiveAtlas(atlas.id)}
                    className={`mb-0.5 flex w-full items-center justify-between gap-1 rounded px-2 py-1 text-left text-[11px] ${
                      active
                        ? 'bg-sky-950/70 text-sky-200'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <span className="min-w-0 truncate" title={atlas.name}>
                      {atlas.name}
                    </span>
                    <span className="shrink-0 text-[10px] text-slate-500">{count}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex gap-0.5 border-t border-slate-800 px-1 py-0.5">
              <button
                type="button"
                title="编辑图集"
                disabled={!activeAtlas}
                className="flex-1 rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-sky-300 disabled:opacity-30"
                onClick={() => {
                  if (!activeAtlas) return;
                  setEditingAtlas({ id: activeAtlas.id, name: activeAtlas.name });
                }}
              >
                <Pencil size={12} className="mx-auto" />
              </button>
              <button
                type="button"
                title="删除图集"
                disabled={!activeAtlas || document.atlases.length <= 1}
                className="flex-1 rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-red-400 disabled:opacity-30"
                onClick={() => {
                  if (!activeAtlas) return;
                  void confirmDialog({
                    title: '删除图集',
                    message: `删除图集「${activeAtlas.name}」及其资源？`,
                    confirmLabel: '删除',
                    danger: true,
                  }).then((ok) => {
                    if (ok) deleteAtlas(activeAtlas.id);
                  });
                }}
              >
                <Trash2 size={12} className="mx-auto" />
              </button>
            </div>
          </div>

          {/* Right: sprites — fixed card aspect, wrap to rows, vertical scroll */}
          <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-2">
            {assets.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500">
                「{activeAtlas?.name ?? '图集'}」为空。上传切图后可拖到画布
              </p>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] content-start gap-2">
                {assets.map((asset) => (
                  <div
                    key={asset.id}
                    className="flex min-w-0 flex-col rounded border border-slate-800 bg-slate-950/60 p-1.5"
                  >
                    <div
                      draggable
                      onDragStart={(e) => {
                        const payload = encodeAssetDragPayload(asset.id);
                        e.dataTransfer.setData('text/plain', payload);
                        e.dataTransfer.setData(ASSET_DRAG_MIME, payload);
                        e.dataTransfer.effectAllowed = 'copy';
                      }}
                      onDoubleClick={() => addSprite(asset.id, { x: 80, y: 80 })}
                      className="aspect-square cursor-grab overflow-hidden rounded bg-slate-900 active:cursor-grabbing"
                      title="拖到画布 / 双击添加"
                    >
                      <img
                        src={asset.dataUrl}
                        alt={asset.name}
                        className="pointer-events-none h-full w-full object-contain"
                      />
                    </div>
                    <button
                      type="button"
                      className="mt-1 truncate text-left text-[10px] text-slate-300 hover:text-sky-300"
                      onClick={() => addSprite(asset.id, { x: 80, y: 80 })}
                    >
                      {asset.name}
                    </button>
                    <div className="flex items-center justify-between gap-1 text-[9px] text-slate-500">
                      <span className="min-w-0 truncate">
                        {asset.width}×{asset.height}
                        {asset.nineSlice ? ' ·9' : ''}
                      </span>
                      <span className="flex shrink-0 gap-0.5">
                        <button
                          type="button"
                          className="hover:text-sky-300"
                          onClick={() => setEditing(asset)}
                        >
                          <Pencil size={11} />
                        </button>
                        <button
                          type="button"
                          className="hover:text-red-400"
                          onClick={() => removeAsset(asset.id)}
                        >
                          <Trash2 size={11} />
                        </button>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {packOpen && (
        <AtlasPackModal
          atlasId={activeAtlas?.id || 'default'}
          assets={assets}
          atlasName={activeAtlas?.name || 'atlas'}
          onClose={() => setPackOpen(false)}
        />
      )}
      {editing && (
        <AssetEditModal
          asset={document.assets.find((a) => a.id === editing.id) ?? editing}
          atlases={document.atlases}
          onClose={() => setEditing(null)}
        />
      )}
      {editingAtlas && (
        <AtlasEditModal
          atlas={editingAtlas}
          assetCount={getAssetsInAtlas(document, editingAtlas.id).length}
          onClose={() => setEditingAtlas(null)}
          onSave={(name) => {
            renameAtlas(editingAtlas.id, name);
            setEditingAtlas(null);
          }}
        />
      )}
    </div>
  );
}


function AtlasEditModal({
  atlas,
  assetCount,
  onClose,
  onSave,
}: {
  atlas: { id: string; name: string };
  assetCount: number;
  onClose: () => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState(atlas.name);

  return (
    <Modal title="编辑图集" onClose={onClose}>
      <div className="space-y-3 text-xs text-slate-400">
        <label className="block space-y-1">
          <span>名称</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && name.trim()) onSave(name.trim());
            }}
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-2 text-sm text-slate-100 outline-none focus:border-sky-500/50"
          />
        </label>
        <p className="text-[11px] text-slate-500">
          当前包含 {assetCount} 张切图 · ID: {atlas.id}
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            className="rounded-md px-3 py-1.5 text-slate-400 hover:bg-slate-800"
            onClick={onClose}
          >
            取消
          </button>
          <button
            type="button"
            disabled={!name.trim()}
            className="rounded-md bg-sky-600 px-3 py-1.5 text-white hover:bg-sky-500 disabled:opacity-40"
            onClick={() => onSave(name.trim())}
          >
            保存
          </button>
        </div>
      </div>
    </Modal>
  );
}

function AssetEditModal({
  asset,
  atlases,
  onClose,
}: {
  asset: Asset;
  atlases: { id: string; name: string }[];
  onClose: () => void;
}) {
  const updateAsset = useEditorStore((s) => s.updateAsset);
  const replaceAssetImage = useEditorStore((s) => s.replaceAssetImage);
  const [name, setName] = useState(asset.name);
  const [atlasId, setAtlasId] = useState(asset.atlasId);
  const [top, setTop] = useState(asset.nineSlice?.top ?? 0);
  const [right, setRight] = useState(asset.nineSlice?.right ?? 0);
  const [bottom, setBottom] = useState(asset.nineSlice?.bottom ?? 0);
  const [left, setLeft] = useState(asset.nineSlice?.left ?? 0);

  useEffect(() => {
    setName(asset.name);
    setAtlasId(asset.atlasId);
    setTop(asset.nineSlice?.top ?? 0);
    setRight(asset.nineSlice?.right ?? 0);
    setBottom(asset.nineSlice?.bottom ?? 0);
    setLeft(asset.nineSlice?.left ?? 0);
  }, [asset]);

  return (
    <Modal
      title="编辑精灵 · 九宫设置"
      onClose={onClose}
      size="xl"
      resizable
      defaultWidth={980}
      defaultHeight={720}
      minWidth={560}
      minHeight={420}
      footer={
        <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
          <span>
            绿线拖拽设边距 · 滚轮缩放 · 拖窗口边角改大小 · {asset.width}×
            {asset.height}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-md px-3 py-1.5 text-slate-400 hover:bg-slate-800"
              onClick={onClose}
            >
              取消
            </button>
            <button
              type="button"
              className="rounded-md bg-sky-600 px-3 py-1.5 text-white hover:bg-sky-500"
              onClick={() => {
                const nineSlice: NineSlice | undefined =
                  !top && !right && !bottom && !left
                    ? undefined
                    : { top, right, bottom, left };
                updateAsset(asset.id, { name, atlasId, nineSlice });
                onClose();
              }}
            >
              保存
            </button>
          </div>
        </div>
      }
    >
      <div className="grid h-full min-h-0 flex-1 gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
        <div className="flex min-h-[280px] min-w-0 flex-col rounded-lg border border-slate-800 bg-slate-950/80 p-3 md:min-h-0">
          <NineSliceGuide
            dataUrl={asset.dataUrl}
            width={asset.width}
            height={asset.height}
            top={top}
            right={right}
            bottom={bottom}
            left={left}
            onChange={(n) => {
              setTop(n.top);
              setRight(n.right);
              setBottom(n.bottom);
              setLeft(n.left);
            }}
          />
        </div>

        <div className="space-y-3 overflow-auto text-xs text-slate-400">
          <label className="block space-y-1">
            <span>名称</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-2 text-sm text-slate-100 outline-none focus:border-sky-500/50"
            />
          </label>
          <label className="block space-y-1">
            <span>所属图集</span>
            <select
              value={atlasId}
              onChange={(e) => setAtlasId(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-2 text-sm text-slate-100 outline-none focus:border-sky-500/50"
            >
              {atlases.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ['上', top, setTop],
                ['右', right, setRight],
                ['下', bottom, setBottom],
                ['左', left, setLeft],
              ] as const
            ).map(([label, value, set]) => (
              <label
                key={label}
                className="flex items-center gap-1.5 rounded-md bg-slate-950 px-2 py-1.5"
              >
                <ScrubLabel
                  className="w-4 text-slate-500"
                  value={value}
                  step={1}
                  min={0}
                  onChange={(v) => set(Math.max(0, Math.round(v)))}
                >
                  {label}
                </ScrubLabel>
                <input
                  type="number"
                  min={0}
                  value={value}
                  onChange={(e) =>
                    set(Math.max(0, Number(e.target.value) || 0))
                  }
                  className="num-field min-w-0 flex-1 bg-transparent text-slate-100 outline-none"
                />
              </label>
            ))}
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-700 px-2.5 py-2 text-slate-300 hover:bg-slate-800">
            <ImagePlus size={14} />
            替换图片
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void replaceAssetImage(asset.id, f);
              }}
            />
          </label>
        </div>
      </div>
    </Modal>
  );
}
