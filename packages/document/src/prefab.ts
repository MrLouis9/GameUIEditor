import type {
  Asset,
  Atlas,
  Document,
  InteractionSpec,
  NineSlice,
  Page,
  SceneNode,
  SpriteNode,
} from './types';
import { SCHEMA_VERSION } from './types';
import { createAtlas } from './atlases';
import { createId } from './factory';
import { normalizeNodeDefaults } from './layout';
import { interactionTargetOf } from './interactions';
import { walkNodes, flattenNodes, getActivePage } from './tree';

/** Distinguishes page prefabs from full project documents. */
export const PREFAB_KIND = 'gameui.prefab' as const;

/** Atlas expected beside the prefab (exported separately from the editor). */
export interface PrefabAtlasRef {
  id: string;
  name: string;
  /** Expected PNG filename, e.g. `UI通用.png` */
  file: string;
  /** Expected TexturePacker-style JSON filename, e.g. `UI通用.json` */
  meta: string;
}

/**
 * Sprite reference without pixels.
 * Runtime: assetId → this row → open `atlases[].file` + look up `frames[frame]`.
 */
export interface PrefabAssetRef {
  id: string;
  name: string;
  atlasId: string;
  atlasName: string;
  /** Key inside atlas JSON `frames` (stable; matches atlas packer). */
  frame: string;
  width: number;
  height: number;
  nineSlice?: NineSlice;
}

/**
 * Single-screen “prefab”: layout + semantics + external atlas refs.
 * No base64 images — atlases are exported / versioned separately.
 */
export interface PrefabFile {
  schemaVersion: number;
  kind: typeof PREFAB_KIND;
  exportedAt: string;
  /** Display name for the screen (page / root). */
  name: string;
  designSize: { width: number; height: number };
  orientation: Document['orientation'];
  aspectMode: Document['aspectMode'];
  page: Page;
  interactions: InteractionSpec[];
  atlases: PrefabAtlasRef[];
  assets: PrefabAssetRef[];
  /**
   * How consumers resolve art (authoritative contract).
   * Do not invent alternate lookup rules.
   */
  resolve: {
    spriteAsset: 'stateAssets[activeState] ?? stateAssets.normal ?? assetId';
    frame: 'assets[id].frame inside atlases[atlasId].meta JSON frames';
  };
}

export type ApplyPrefabMode = 'replace-active' | 'add-page';

export interface ApplyPrefabResult {
  pageId: string;
  /** Prefab asset ids remapped onto existing editor assets */
  remappedAssets: number;
  /** New atlas rows created */
  createdAtlases: number;
  /** New asset stubs (empty dataUrl — import atlas ZIP to fill) */
  createdAssets: number;
}

function safeFileBase(name: string, fallback: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim() || fallback;
}

/** Same frame-key rules as editor atlas packer (unique within one atlas). */
export function buildFrameNameByAssetId(assetsInAtlas: Asset[]): Map<string, string> {
  const used = new Map<string, number>();
  const out = new Map<string, string>();
  for (const asset of assetsInAtlas) {
    let frame = safeFileBase(asset.name, asset.id);
    const n = (used.get(frame) ?? 0) + 1;
    used.set(frame, n);
    if (n > 1) frame = `${frame}_${n}`;
    out.set(asset.id, frame);
  }
  return out;
}

