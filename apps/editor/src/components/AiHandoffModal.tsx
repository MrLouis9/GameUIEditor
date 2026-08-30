import { useMemo, useRef, useState } from 'react';
import { Copy, Download, Eye, FileJson, FolderInput, FolderOpen, Package, Save, Upload } from 'lucide-react';
import {
  lintNaming,
  getActivePage,
  type NamingIssue,
} from '@game-ui/document';
import { Modal } from './Modal';
import { openUiPreview, downloadStandalonePreview } from '../pages/PreviewPage';
import {
  buildAiChatPaste,
  collectUsedAssetIds,
  collectUsedAtlases,
  downloadAiHandoffZip,
  downloadDocumentJson,
} from '../pages/aiHandoff';
import {
  getPrefabPathHint,
  setPrefabPathHint,
  getAtlasPathHint,
  setAtlasPathHint,
  pickPrefabDirectory,
  pickAtlasDirectory,
  supportsDirectoryPicker,
  DEFAULT_PREFAB_PATH_HINT,
  DEFAULT_ATLAS_PATH_HINT,
} from '../pages/gameProjectTarget';
import { useEditorStore } from '../store/editorStore';
import { toast, confirmDialog } from '../ui/feedback';

type Props = {
  onClose: () => void;
};

export function AiHandoffModal({ onClose }: Props) {
  const doc = useEditorStore((s) => s.document);
  const select = useEditorStore((s) => s.select);
  const updateNodeSemantics = useEditorStore((s) => s.updateNodeSemantics);
  const exportActivePrefab = useEditorStore((s) => s.exportActivePrefab);
  const saveActivePrefabToGameProject = useEditorStore(
    (s) => s.saveActivePrefabToGameProject
  );
  const importPrefabFile = useEditorStore((s) => s.importPrefabFile);
  const importAllPrefabsFromGameProject = useEditorStore(
    (s) => s.importAllPrefabsFromGameProject
  );
  const prefabInputRef = useRef<HTMLInputElement>(null);
  const prefabImportMode = useRef<'replace-active' | 'add-page'>('replace-active');

  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [prefabHint, setPrefabHint] = useState(getPrefabPathHint);
  const [atlasHint, setAtlasHint] = useState(getAtlasPathHint);

  const openPrefabPicker = (mode: 'replace-active' | 'add-page') => {
    prefabImportMode.current = mode;
    prefabInputRef.current?.click();
  };

  const page = useMemo(() => getActivePage(doc), [doc]);
  const usedAssetIds = useMemo(() => {
    if (!page) return new Set<string>();
    return collectUsedAssetIds(page.root);
  }, [page]);
  const usedAtlasCount = useMemo(() => {
    return collectUsedAtlases(doc, usedAssetIds).length;
  }, [doc, usedAssetIds]);
  const issues = useMemo(() => lintNaming(doc), [doc]);
  const missingAssets = useMemo(() => {
    const usedAtlases = collectUsedAtlases(doc, usedAssetIds);
    const atlasIds = new Set(usedAtlases.map((a) => a.id));
    return doc.assets.filter((a) => atlasIds.has(a.atlasId) && !a.dataUrl)
      .length;
  }, [doc, usedAssetIds]);

  const downloadZip = async () => {
    if (missingAssets > 0) {
      toast(
        `本界面有 ${missingAssets} 张用到的切图缺少图像数据，将无法打进图集`,
        'warn'
      );
    }
    setBusy(true);
    try {
      await downloadAiHandoffZip(doc);
      toast('交接包已下载（当前 Root + 用到的原图集）', 'success');
    } catch (err) {
      console.error(err);
      toast('打包失败，请重试', 'error');
    } finally {
      setBusy(false);
    }
  };

  const copyBrief = async () => {
    await navigator.clipboard.writeText(buildAiChatPaste(doc));
    setCopied(true);
    toast('说明已复制，请同时附上 zip', 'success');
    window.setTimeout(() => setCopied(false), 1600);
  };

  const jumpToIssue = (issue: NamingIssue) => {
    select([issue.nodeId]);
  };

  const importFromGameFolder = async (forcePick: boolean) => {
    const ok = await confirmDialog({
      title: '从游戏工程导入全部 Prefab',
      message: forcePick
        ? '将打开文件夹选择器。选中游戏 public/ui/prefabs 后，会把其中所有 .prefab.gameui.json 导入本工程：同名界面替换，新界面追加。图集像素需另「打开图集」。确定？'
        : `将读取已绑定（或提示）的 Prefab 目录中的全部界面文件并导入本工程：同名界面替换，新界面追加。目录提示：${prefabHint}。图集像素需另「打开图集」。确定？`,
      confirmLabel: '导入全部',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const result = await importAllPrefabsFromGameProject({ forcePick });
      if (!result.ok) {
        toast(result.error || '导入失败', 'error');
        return;
      }
      const parts = [
        `已从「${result.dirName}」导入 ${result.imported} 个界面`,
        result.replaced ? `替换 ${result.replaced}` : '',
        result.added ? `新增 ${result.added}` : '',
        result.skipped ? `跳过 ${result.skipped}` : '',
      ].filter(Boolean);
      toast(parts.join(' · '), 'success');
      if (result.error) toast(result.error, 'warn');
    } catch (err) {
      toast(err instanceof Error ? err.message : '导入失败', 'error');
    } finally {
      setBusy(false);
    }
  };

  const applySuggestion = (issue: NamingIssue) => {
    if (!issue.suggestion) return;
    updateNodeSemantics(issue.nodeId, { componentKey: issue.suggestion });
    select([issue.nodeId]);
    toast(`已应用 Key：${issue.suggestion}`, 'success');
  };

  return (
    <Modal
      title="AI 交接包"
      size="lg"
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2 text-xs">
          <button
            type="button"
            onClick={() => void copyBrief()}
            className="inline-flex items-center gap-1 rounded border border-slate-700 px-3 py-1.5 text-slate-300 hover:bg-slate-800"
          >
            <Copy size={12} />
            {copied ? '已复制说明' : '复制说明'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-700 px-3 py-1.5 text-slate-300 hover:bg-slate-800"
          >
            关闭
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void downloadZip()}
            className="inline-flex items-center gap-1.5 rounded bg-sky-600 px-3 py-1.5 font-medium text-white hover:bg-sky-500 disabled:opacity-50"
          >
            <Package size={14} />
            {busy ? '打包中…' : '下载 AI 交接包'}
          </button>
        </div>
      }
    >
      <div className="space-y-4 text-sm text-slate-300">
        <section className="space-y-2 rounded-lg border border-emerald-900/50 bg-emerald-950/20 px-3 py-3">
          <div className="text-[13px] font-medium text-emerald-200/95">
            界面 Prefab（给其它项目 / 可再编辑）
          </div>
          <p className="text-[12px] leading-relaxed text-slate-400">
            导出当前 Root 的完整布局与引用（
            <code className="text-slate-300">.prefab.gameui.json</code>
            ），不含切图像素。图集请在底部资源栏「保存图集」另行导出。其它项目按
            <code className="text-slate-300">assetId → frame → 图集 JSON</code>
            解析，勿改 id / frame 对应关系。改完 Prefab 后可再导入本编辑器继续改。
          </p>
          <p className="text-[11px] leading-relaxed text-amber-200/80">
            游戏运行时只读：
            <code className="text-amber-100/90">public/ui/prefabs</code>
            。优先使用「保存到游戏工程」实现所见即所得。
          </p>
          <div className="space-y-1.5 rounded border border-slate-800 bg-slate-950/40 px-2 py-2 text-[11px]">
            <label className="block text-slate-400">
              Prefab 目录提示
              <input
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-200"
                value={prefabHint}
                onChange={(e) => {
                  setPrefabHint(e.target.value);
                  setPrefabPathHint(e.target.value);
                }}
                placeholder={DEFAULT_PREFAB_PATH_HINT}
              />
            </label>
            <label className="block text-slate-400">
              图集目录提示
              <input
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-200"
                value={atlasHint}
                onChange={(e) => {
                  setAtlasHint(e.target.value);
                  setAtlasPathHint(e.target.value);
                }}
                placeholder={DEFAULT_ATLAS_PATH_HINT}
              />
            </label>
            {supportsDirectoryPicker() && (
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={async () => {
                    const h = await pickPrefabDirectory();
                    if (h) {
                      setPrefabHint(h.name);
                      toast(`已绑定 Prefab 目录：${h.name}`, 'success');
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded border border-slate-600 px-2 py-1 text-slate-300 hover:bg-slate-800"
                >
                  <FolderOpen size={12} />
                  选择 Prefab 文件夹
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const h = await pickAtlasDirectory();
                    if (h) {
                      setAtlasHint(h.name);
                      toast(`已绑定图集目录：${h.name}`, 'success');
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded border border-slate-600 px-2 py-1 text-slate-300 hover:bg-slate-800"
                >
                  <FolderOpen size={12} />
                  选择图集文件夹
                </button>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                void (async () => {
                  const result = await saveActivePrefabToGameProject();
                  if (!result.ok) {
                    toast(result.error || '保存失败', 'error');
                    return;
                  }
                  toast(
                    result.method === 'directory'
                      ? `已写入游戏工程：${result.filename}（刷新游戏即可）`
                      : `已下载 ${result.filename}，请放到 ${prefabHint}`,
                    'success'
                  );
                })();
              }}
              className="inline-flex items-center gap-1.5 rounded bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500"
            >
              <Save size={12} />
              保存到游戏工程
            </button>
            <button
              type="button"
              onClick={() => {
                try {
                  exportActivePrefab();
                  toast(
                    `已导出 Prefab：${page?.root.name ?? '界面'}（请另存对应图集）`,
                    'success'
                  );
                } catch (err) {
                  toast(
                    err instanceof Error ? err.message : '导出失败',
                    'error'
                  );
                }
              }}
              className="inline-flex items-center gap-1.5 rounded bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600"
            >
              <FileJson size={12} />
              导出界面 Prefab
            </button>
            <button
              type="button"
              onClick={() => openPrefabPicker('replace-active')}
              className="inline-flex items-center gap-1.5 rounded border border-emerald-800 px-3 py-1.5 text-xs text-emerald-100/90 hover:bg-emerald-950/50"
            >
              <Upload size={12} />
              导入 Prefab（替换当前页）
            </button>
            <button
              type="button"
              onClick={() => openPrefabPicker('add-page')}
              className="inline-flex items-center gap-1.5 rounded border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
            >
              导入为新页面
            </button>
            {supportsDirectoryPicker() && (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void importFromGameFolder(false)}
                  className="inline-flex items-center gap-1.5 rounded border border-amber-700/70 bg-amber-950/30 px-3 py-1.5 text-xs font-medium text-amber-100 hover:bg-amber-900/40 disabled:opacity-50"
                >
                  <FolderInput size={12} />
                  {busy ? '导入中…' : '从游戏工程导入全部'}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void importFromGameFolder(true)}
                  className="inline-flex items-center gap-1.5 rounded border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                  title="重新选择 Prefab 文件夹后再全部导入"
                >
                  <FolderOpen size={12} />
                  选文件夹并导入全部
                </button>
              </>
            )}
            <input
              ref={prefabInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f) return;
                const mode = prefabImportMode.current;
                try {
                  await importPrefabFile(f, mode);
                  toast(
                    mode === 'add-page'
                      ? `已作为新页面导入：${f.name}`
                      : `已替换当前界面：${f.name}。若出现粉块，请再「打开图集」导入对应图集`,
                    'success'
                  );
                } catch (err) {
                  toast(
                    err instanceof Error ? err.message : '导入失败',
                    'error'
                  );
                }
              }}
            />
          </div>
        </section>

        <p className="leading-relaxed text-slate-400">
          AI 交接包：当前 Root + 预览 HTML + 说明，以及本界面用到的原图集（各一份
          png+json）。图集已内含时可直接给实现方；日常给程序用 Prefab + 单独图集更干净。
        </p>

        <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
          <Stat label="当前 Root" value={page?.root.name ?? '—'} />
          <Stat label="用到的图集" value={String(usedAtlasCount)} />
          <Stat
            label="命名问题"
            value={String(issues.length)}
            warn={issues.length > 0}
          />
          <Stat
            label="缺图"
            value={missingAssets ? String(missingAssets) : '0'}
            warn={missingAssets > 0}
          />
        </div>

        {issues.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[11px] font-medium text-amber-300/90">
              命名问题（点击选中 · 可一键应用建议）
            </div>
            <ul className="max-h-36 space-y-1 overflow-auto rounded border border-amber-900/50 bg-amber-950/20 p-2 text-[11px]">
              {issues.map((i) => (
                <li
                  key={`${i.nodeId}-${i.code}`}
                  className="flex items-start gap-2 rounded px-1 py-0.5 hover:bg-amber-950/40"
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left text-amber-100/90"
                    onClick={() => jumpToIssue(i)}
                  >
                    <span className="font-medium">{i.nodeName || i.nodeId}</span>
                    ：{i.message}
                    {i.suggestion ? (
                      <span className="text-amber-400/80"> → {i.suggestion}</span>
                    ) : null}
                  </button>
                  {i.suggestion && (
                    <button
                      type="button"
                      className="shrink-0 rounded bg-amber-900/50 px-1.5 py-0.5 text-amber-200 hover:bg-amber-800/60"
                      onClick={() => applySuggestion(i)}
                    >
                      应用
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <details className="rounded border border-slate-800 bg-slate-950/40 px-3 py-2 text-[12px] text-slate-500">
          <summary className="cursor-pointer text-slate-400">
            其它导出（非 AI 主路径）
          </summary>
          <div className="mt-2 flex flex-wrap gap-2">
            <SecondaryBtn
              icon={<FileJson size={12} />}
              label="仅下载 JSON"
              onClick={() => downloadDocumentJson(doc)}
            />
            <SecondaryBtn
              icon={<Download size={12} />}
              label="预览 HTML"
              onClick={() => downloadStandalonePreview(doc)}
            />
            <SecondaryBtn
              icon={<Eye size={12} />}
              label="本机网页预览"
              onClick={() => void openUiPreview(doc)}
            />
          </div>
        </details>
      </div>
    </Modal>
  );
}

function Stat({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/50 px-2.5 py-2">
      <div className="text-[10px] text-slate-500">{label}</div>
      <div
        className={`text-sm font-medium ${
          warn ? 'text-amber-300' : 'text-slate-100'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function SecondaryBtn({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-slate-400 hover:bg-slate-800"
    >
      {icon}
      {label}
    </button>
  );
}
