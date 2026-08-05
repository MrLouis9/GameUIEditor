import {
  serializeDocumentJson,
  parseDocumentJson,
  resolveSpriteAssetId,
  normalizeTextShadow,
  type Document,
  type SceneNode,
  type SpriteNode,
  type TextNode,
} from '@game-ui/document';

export const PREVIEW_STORAGE_KEY = 'game-ui-editer:preview:v1';
export const EDITOR_STORAGE_KEY = 'game-ui-editer:document:v1';

/** Soft limit for hash-embedded share links (browsers vary; keep conservative). */
const MAX_HASH_CHARS = 700_000;

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64url.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function gzipEncode(text: string): Promise<string> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  const buf = await new Response(stream).arrayBuffer();
  return bytesToBase64Url(new Uint8Array(buf));
}

async function gzipDecode(b64url: string): Promise<string> {
  const bytes = base64UrlToBytes(b64url);
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}

/** Strip heavy image payloads so a layout-only share link still fits in the URL. */
export function documentForShareLink(doc: Document): Document {
  const clone = structuredClone(doc);
  clone.assets = clone.assets.map((a) => ({
    ...a,
    dataUrl: '',
  }));
  return clone;
}

export async function encodeDocumentToHash(doc: Document): Promise<{
  hash: string;
  mode: 'full' | 'layout';
}> {
  const fullJson = serializeDocumentJson(doc, false);
  const fullEncoded = await gzipEncode(fullJson);
  if (fullEncoded.length <= MAX_HASH_CHARS) {
    return { hash: `d1.${fullEncoded}`, mode: 'full' };
  }
  const layoutJson = serializeDocumentJson(documentForShareLink(doc), false);
  const layoutEncoded = await gzipEncode(layoutJson);
  return { hash: `d1.${layoutEncoded}`, mode: 'layout' };
}

export async function decodeDocumentFromHash(
  hash: string
): Promise<Document | null> {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!raw.startsWith('d1.')) return null;
  try {
    const json = await gzipDecode(raw.slice(3));
    return parseDocumentJson(json);
  } catch {
    return null;
  }
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function hexWithAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `#${full}${a}`;
}

function renderNodeHtml(node: SceneNode, isRoot: boolean): string {
  if (!node.visible && !isRoot) return '';

  const t = node.transform;
  const sx = node.scaleX ?? 1;
  const sy = node.scaleY ?? 1;
  const pivotX = ((node.pivot?.x ?? 0.5) * 100).toFixed(0);
  const pivotY = ((node.pivot?.y ?? 0.5) * 100).toFixed(0);
  const radius = node.cornerRadius ?? 0;
  const opacity = (t.opacity ?? 1) * (node.fillOpacity ?? 1);
  const styleParts = [
    'position:absolute',
    `left:${t.x}px`,
    `top:${t.y}px`,
    `width:${t.width}px`,
    `height:${t.height}px`,
    `opacity:${opacity}`,
    `transform:rotate(${t.rotation ?? 0}deg) scale(${sx},${sy})`,
    `transform-origin:${pivotX}% ${pivotY}%`,
    'box-sizing:border-box',
  ];
  if (radius > 0) styleParts.push(`border-radius:${radius}px`);
  if (node.clipContent) styleParts.push('overflow:hidden');

  if (node.type === 'rect' || node.type === 'frame' || node.type === 'group') {
    if (node.fill) styleParts.push(`background:${node.fill}`);
  }
  if ((node.strokeWidth ?? 0) > 0 && node.strokeColor) {
    styleParts.push(
      `border:${node.strokeWidth}px solid ${node.strokeColor}`,
      `outline-color:${node.strokeColor}`
    );
  }

  let inner = '';
  if (node.type === 'sprite') {
    const assetId = resolveSpriteAssetId(node as SpriteNode);
    inner = `<img data-asset-id="${esc(assetId)}" alt="${esc(node.name)}" style="width:100%;height:100%;object-fit:fill;display:block;pointer-events:none" />`;
  } else if (node.type === 'text') {
    const tn = node as TextNode;
    const align = tn.align === 'center' ? 'center' : tn.align === 'right' ? 'right' : 'left';
    styleParts.push(
      `color:${tn.color || '#fff'}`,
      `font-size:${tn.fontSize || 28}px`,
      `font-family:${esc(tn.fontFamily || 'sans-serif')}`,
      `font-weight:${tn.fontWeight || 'normal'}`,
      `font-style:${tn.fontStyle || 'normal'}`,
      `text-align:${align}`,
      'white-space:pre-wrap',
      'word-break:break-word',
      'display:flex',
      tn.verticalAlign === 'middle'
        ? 'align-items:center'
        : tn.verticalAlign === 'bottom'
          ? 'align-items:flex-end'
          : 'align-items:flex-start'
    );
    const shadow = normalizeTextShadow(tn.shadow);
    if (shadow.enabled) {
      styleParts.push(
        `text-shadow:${shadow.offsetX}px ${shadow.offsetY}px ${shadow.blur}px ${hexWithAlpha(shadow.color, shadow.alpha)}`
      );
    }
    inner = esc(tn.content ?? '');
  }

  const kids = (node.children ?? []).map((c) => renderNodeHtml(c, false)).join('');
  const rootExtra = isRoot
    ? 'position:relative;left:0;top:0;overflow:hidden;'
    : '';
  return `<div data-node="${esc(node.id)}" data-type="${node.type}" style="${rootExtra}${styleParts.join(';')}">${inner}${kids}</div>`;
}

