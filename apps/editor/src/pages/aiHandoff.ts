import JSZip from 'jszip';
import {
  serializeDocumentJson,
  serializeDocument,
  SCHEMA_VERSION,
  type Document,
  type Atlas,
  type SceneNode,
  type SpriteNode,
  getActivePage,
  walkNodes,
  flattenNodes,
  interactionTargetOf,
} from '@game-ui/document';
import { buildStandalonePreviewHtml } from './previewShare';
import {
  packAtlasBundle,
  safeAtlasFileBase,
  type PackedAtlasBundle,
} from './packAtlasBundle';

function safeFileName(name: string): string {
  return safeAtlasFileBase(name, 'ui');
}

function nodeSummaryLine(node: SceneNode, depth: number): string {
  const pad = '  '.repeat(depth);
  const t = node.transform;
  const bits = [
    `${node.type}`,
    `"${node.name}"`,
    `id=${node.id}`,
    node.role !== 'none' ? `role=${node.role}` : null,
    node.componentKey ? `key=${node.componentKey}` : null,
    `${Math.round(t.width)}×${Math.round(t.height)}`,
    `@(${Math.round(t.x)},${Math.round(t.y)})`,
  ].filter(Boolean);
  if (!node.visible) bits.push('hidden');
  if (node.locked) bits.push('locked');
  if (node.type === 'text') {
    const preview = (node.content || '').replace(/\s+/g, ' ').slice(0, 40);
    bits.push(`text="${preview}${node.content.length > 40 ? '…' : ''}"`);
    if (node.locKey) bits.push(`loc=${node.locKey}`);
  }
  if (node.type === 'sprite') bits.push(`asset=${node.assetId}`);
  if (node.layout?.mode && node.layout.mode !== 'none') {
    bits.push(`layout=${node.layout.mode}`);
  }
  return `${pad}- ${bits.join(' · ')}`;
}

function walkOutline(node: SceneNode, depth: number, lines: string[]): void {
  lines.push(nodeSummaryLine(node, depth));
  for (const child of node.children ?? []) {
    walkOutline(child, depth + 1, lines);
  }
}

export function buildLayerOutline(doc: Document): string {
  const page = getActivePage(doc);
  if (!page) return '(无页面)';
  const lines: string[] = [];
  walkOutline(page.root, 0, lines);
  return lines.join('\n');
}

/** Collect asset ids referenced by sprites under a root (incl. stateAssets). */
export function collectUsedAssetIds(root: SceneNode): Set<string> {
  const ids = new Set<string>();
  walkNodes(root, (node) => {
    if (node.type !== 'sprite') return;
    const sprite = node as SpriteNode;
    if (sprite.assetId) ids.add(sprite.assetId);
    if (sprite.stateAssets) {
      for (const v of Object.values(sprite.stateAssets)) {
        if (v) ids.add(v);
      }
    }
  });
  return ids;
}

/** Atlases that contain at least one asset used by the root. */
export function collectUsedAtlases(
  doc: Document,
  usedAssetIds: Set<string>
): Atlas[] {
  const atlasIds = new Set<string>();
  for (const a of doc.assets) {
    if (usedAssetIds.has(a.id)) atlasIds.add(a.atlasId);
  }
  return doc.atlases.filter((atlas) => atlasIds.has(atlas.id));
}

/**
 * Pack each used original atlas separately; file names follow atlas.name.
 * PNG meta.size is stamped from the actual canvas so UV never drifts.
 */
async function packUsedOriginalAtlases(
  doc: Document,
  usedAtlases: Atlas[]
): Promise<PackedAtlasBundle[]> {
  const results: PackedAtlasBundle[] = [];
  const usedBasenames = new Map<string, number>();

  for (const atlas of usedAtlases) {
    let base = safeFileName(atlas.name) || safeFileName(atlas.id) || 'atlas';
    const n = (usedBasenames.get(base) ?? 0) + 1;
    usedBasenames.set(base, n);
    if (n > 1) base = `${base}_${n}`;

    const assetsInAtlas = doc.assets.filter((a) => a.atlasId === atlas.id);
    const packed = await packAtlasBundle(atlas, assetsInAtlas, {
      pngFileName: `${base}.png`,
      jsonFileName: `${base}.json`,
    });
    if (packed) results.push(packed);
  }

  return results;
}