function collectUsedAssetIds(root: SceneNode): Set<string> {
  const ids = new Set<string>();
  walkNodes(root, (node) => {
    if (node.iconAssetId) ids.add(node.iconAssetId);
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

function collectPageInteractions(
  doc: Document,
  page: Page
): InteractionSpec[] {
  const targets = new Set<string>();
  for (const n of flattenNodes(page.root)) {
    targets.add(interactionTargetOf(n));
    targets.add(n.id);
    if (n.componentKey?.trim()) targets.add(n.componentKey.trim());
  }
  return (doc.interactions ?? []).filter((i) => targets.has(i.target));
}

export function isPrefabFile(raw: unknown): raw is PrefabFile {
  if (!raw || typeof raw !== 'object') return false;
  const o = raw as Record<string, unknown>;
  return o.kind === PREFAB_KIND && !!o.page && Array.isArray(o.assets);
}

/**
 * Build a round-trippable screen prefab from the active page.
 * Images are omitted; `atlases[].file/meta` match dock “保存图集” naming.
 */
export function buildPrefabFromDocument(doc: Document): PrefabFile {
  const page = getActivePage(doc);
  if (!page) {
    throw new Error('没有可导出的界面');
  }

  const usedIds = collectUsedAssetIds(page.root);
  const usedAtlasIds = new Set<string>();
  for (const a of doc.assets) {
    if (usedIds.has(a.id)) usedAtlasIds.add(a.atlasId);
  }
  const usedAtlases = doc.atlases.filter((a) => usedAtlasIds.has(a.id));

  const atlases: PrefabAtlasRef[] = usedAtlases.map((atlas) => {
    const base = safeFileBase(atlas.name, atlas.id);
    return {
      id: atlas.id,
      name: atlas.name,
      file: `${base}.png`,
      meta: `${base}.json`,
    };
  });

  const assets: PrefabAssetRef[] = [];
  for (const atlas of usedAtlases) {
    const inAtlas = doc.assets.filter((a) => a.atlasId === atlas.id);
    // Prefer exporting only used frames; still compute uniqueness on full atlas
    // so frame keys stay identical to a full atlas export of the same atlas.
    const frameById = buildFrameNameByAssetId(inAtlas);
    for (const asset of inAtlas) {
      if (!usedIds.has(asset.id)) continue;
      assets.push({
        id: asset.id,
        name: asset.name,
        atlasId: atlas.id,
        atlasName: atlas.name,
        frame: frameById.get(asset.id) ?? safeFileBase(asset.name, asset.id),
        width: asset.width,
        height: asset.height,
        nineSlice: asset.nineSlice
          ? { ...asset.nineSlice }
          : undefined,
      });
    }
  }

  const pageClone = structuredClone(page);
  normalizeNodeDefaults(pageClone.root);

  return {
    schemaVersion: SCHEMA_VERSION,
    kind: PREFAB_KIND,
    exportedAt: new Date().toISOString(),
    name: pageClone.root.name || pageClone.name || doc.name,
    designSize: { ...doc.designSize },
    orientation: doc.orientation,
    aspectMode: doc.aspectMode,
    page: pageClone,
    interactions: structuredClone(collectPageInteractions(doc, page)),
    atlases,
    assets,
    resolve: {
      spriteAsset: 'stateAssets[activeState] ?? stateAssets.normal ?? assetId',
      frame: 'assets[id].frame inside atlases[atlasId].meta JSON frames',
    },
  };
}

export function serializePrefabJson(prefab: PrefabFile, pretty = true): string {
  return JSON.stringify(prefab, null, pretty ? 2 : undefined);
}

export function parsePrefabJson(json: string): PrefabFile {
  const raw = JSON.parse(json) as unknown;
  if (!isPrefabFile(raw)) {
    throw new Error('不是有效的 gameui.prefab 文件');
  }
  if (raw.page?.root) normalizeNodeDefaults(raw.page.root);
  return raw;
}

function ensureAtlas(
  doc: Document,
  ref: PrefabAtlasRef
): { atlas: Atlas; created: boolean } {
  const byId = doc.atlases.find((a) => a.id === ref.id);
  if (byId) {
    if (ref.name && byId.name !== ref.name) byId.name = ref.name;
    return { atlas: byId, created: false };
  }
  const byName = doc.atlases.find((a) => a.name === ref.name);
  if (byName) return { atlas: byName, created: false };

  const atlas = createAtlas(ref.name || '图集', ref.id);
  doc.atlases.push(atlas);
  if (!doc.activeAtlasId) doc.activeAtlasId = atlas.id;
  return { atlas, created: true };
}

function remapSpriteAssetIds(
  root: SceneNode,
  map: Map<string, string>
): void {
  if (map.size === 0) return;
  walkNodes(root, (node) => {
    if (node.iconAssetId) {
      const iconNext = map.get(node.iconAssetId);
      if (iconNext) node.iconAssetId = iconNext;
    }
    if (node.type !== 'sprite') return;
    const sprite = node as SpriteNode;
    const next = map.get(sprite.assetId);
    if (next) sprite.assetId = next;
    if (sprite.stateAssets) {
      for (const [k, v] of Object.entries(sprite.stateAssets)) {
        if (!v) continue;
        const m = map.get(v);
        if (m) {
          sprite.stateAssets![k as keyof typeof sprite.stateAssets] = m;
        }
      }
    }
  });
}

/**
 * Merge a prefab into an open document (round-trip edit).
 * Keeps existing `dataUrl` when asset id / (atlas+name) already exists.
 * Missing pixels stay empty — re-import atlas ZIP or re-upload sprites.
 */
export function applyPrefabToDocument(
  doc: Document,
  prefab: PrefabFile,
  mode: ApplyPrefabMode = 'replace-active'
): ApplyPrefabResult {
  let createdAtlases = 0;
  let createdAssets = 0;
  let remappedAssets = 0;

  const atlasIdMap = new Map<string, string>(); // prefab atlasId → doc atlasId
  for (const ref of prefab.atlases) {
    const { atlas, created } = ensureAtlas(doc, ref);
    if (created) createdAtlases += 1;
    atlasIdMap.set(ref.id, atlas.id);
  }

  const assetIdMap = new Map<string, string>(); // prefab assetId → doc assetId

  for (const ref of prefab.assets) {
    const targetAtlasId = atlasIdMap.get(ref.atlasId) ?? ref.atlasId;
    const byId = doc.assets.find((a) => a.id === ref.id);
    if (byId) {
      byId.name = ref.name;
      byId.atlasId = targetAtlasId;
      byId.width = ref.width;
      byId.height = ref.height;
      if (ref.nineSlice) byId.nineSlice = { ...ref.nineSlice };
      // keep dataUrl
      assetIdMap.set(ref.id, byId.id);
      continue;
    }

    const byName = doc.assets.find(
      (a) => a.atlasId === targetAtlasId && a.name === ref.name
    );
    if (byName) {
      byName.width = ref.width;
      byName.height = ref.height;
      if (ref.nineSlice) byName.nineSlice = { ...ref.nineSlice };
      assetIdMap.set(ref.id, byName.id);
      if (byName.id !== ref.id) remappedAssets += 1;
      continue;
    }

    const stub: Asset = {
      id: ref.id,
      name: ref.name,
      atlasId: targetAtlasId,
      width: ref.width,
      height: ref.height,
      dataUrl: '',
      nineSlice: ref.nineSlice ? { ...ref.nineSlice } : undefined,
      file: prefab.atlases.find((a) => a.id === ref.atlasId)?.file,
    };
    doc.assets.push(stub);
    assetIdMap.set(ref.id, stub.id);
    createdAssets += 1;
  }

  const pageClone = structuredClone(prefab.page);
  normalizeNodeDefaults(pageClone.root);
  remapSpriteAssetIds(pageClone.root, assetIdMap);

  // Fix atlas ids on page assets already handled; ensure root size matches prefab design
  if (
    pageClone.root.transform.width !== prefab.designSize.width ||
    pageClone.root.transform.height !== prefab.designSize.height
  ) {
    // Prefer prefab root transform (authoritative layout box)
  }

  let pageId: string;
  if (mode === 'add-page') {
    pageClone.id = createId('page');
    doc.pages.push(pageClone);
    doc.activePageId = pageClone.id;
    pageId = pageClone.id;
  } else {
    const active = getActivePage(doc);
    if (!active) {
      doc.pages.push(pageClone);
      doc.activePageId = pageClone.id;
      pageId = pageClone.id;
    } else {
      active.id = pageClone.id || active.id;
      active.name = pageClone.name;
      active.root = pageClone.root;
      pageId = active.id;
      doc.activePageId = pageId;
    }
  }

  // Adopt design size from prefab so layout matches external projects
  doc.designSize = { ...prefab.designSize };
  doc.orientation = prefab.orientation;
  doc.aspectMode = prefab.aspectMode;

  // Replace interactions for targets in this page; keep others
  const pageTargets = new Set<string>();
  for (const n of flattenNodes(pageClone.root)) {
    pageTargets.add(interactionTargetOf(n));
    pageTargets.add(n.id);
    if (n.componentKey?.trim()) pageTargets.add(n.componentKey.trim());
  }
  const kept = (doc.interactions ?? []).filter((i) => !pageTargets.has(i.target));
  doc.interactions = [...kept, ...structuredClone(prefab.interactions ?? [])];

  return {
    pageId,
    remappedAssets,
    createdAtlases,
    createdAssets,
  };
}

/** Runtime helper: assetId → atlas files + frame key. */
export function resolvePrefabAsset(
  prefab: PrefabFile,
  assetId: string
): {
  asset: PrefabAssetRef;
  atlas: PrefabAtlasRef;
} | null {
  const asset = prefab.assets.find((a) => a.id === assetId);
  if (!asset) return null;
  const atlas =
    prefab.atlases.find((a) => a.id === asset.atlasId) ??
    prefab.atlases.find((a) => a.name === asset.atlasName);
  if (!atlas) return null;
  return { asset, atlas };
}
