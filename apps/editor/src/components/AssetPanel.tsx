import {
  FolderPlus,
  Grid3x3,
  ImagePlus,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  ASSET_DRAG_MIME,
  encodeAssetDragPayload,
  Asset,
  NineSlice,
  getAssetsInAtlas,
} from '@game-ui/document';
import { useEditorStore } from '../store/editorStore';
import { NineSliceGuide } from './NineSliceGuide';
import { toast } from '../ui/feedback';

export function AssetPanel() {
  const document = useEditorStore((s) => s.document);
  const upsertAssetFromFile = useEditorStore((s) => s.upsertAssetFromFile);
  const removeAsset = useEditorStore((s) => s.removeAsset);
  const addSprite = useEditorStore((s) => s.addSprite);
  const setActiveAtlas = useEditorStore((s) => s.setActiveAtlas);
  const createAtlas = useEditorStore((s) => s.createAtlas);
  const renameAtlas = useEditorStore((s) => s.renameAtlas);
  const deleteAtlas = useEditorStore((s) => s.deleteAtlas);
  const [editing, setEditing] = useState<Asset | null>(null);

  const assets = useMemo(
    () => getAssetsInAtlas(document),
    [document]
  );

  const activeAtlas = document.atlases.find((a) => a.id === document.activeAtlasId);

  return (
    <aside className="relative flex w-72 shrink-0 flex-col border-l border-slate-800 bg-slate-900/80">
      <div className="border-b border-slate-800 px-3 py-2">
        <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400">
          资源库
          <label className="inline-flex cursor-pointer items-center gap-1 rounded bg-slate-800 px-2 py-1 text-[11px] normal-case text-sky-300 hover:bg-slate-700">
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
        </div>

        <div className="flex items-center gap-1">
          <select
            className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
            value={document.activeAtlasId}
            onChange={(e) => setActiveAtlas(e.target.value)}
            title="切换图集"
          >
            {document.atlases.map((atlas) => (
              <option key={atlas.id} value={atlas.id}>
                {atlas.name} ({getAssetsInAtlas(document, atlas.id).length})
              </option>
            ))}
          </select>
          <button
            type="button"
            title="新建图集"
            className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-sky-300"
            onClick={() => {
              const name = window.prompt('图集名称', '新图集');
              if (name) createAtlas(name);
            }}
          >
            <FolderPlus size={14} />
          </button>
          <button
            type="button"
            title="重命名图集"
            className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-sky-300"
            onClick={() => {
              if (!activeAtlas) return;
              const name = window.prompt('重命名图集', activeAtlas.name);
              if (name) renameAtlas(activeAtlas.id, name);
            }}
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            title="删除图集（含其资源）"
            disabled={document.atlases.length <= 1}
            className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-red-400 disabled:opacity-30"
            onClick={() => {
              if (!activeAtlas) return;
              if (
                window.confirm(
                  `删除图集「${activeAtlas.name}」及其全部资源？画布上引用这些精灵的节点将失效。`
                )
              ) {
                deleteAtlas(activeAtlas.id);
              }
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-auto p-2">
        {assets.length === 0 && (
          <p className="px-1 text-xs text-slate-500">
            当前图集为空。上传切图后，可拖到画布编辑 UI，或点编辑设置名称/九宫。
          </p>
        )}
        {assets.map((asset) => (
          <AssetCard
            key={asset.id}
            asset={asset}
            onEdit={() => setEditing(asset)}
            onRemove={() => removeAsset(asset.id)}
            onAddToCanvas={() => addSprite(asset.id, { x: 80, y: 80 })}
          />
        ))}
      </div>

      {editing && (
        <AssetEditorModal
          key={editing.id}
          asset={
            document.assets.find((a) => a.id === editing.id) ?? editing
          }
          atlases={document.atlases}
          onClose={() => setEditing(null)}
        />
      )}
    </aside>
  );
}

function AssetCard({
  asset,
  onEdit,
  onRemove,
  onAddToCanvas,
}: {
  asset: Asset;
  onEdit: () => void;
  onRemove: () => void;
  onAddToCanvas: () => void;
}) {
  return (
    <div className="rounded border border-slate-800 bg-slate-950/50 p-2">
      <div
        draggable
        onDragStart={(e) => {
          const payload = encodeAssetDragPayload(asset.id);
          e.dataTransfer.setData('text/plain', payload);
          e.dataTransfer.setData(ASSET_DRAG_MIME, payload);
          e.dataTransfer.setData('text', payload);
          e.dataTransfer.effectAllowed = 'copy';
        }}
        onDoubleClick={onAddToCanvas}
        className="mb-2 cursor-grab overflow-hidden rounded bg-slate-900 active:cursor-grabbing"
        title="拖到画布，或双击添加"
      >
        <img
          src={asset.dataUrl}
          alt={asset.name}
          className="pointer-events-none mx-auto max-h-20 object-contain"
        />
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="min-w-0 flex-1 truncate text-left text-xs text-slate-300 hover:text-sky-300"
          title="添加到画布"
          onClick={onAddToCanvas}
        >
          {asset.name}
          <div className="text-[10px] text-slate-500">
            {asset.width}×{asset.height}
            {asset.nineSlice ? ' · 九宫' : ''}
          </div>
        </button>
        <button
          type="button"
          title="编辑资源"
          className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-sky-300"
          onClick={onEdit}
        >
          <Pencil size={14} />
        </button>
        <button
          type="button"
          title="删除"
          className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-red-400"
          onClick={onRemove}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

function AssetEditorModal({
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

  const save = () => {
    const nineSlice: NineSlice | undefined =
      !top && !right && !bottom && !left
        ? undefined
        : { top, right, bottom, left };
    updateAsset(asset.id, { name, atlasId, nineSlice });
    onClose();
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/55 p-3">
      <div className="flex max-h-full w-full max-w-lg flex-col rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-100">编辑资源</h3>
          <button
            type="button"
            className="rounded p-1 text-slate-400 hover:bg-slate-800"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3 overflow-auto p-4 text-xs">
          <NineSliceGuide
            dataUrl={asset.dataUrl}
            width={asset.width}
            height={asset.height}
            top={top}
            right={right}
            bottom={bottom}
            left={left}
            onChange={(next) => {
              setTop(next.top);
              setRight(next.right);
              setBottom(next.bottom);
              setLeft(next.left);
            }}
          />

          <label className="block text-slate-400">
            名称
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-200"
            />
          </label>

          <label className="block text-slate-400">
            所属图集
            <select
              value={atlasId}
              onChange={(e) => setAtlasId(e.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-200"
            >
              {atlases.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>

          <label className="inline-flex cursor-pointer items-center gap-2 rounded border border-slate-700 px-3 py-2 text-slate-300 hover:bg-slate-800">
            <ImagePlus size={14} />
            替换图片
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void replaceAssetImage(asset.id, f);
                e.target.value = '';
              }}
            />
          </label>

          <div>
            <div className="mb-2 flex items-center justify-between text-slate-400">
              <span className="inline-flex items-center gap-1">
                <Grid3x3 size={12} />
                九宫参数
              </span>
              <button
                type="button"
                className="text-[11px] text-slate-500 hover:text-slate-300"
                onClick={() => {
                  setTop(0);
                  setRight(0);
                  setBottom(0);
                  setLeft(0);
                }}
              >
                清除边距
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Num
                label="Top"
                value={top}
                max={Math.max(0, asset.height - bottom - 1)}
                onChange={setTop}
              />
              <Num
                label="Right"
                value={right}
                max={Math.max(0, asset.width - left - 1)}
                onChange={setRight}
              />
              <Num
                label="Bottom"
                value={bottom}
                max={Math.max(0, asset.height - top - 1)}
                onChange={setBottom}
              />
              <Num
                label="Left"
                value={left}
                max={Math.max(0, asset.width - right - 1)}
                onChange={setLeft}
              />
            </div>
          </div>

          <p className="text-[10px] text-slate-500">
            尺寸 {asset.width}×{asset.height}
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-800 px-4 py-3">
          <button
            type="button"
            className="rounded px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800"
            onClick={onClose}
          >
            取消
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded bg-sky-600 px-3 py-1.5 text-xs text-white hover:bg-sky-500"
            onClick={save}
          >
            <Plus size={12} />
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

function Num({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-slate-400">
      <span className="w-12">{label}</span>
      <input
        type="number"
        min={0}
        max={max}
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200"
      />
    </label>
  );
}