/**
 * Handoff document: active page Root only; assets/atlases from used original atlases.
 */
export function documentForActivePageHandoff(
  doc: Document,
  assetPathById: Map<string, string>
): Document {
  const page = getActivePage(doc);
  if (!page) {
    return documentForHandoffExport(doc, assetPathById);
  }

  const usedIds = collectUsedAssetIds(page.root);
  const usedAtlases = collectUsedAtlases(doc, usedIds);
  const usedAtlasIds = new Set(usedAtlases.map((a) => a.id));
  const exportAssets = doc.assets.filter((a) => usedAtlasIds.has(a.atlasId));

  const targets = new Set<string>();
  for (const n of flattenNodes(page.root)) {
    targets.add(interactionTargetOf(n));
    targets.add(n.id);
    if (n.componentKey?.trim()) targets.add(n.componentKey.trim());
  }
  const interactions = (doc.interactions ?? []).filter((i) =>
    targets.has(i.target)
  );

  const file = serializeDocument(doc);
  const clone = file.document;
  clone.pages = [structuredClone(page)];
  clone.activePageId = page.id;
  clone.atlases = usedAtlases.map((a) => structuredClone(a));
  if (
    clone.activeAtlasId &&
    !clone.atlases.some((a) => a.id === clone.activeAtlasId)
  ) {
    clone.activeAtlasId = clone.atlases[0]?.id ?? '';
  }
  clone.assets = exportAssets.map((a) => ({
    ...a,
    dataUrl: '',
    file: assetPathById.get(a.id),
  }));
  clone.interactions = interactions;
  return clone;
}

export function documentForHandoffExport(
  doc: Document,
  assetPathById: Map<string, string>
): Document {
  const file = serializeDocument(doc);
  const clone = file.document;
  clone.assets = clone.assets.map((a) => {
    const path = assetPathById.get(a.id);
    return {
      ...a,
      dataUrl: '',
      file: path,
    };
  });
  return clone;
}

/** Preview HTML for active page only, with assets from used atlases. */
export function buildHandoffPreviewHtml(doc: Document): string {
  const page = getActivePage(doc);
  if (!page) return buildStandalonePreviewHtml(doc);
  const usedIds = collectUsedAssetIds(page.root);
  const usedAtlases = collectUsedAtlases(doc, usedIds);
  const usedAtlasIds = new Set(usedAtlases.map((a) => a.id));
  const scoped: Document = {
    ...doc,
    pages: [page],
    activePageId: page.id,
    assets: doc.assets.filter((a) => usedAtlasIds.has(a.atlasId)),
    atlases: usedAtlases,
  };
  return buildStandalonePreviewHtml(scoped);
}

function listAtlasFiles(doc: Document): string {
  const page = getActivePage(doc);
  if (!page) return '（无）';
  const used = collectUsedAtlases(doc, collectUsedAssetIds(page.root));
  if (!used.length) return '（本界面未引用切图）';
  return used
    .map((a) => {
      const base = safeFileName(a.name) || a.id;
      return `- \`${base}.png\` / \`${base}.json\`（原图集「${a.name}」）`;
    })
    .join('\n');
}

