import { useMemo, useState } from 'react';
import { Copy, Download, Eye, FileJson, Package } from 'lucide-react';
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
import { useEditorStore } from '../store/editorStore';
import { toast } from '../ui/feedback';

type Props = {
  onClose: () => void;
};

export function AiHandoffModal({ onClose }: Props) {
  const doc = useEditorStore((s) => s.document);
  const select = useEditorStore((s) => s.select);
  const updateNodeSemantics = useEditorStore((s) => s.updateNodeSemantics);

  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

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
        <p className="leading-relaxed text-slate-400">
          只导出当前界面 Root：界面 JSON、预览 HTML、说明 MD，以及本界面用到的原图集（各一份
          png+json，名字与编辑器中一致）。不会合成新图集，未使用的图集不导出。
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
