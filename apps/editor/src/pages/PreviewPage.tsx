import { useEffect, useRef, useState } from 'react';
import {
  parseDocumentJson,
  serializeDocumentJson,
  type Document,
} from '@game-ui/document';
import { EditorStage } from '../canvas/EditorStage';
import {
  PREVIEW_STORAGE_KEY,
  EDITOR_STORAGE_KEY,
  decodeDocumentFromHash,
  buildSharePreviewUrl,
  downloadStandalonePreview,
  buildStandalonePreviewHtml,
} from './previewShare';
import { confirmDialog, toast } from '../ui/feedback';

async function loadPreviewDocument(): Promise<{
  doc: Document | null;
  source: 'hash' | 'session' | 'local' | null;
  layoutOnly: boolean;
}> {
  const hash = window.location.hash;
  if (hash && hash.length > 4) {
    const fromHash = await decodeDocumentFromHash(hash);
    if (fromHash) {
      const layoutOnly = fromHash.assets.some((a) => !a.dataUrl);
      return { doc: fromHash, source: 'hash', layoutOnly };
    }
  }
  try {
    const preview = sessionStorage.getItem(PREVIEW_STORAGE_KEY);
    if (preview) {
      return { doc: parseDocumentJson(preview), source: 'session', layoutOnly: false };
    }
  } catch {
    /* fall through */
  }
  try {
    const saved = localStorage.getItem(EDITOR_STORAGE_KEY);
    if (saved) {
      return { doc: parseDocumentJson(saved), source: 'local', layoutOnly: false };
    }
  } catch {
    /* ignore */
  }
  return { doc: null, source: null, layoutOnly: false };
}

/**
 * Clean full-page UI preview (no editor chrome) for sharing / AI recognition.
 * Prefer URL hash payload so the link is self-contained.
 */
export function PreviewPage() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<Document | null>(null);
  const [layoutOnly, setLayoutOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<'json' | 'link' | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await loadPreviewDocument();
      if (cancelled) return;
      setDoc(result.doc);
      setLayoutOnly(result.layoutOnly);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !doc) return;

    const stage = new EditorStage(
      {
        onSelect: () => {},
        onTransformLive: () => {},
        onTransformEnd: () => {},
        getTool: () => 'select',
        getSelectedIds: () => [],
        getDocument: () => doc,
        getDocumentForRender: () => doc,
      },
      { interactive: false }
    );

    let cancelled = false;
    let resizeObs: ResizeObserver | null = null;

    (async () => {
      await stage.mount(host);
      if (cancelled) {
        stage.destroy();
        return;
      }
      await stage.syncDocument(doc);
      stage.fitArtboard(40);
      resizeObs = new ResizeObserver(() => stage.fitArtboard(40));
      resizeObs.observe(host);
    })();

    return () => {
      cancelled = true;
      resizeObs?.disconnect();
      stage.destroy();
    };
  }, [doc]);

  const copyJson = async () => {
    if (!doc) return;
    await navigator.clipboard.writeText(serializeDocumentJson(doc, true));
    setCopied('json');
    window.setTimeout(() => setCopied(null), 1500);
  };

  const copyLink = async () => {
    if (!doc) return;
    const { url } = await buildSharePreviewUrl(doc);
    await navigator.clipboard.writeText(url);
    // Keep address bar in sync for refresh
    window.history.replaceState(null, '', url);
    setCopied('link');
    window.setTimeout(() => setCopied(null), 1500);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0b0e14] text-sm text-slate-500">
        加载预览…
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#0b0e14] px-6 text-center text-slate-400">
        <p className="text-sm">没有可预览的界面文档</p>
        <p className="max-w-md text-[12px] leading-relaxed text-slate-500">
          请从编辑器图层 Root 旁的链接打开预览。若把链接发给别人 / AI，须使用
          <b className="text-slate-300"> 含数据的完整链接 </b>
          或下载的独立 HTML（仅
          <code className="text-slate-300">?preview=1</code>
          没有界面数据）。
        </p>
        <a href="./" className="text-sky-400 hover:underline">
          返回编辑器
        </a>
      </div>
    );
  }

  const size = doc.designSize;

  return (
    <div className="flex h-full flex-col bg-[#0b0e14] text-slate-200">
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-800 px-4 py-2 text-xs">
        <span className="font-medium text-slate-100">{doc.name}</span>
        <span className="text-slate-500">
          {size.width}×{size.height}
        </span>
        <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
          本机预览 · AI 请用编辑器「AI 交接」下载 zip
        </span>
        {layoutOnly && (
          <span className="rounded bg-amber-950 px-2 py-0.5 text-[10px] text-amber-300">
            链接为布局版（切图过大已省略，JSON 仍含结构）
          </span>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void copyLink()}
            className="rounded border border-sky-700/60 bg-sky-950/40 px-2 py-1 text-sky-300 hover:bg-sky-900/50"
          >
            {copied === 'link' ? '已复制链接' : '复制完整链接'}
          </button>
          <button
            type="button"
            onClick={() => downloadStandalonePreview(doc)}
            className="rounded border border-slate-700 px-2 py-1 text-slate-300 hover:bg-slate-800"
          >
            下载 HTML
          </button>
          <button
            type="button"
            onClick={() => void copyJson()}
            className="rounded border border-slate-700 px-2 py-1 text-slate-300 hover:bg-slate-800"
          >
            {copied === 'json' ? '已复制 JSON' : '复制 JSON'}
          </button>
          <a
            href="./"
            className="rounded bg-slate-800 px-2 py-1 text-slate-300 hover:bg-slate-700"
          >
            返回编辑器
          </a>
        </div>
      </header>
      <div ref={hostRef} className="min-h-0 flex-1" />
    </div>
  );
}

/** Persist + open a self-contained local preview (not the AI handoff path). */
export async function openUiPreview(doc: Document): Promise<void> {
  const json = serializeDocumentJson(doc, false);
  try {
    sessionStorage.setItem(PREVIEW_STORAGE_KEY, json);
    localStorage.setItem(EDITOR_STORAGE_KEY, json);
  } catch {
    /* quota — hash / HTML still work */
  }

  const { url, mode } = await buildSharePreviewUrl(doc);
  const win = window.open(url, '_blank', 'noopener,noreferrer');

  if (!win) {
    downloadStandalonePreview(doc);
    toast('弹窗被拦截：已改为下载预览 HTML，可本机打开查看', 'warn');
    return;
  }

  if (mode === 'layout') {
    window.setTimeout(() => {
      void confirmDialog({
        title: '预览为布局版',
        message:
          '完整切图过大，当前预览链接仅含布局。是否再下载含完整资源的 HTML 供本机查看？',
        confirmLabel: '下载 HTML',
      }).then((ok) => {
        if (ok) downloadStandalonePreview(doc);
      });
    }, 300);
  }
}

export { buildStandalonePreviewHtml, downloadStandalonePreview };