export function buildAiHandoffBrief(doc: Document): string {
  const page = getActivePage(doc);
  const size = doc.designSize;
  const outline = buildLayerOutline(doc);
  const usedIds = page ? collectUsedAssetIds(page.root) : new Set<string>();
  const usedAtlases = page ? collectUsedAtlases(doc, usedIds) : [];
  const pageName = page?.name ?? doc.name;
  const rootName = page?.root.name ?? '(无)';

  return `# UI 交接说明（给实现方 / AI）

## 目标
请按本界面实现功能。权威数据是同目录文件；不要凭截图猜尺寸，也不要从 HTML 反推布局。

## 导出范围
- **仅当前界面 Root**：\`${rootName}\`（页面：${pageName}）
- 未包含项目中其它页面 / Root
- 图集按**原图集分别打包**（共 ${usedAtlases.length} 份），名字与编辑器中一致；未使用的图集不导出

## 交接包内容
| 文件 | 用途 |
|------|------|
| \`document.gameui.json\` | 当前 Root 节点树（无 base64；切图见各图集） |
| \`{图集名}.png\` / \`{图集名}.json\` | 每份用到的原图集各一对 |
| \`preview.html\` | 人眼参考预览（非契约） |
| \`README.md\` | 本说明 |

### 本包图集
${listAtlasFiles(doc)}

## 画板
- 文档名：${doc.name}
- 页面 / Root：${pageName} / ${rootName}
- 设计尺寸：${size.width}×${size.height}
- 方向：${doc.orientation}
- 适配：${doc.aspectMode}

## 图层树
\`\`\`
${outline}
\`\`\`

## 建议实现步骤
1. 读 \`document.gameui.json\` 还原节点树
2. 按 \`assets[].atlasId\` / \`assets[].file\` 找到对应 \`{图集名}.png\` + \`.json\`
3. 用图集 JSON：\`meta.size\` 必须与 PNG 像素宽高一致；\`assetFrames[assetId]\` → frames 键名取 UV
4. \`preview.html\` 仅供对照，布局以 JSON 为准

## 不要做
- 不要只用预览或截图当唯一依据
- 不要混用旧版图集 JSON 与新版 PNG（或反过来）——必须成对替换
- 不要合并或改名图集文件（保持与编辑器原图集一致）
- 不要擅自改设计尺寸与 Root 层级（除非产品要求）
`;
}

export function buildAiChatPaste(doc: Document): string {
  return `${buildAiHandoffBrief(doc)}

---
【请同时附上】AI 交接包 zip（document.gameui.json + 各原图集 png/json + preview.html + README.md）。
`;
}

export async function downloadAiHandoffZip(doc: Document): Promise<void> {
  const page = getActivePage(doc);
  if (!page) {
    throw new Error('没有可导出的界面 Root');
  }

  const usedIds = collectUsedAssetIds(page.root);
  const usedAtlases = collectUsedAtlases(doc, usedIds);

  const zip = new JSZip();
  const folder = `${safeFileName(doc.name)}-${safeFileName(page.root.name)}-ai-handoff`;
  const root = zip.folder(folder)!;

  const packedList = await packUsedOriginalAtlases(doc, usedAtlases);
  const assetPathById = new Map<string, string>();
  for (const packed of packedList) {
    root.file(packed.pngFileName, packed.pngBytes);
    root.file(packed.jsonFileName, packed.atlasJson);
    for (const assetId of packed.frameNameById.keys()) {
      assetPathById.set(assetId, packed.pngFileName);
    }
  }

  const handoffDoc = documentForActivePageHandoff(doc, assetPathById);

  root.file('README.md', buildAiHandoffBrief(doc));
  root.file(
    'document.gameui.json',
    JSON.stringify(
      { schemaVersion: SCHEMA_VERSION, document: handoffDoc },
      null,
      2
    )
  );
  root.file('preview.html', buildHandoffPreviewHtml(doc));

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${folder}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadDocumentJson(doc: Document): void {
  const page = getActivePage(doc);
  const usedIds = page ? collectUsedAssetIds(page.root) : new Set<string>();
  const usedAtlases = page ? collectUsedAtlases(doc, usedIds) : [];
  const usedAtlasIds = new Set(usedAtlases.map((a) => a.id));
  const scoped: Document = page
    ? {
        ...doc,
        pages: [page],
        activePageId: page.id,
        assets: doc.assets.filter((a) => usedAtlasIds.has(a.atlasId)),
        atlases: usedAtlases,
      }
    : doc;
  const json = serializeDocumentJson(scoped, true);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeFileName(doc.name)}.gameui.json`;
  a.click();
  URL.revokeObjectURL(url);
}