/** Self-contained HTML preview — works offline / can be sent to AI without localhost. */
export function buildStandalonePreviewHtml(doc: Document): string {
  const page = doc.pages.find((p) => p.id === doc.activePageId) ?? doc.pages[0];
  const root = page?.root;
  const w = doc.designSize.width;
  const h = doc.designSize.height;
  const assetsJson = JSON.stringify(
    Object.fromEntries(doc.assets.map((a) => [a.id, a.dataUrl]))
  );
  const tree = root ? renderNodeHtml(root, true) : '';
  const docJson = serializeDocumentJson(doc, true);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(doc.name)} · UI Preview</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;background:#0b0e14;color:#e2e8f0;font-family:system-ui,sans-serif}
  header{display:flex;gap:12px;align-items:center;padding:10px 16px;border-bottom:1px solid #1e293b;font-size:12px;flex-wrap:wrap}
  header code{background:#1e293b;padding:2px 6px;border-radius:4px}
  main{padding:24px;display:flex;justify-content:center;overflow:auto;min-height:calc(100vh - 48px)}
  #stage{background:#111827;padding:24px;border-radius:8px}
  #artboard{width:${w}px;height:${h}px;position:relative;background:#1a1d27;box-shadow:0 0 0 1px #334155;overflow:hidden}
  details{margin-top:16px;max-width:960px}
  pre{white-space:pre-wrap;word-break:break-word;background:#020617;padding:12px;border-radius:8px;font-size:11px;max-height:40vh;overflow:auto}
</style>
</head>
<body>
<header>
  <strong>${esc(doc.name)}</strong>
  <span>${w}×${h}</span>
  <code>独立网页预览 · 可发给 AI 识别（含 Document JSON）</code>
</header>
<main>
  <div>
    <div id="stage"><div id="artboard">${tree}</div></div>
    <details open>
      <summary>Document JSON（AI 可按此还原界面）</summary>
      <pre id="json"></pre>
    </details>
  </div>
</main>
<script>
const ASSETS = ${assetsJson};
const DOC_JSON = ${JSON.stringify(docJson)};
document.getElementById('json').textContent = DOC_JSON;
for (const img of document.querySelectorAll('img[data-asset-id]')) {
  const id = img.getAttribute('data-asset-id');
  const src = ASSETS[id];
  if (src) img.src = src;
  else {
    img.replaceWith(Object.assign(document.createElement('div'), {
      style: 'width:100%;height:100%;background:#334155;display:flex;align-items:center;justify-content:center;font:12px sans-serif;color:#94a3b8',
      textContent: id || 'sprite'
    }));
  }
}
</script>
</body>
</html>`;
}

export function downloadStandalonePreview(doc: Document): void {
  const html = buildStandalonePreviewHtml(doc);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safe = doc.name.replace(/[\\/:*?"<>|]/g, '_') || 'ui-preview';
  a.href = url;
  a.download = `${safe}-preview.html`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function buildSharePreviewUrl(doc: Document): Promise<{
  url: string;
  mode: 'full' | 'layout';
}> {
  const { hash, mode } = await encodeDocumentToHash(doc);
  const url = new URL(window.location.href);
  url.searchParams.set('preview', '1');
  url.hash = hash;
  return { url: url.toString(), mode };
}
