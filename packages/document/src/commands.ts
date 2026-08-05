import type {
  Asset,
  Document,
  Page,
  SceneNode,
  TextNode,
  Transform,
  AutoLayout,
  NodeRole,
  NodeUiState,
  NodeBinding,
  InteractionSpec,
  Constraints,
  StateAssets,
} from './types';
import {
  createFrame,
  createGroup,
  createId,
  createRect,
  createSprite,
  createText,
} from './factory';
import {
  cloneNodeDeep,
  findNodeInDocument,
  flattenNodes,
  getActivePage,
} from './tree';
import {
  getNodeBoundsInParent,
  getNodeWorldBounds,
  getNodeWorldMatrix,
  setNodeVisualTopLeft,
  applyMat,
  invertMat,
} from './transform';
import { createAtlas } from './atlases';
import { applyAutoLayout } from './layout';
import { applyConstraintsToChildren } from './constraints';
import { upsertInteraction as upsertIx, removeInteraction as removeIx } from './interactions';
import { DEFAULT_CONSTRAINTS } from './types';
import { mergeStateAssets, normalizeTextShadow } from './visualState';

function ensureChildren(node: SceneNode): SceneNode[] {
  if (!node.children) {
    (node as SceneNode & { children: SceneNode[] }).children = [];
  }
  return node.children!;
}

export function addAsset(doc: Document, asset: Asset): void {
  if (!asset.atlasId) {
    asset.atlasId = doc.activeAtlasId;
  }
  doc.assets.push(asset);
}

/**
 * Find asset in an atlas by display name (trimmed, case-sensitive).
 */
export function findAssetByNameInAtlas(
  doc: Document,
  atlasId: string,
  name: string
): Asset | undefined {
  const key = name.trim();
  if (!key) return undefined;
  return doc.assets.find((a) => a.atlasId === atlasId && a.name === key);
}

/**
 * Add asset, or replace image/size of an existing same-name asset in the same atlas.
 * Keeps id / nineSlice so canvas sprites stay linked.
 */
export function upsertAssetByName(
  doc: Document,
  asset: Asset
): { asset: Asset; updated: boolean } {
  const atlasId = asset.atlasId || doc.activeAtlasId;
  const existing = findAssetByNameInAtlas(doc, atlasId, asset.name);
  if (existing) {
    updateAsset(doc, existing.id, {
      dataUrl: asset.dataUrl,
      width: asset.width,
      height: asset.height,
    });
    return { asset: existing, updated: true };
  }
  const next = { ...asset, atlasId };
  addAsset(doc, next);
  return { asset: next, updated: false };
}

export function removeAsset(doc: Document, assetId: string): void {
  doc.assets = doc.assets.filter((a) => a.id !== assetId);
}

export function updateAsset(
  doc: Document,
  assetId: string,
  patch: Partial<Pick<Asset, 'name' | 'dataUrl' | 'width' | 'height' | 'nineSlice' | 'atlasId'>>
): void {
  const asset = doc.assets.find((a) => a.id === assetId);
  if (!asset) return;
  if (patch.name !== undefined) asset.name = patch.name.trim() || asset.name;
  if (patch.dataUrl !== undefined) asset.dataUrl = patch.dataUrl;
  if (patch.width !== undefined) asset.width = patch.width;
  if (patch.height !== undefined) asset.height = patch.height;
  if ('nineSlice' in patch) {
    asset.nineSlice = patch.nineSlice;
  }
  if (patch.atlasId !== undefined && doc.atlases.some((a) => a.id === patch.atlasId)) {
    asset.atlasId = patch.atlasId;
  }
}

export function updateAssetNineSlice(
  doc: Document,
  assetId: string,
  nineSlice: Asset['nineSlice']
): void {
  updateAsset(doc, assetId, { nineSlice });
}

export function setActiveAtlas(doc: Document, atlasId: string): void {
  if (!doc.atlases.some((a) => a.id === atlasId)) return;
  doc.activeAtlasId = atlasId;
}

export function addAtlas(doc: Document, name: string): string {
  const atlas = createAtlas(name.trim() || '未命名图集');
  doc.atlases.push(atlas);
  doc.activeAtlasId = atlas.id;
  return atlas.id;
}

export function renameAtlas(doc: Document, atlasId: string, name: string): void {
  const atlas = doc.atlases.find((a) => a.id === atlasId);
  if (!atlas) return;
  atlas.name = name.trim() || atlas.name;
}

export function deleteAtlas(doc: Document, atlasId: string): void {
  if (doc.atlases.length <= 1) return;
  const idx = doc.atlases.findIndex((a) => a.id === atlasId);
  if (idx < 0) return;
  const fallback = doc.atlases.find((a) => a.id !== atlasId)!;
  doc.assets = doc.assets.filter((a) => a.atlasId !== atlasId);
  doc.atlases.splice(idx, 1);
  if (doc.activeAtlasId === atlasId) {
    doc.activeAtlasId = fallback.id;
  }
}

export function moveAssetToAtlas(doc: Document, assetId: string, atlasId: string): void {
  updateAsset(doc, assetId, { atlasId });
}

export function addNodeToActivePage(doc: Document, node: SceneNode, parentId?: string): void {
  const page = getActivePage(doc);
  if (!page) return;
  if (!parentId || parentId === page.root.id) {
    page.root.children.push(node);
    return;
  }
  const found = findNodeInDocument(doc, parentId);
  if (!found || !('children' in found.node)) return;
  ensureChildren(found.node).push(node);
}

export function addFrame(doc: Document, parentId?: string): SceneNode {
  const node = createFrame({
    name: 'Frame',
    fill: '#1a1d27',
    transform: {
      x: 80,
      y: 80,
      width: 100,
      height: 100,
      rotation: 0,
      opacity: 1,
    },
  });
  addNodeToActivePage(doc, node, parentId);
  return node;
}

export function addRect(doc: Document, parentId?: string): SceneNode {
  const node = createRect();
  addNodeToActivePage(doc, node, parentId);
  return node;
}

export function addText(doc: Document, parentId?: string): SceneNode {
  const node = createText();
  addNodeToActivePage(doc, node, parentId);
  return node;
}

export function updateTextNode(
  doc: Document,
  id: string,
  patch: Partial<
    Pick<
      TextNode,
      | 'content'
      | 'fontSize'
      | 'fontFamily'
      | 'fontWeight'
      | 'fontStyle'
      | 'color'
      | 'align'
      | 'verticalAlign'
      | 'lineHeight'
      | 'letterSpacing'
      | 'wordWrap'
      | 'strokeColor'
      | 'strokeWidth'
      | 'strokeOpacity'
      | 'shadow'
    >
  >
): void {
  const found = findNodeInDocument(doc, id);
  if (!found || found.node.type !== 'text' || found.node.locked) return;
  const node = found.node;
  if ('shadow' in patch) {
    if (patch.shadow == null) {
      node.shadow = undefined;
    } else {
      node.shadow = normalizeTextShadow({
        ...normalizeTextShadow(node.shadow),
        ...patch.shadow,
        enabled: patch.shadow.enabled ?? node.shadow?.enabled ?? true,
      });
    }
  }
  const { shadow: _ignored, ...rest } = patch;
  Object.assign(node, rest);
}

/** Patch sprite state→asset map (toggle off/on, tab unselected/selected). */
export function updateSpriteStateAssets(
  doc: Document,
  id: string,
  patch: StateAssets
): void {
  const found = findNodeInDocument(doc, id);
  if (!found || found.node.type !== 'sprite' || found.node.locked) return;
  found.node.stateAssets = mergeStateAssets(found.node.stateAssets, patch);
  if (patch.normal) found.node.assetId = patch.normal;
}

/**
 * Set activeState; for role `tab`, clear `selected` on sibling tab sprites.
 */
export function setNodeActiveState(
  doc: Document,
  id: string,
  state: NodeUiState
): void {
  const found = findNodeInDocument(doc, id);
  if (!found || found.node.locked) return;
  const node = found.node;
  if (!node.states.includes(state)) {
    node.states = [...node.states, state];
  }
  node.activeState = state;

  if (node.role === 'tab' && state === 'selected' && found.parent?.children) {
    for (const sib of found.parent.children) {
      if (sib.id === id || sib.role !== 'tab') continue;
      if (sib.activeState === 'selected') sib.activeState = 'normal';
      if (!sib.states.includes('normal')) sib.states = [...sib.states, 'normal'];
      if (!sib.states.includes('selected')) sib.states = [...sib.states, 'selected'];
    }
  }
}

export function addSpriteFromAsset(
  doc: Document,
  assetId: string,
  parentId?: string,
  position?: Partial<Transform>
): SceneNode | null {
  const asset = doc.assets.find((a) => a.id === assetId);
  if (!asset) return null;
  const node = createSprite(asset, position);
  addNodeToActivePage(doc, node, parentId);
  return node;
}

export function deleteNodes(doc: Document, ids: string[]): void {
  const page = getActivePage(doc);
  if (!page) return;
  const idSet = new Set(ids.filter((id) => id !== page.root.id));

  const removeFrom = (parent: SceneNode) => {
    if (!parent.children) return;
    parent.children = parent.children.filter((c) => {
      if (idSet.has(c.id)) return false;
      removeFrom(c);
      return true;
    });
  };
  removeFrom(page.root);
}

export function renameNode(doc: Document, id: string, name: string): void {
  const found = findNodeInDocument(doc, id);
  if (!found) return;
  found.node.name = name;
  // Keep page.name in sync when renaming a page Root
  if (found.page.root.id === id) {
    found.page.name = name;
  }
}

/** Create a new page with its own Root frame (designSize). Activates the new page. */
export function addPage(doc: Document, name?: string): Page {
  const n = doc.pages.length + 1;
  const pageName = name?.trim() || `界面 ${n}`;
  const root = createFrame({
    name: pageName,
    fill: '#1a1d27',
    transform: {
      x: 0,
      y: 0,
      width: doc.designSize.width,
      height: doc.designSize.height,
      rotation: 0,
      opacity: 1,
    },
  });
  const page: Page = {
    id: createId('page'),
    name: pageName,
    root,
  };
  doc.pages.push(page);
  doc.activePageId = page.id;
  return page;
}

export function setActivePage(doc: Document, pageId: string): boolean {
  if (!doc.pages.some((p) => p.id === pageId)) return false;
  doc.activePageId = pageId;
  return true;
}

export function setNodeLocked(doc: Document, id: string, locked: boolean): void {
  const found = findNodeInDocument(doc, id);
  if (found) found.node.locked = locked;
}

export function setNodeVisible(doc: Document, id: string, visible: boolean): void {
  const found = findNodeInDocument(doc, id);
  if (found) found.node.visible = visible;
}

export function setNodeTransform(
  doc: Document,
  id: string,
  transform: Partial<Transform>
): void {
  const found = findNodeInDocument(doc, id);
  if (!found || found.node.locked) return;
  const oldW = found.node.transform.width;
  const oldH = found.node.transform.height;
  found.node.transform = { ...found.node.transform, ...transform };
  const newW = found.node.transform.width;
  const newH = found.node.transform.height;
  if (
    (oldW !== newW || oldH !== newH) &&
    found.node.children?.length
  ) {
    applyConstraintsToChildren(found.node, oldW, oldH, newW, newH);
  }
}

export function setNodeConstraints(
  doc: Document,
  id: string,
  patch: Partial<Constraints>
): void {
  const found = findNodeInDocument(doc, id);
  if (!found || found.node.locked) return;
  found.node.constraints = {
    ...(found.node.constraints ?? DEFAULT_CONSTRAINTS),
    ...patch,
  };
}

export function reorderNode(
  doc: Document,
  id: string,
  direction: 'up' | 'down' | 'top' | 'bottom'
): void {
  const found = findNodeInDocument(doc, id);
  if (!found || !found.parent || !found.parent.children) return;
  const list = found.parent.children;
  const index = found.index;
  list.splice(index, 1);
  let next = index;
  if (direction === 'up') next = Math.max(0, index - 1);
  if (direction === 'down') next = Math.min(list.length, index);
  if (direction === 'top') next = 0;
  if (direction === 'bottom') next = list.length;
  list.splice(next, 0, found.node);
}

function isDescendant(ancestor: SceneNode, maybeChildId: string): boolean {
  if (!ancestor.children) return false;
  for (const c of ancestor.children) {
    if (c.id === maybeChildId) return true;
    if (isDescendant(c, maybeChildId)) return true;
  }
  return false;
}

/**
 * Move node among siblings or nest into target.
 * - mode 'before' | 'after': reorder relative to targetId (same parent as target)
 * - mode 'inside': become child of targetId
 */
export function moveLayerNode(
  doc: Document,
  nodeId: string,
  targetId: string,
  mode: 'before' | 'after' | 'inside'
): boolean {
  return moveLayerNodes(doc, [nodeId], targetId, mode);
}

/**
 * Move multiple nodes as a block (Unity/Figma-like hierarchy multi-drag).
 * Descendants of other moved ids are skipped so parents carry children.
 */
export function moveLayerNodes(
  doc: Document,
  nodeIds: string[],
  targetId: string,
  mode: 'before' | 'after' | 'inside'
): boolean {
  const page = getActivePage(doc);
  if (!page) return false;

  const unique = [...new Set(nodeIds)].filter(
    (id) => id !== page.root.id && id !== targetId
  );
  if (!unique.length) return false;

  // Only move top-level of selection (skip nodes nested under another selected id)
  const movingIds = unique.filter((id) => {
    return !unique.some((other) => {
      if (other === id) return false;
      const otherFound = findNodeInDocument(doc, other);
      return otherFound ? isDescendant(otherFound.node, id) : false;
    });
  });
  if (!movingIds.length) return false;

  for (const id of movingIds) {
    const found = findNodeInDocument(doc, id);
    if (!found) return false;
    if (isDescendant(found.node, targetId)) return false;
  }

  const target = findNodeInDocument(doc, targetId);
  if (!target) return false;

  const order = flattenNodes(page.root).map((n) => n.id);
  movingIds.sort((a, b) => order.indexOf(a) - order.indexOf(b));

  type Item = {
    node: SceneNode;
    worldBox: ReturnType<typeof getNodeWorldBounds>;
  };
  const collected: Item[] = [];
  for (const id of movingIds) {
    const found = findNodeInDocument(doc, id);
    if (!found || !found.parent?.children) continue;
    collected.push({
      node: found.node,
      worldBox: mode === 'inside' ? getNodeWorldBounds(page.root, id) : null,
    });
  }
  if (!collected.length) return false;

  for (const item of collected) {
    const found = findNodeInDocument(doc, item.node.id);
    if (found?.parent?.children) {
      found.parent.children.splice(found.index, 1);
    }
  }

  if (mode === 'inside') {
    const children = ensureChildren(target.node);
    for (const item of collected) {
      children.push(item.node);
      if (item.worldBox) {
        const parentMat = getNodeWorldMatrix(page.root, targetId);
        const inv = parentMat ? invertMat(parentMat) : null;
        if (inv) {
          const tl = applyMat(inv, item.worldBox.x, item.worldBox.y);
          setNodeVisualTopLeft(item.node, tl.x, tl.y);
        }
      }
    }
    applyAutoLayout(target.node);
    return true;
  }

  const parent = target.parent ?? page.root;
  const list = ensureChildren(parent);
  const idx = list.findIndex((c) => c.id === targetId);
  const nodes = collected.map((c) => c.node);
  if (idx < 0) {
    list.push(...nodes);
  } else {
    const at = mode === 'after' ? idx + 1 : idx;
    list.splice(at, 0, ...nodes);
  }
  applyAutoLayout(parent);
  return true;
}

export function updateNodeStyle(
  doc: Document,
  id: string,
  patch: Partial<{
    fill: string | undefined;
    fillOpacity: number;
    cornerRadius: number;
    strokeColor: string | undefined;
    strokeWidth: number;
    strokeOpacity: number;
    clipContent: boolean;
    scaleX: number;
    scaleY: number;
    layout: Partial<AutoLayout>;
  }>
): void {
  const found = findNodeInDocument(doc, id);
  if (!found || found.node.locked) return;
  const node = found.node;
  if ('fill' in patch) node.fill = patch.fill;
  if (patch.fillOpacity != null) node.fillOpacity = patch.fillOpacity;
  if (patch.cornerRadius != null) node.cornerRadius = Math.max(0, patch.cornerRadius);
  if ('strokeColor' in patch) node.strokeColor = patch.strokeColor;
  if (patch.strokeWidth != null) node.strokeWidth = Math.max(0, patch.strokeWidth);
  if (patch.strokeOpacity != null) {
    node.strokeOpacity = Math.min(1, Math.max(0, patch.strokeOpacity));
  }
  if (patch.clipContent != null) node.clipContent = patch.clipContent;
  if (patch.scaleX != null) node.scaleX = patch.scaleX;
  if (patch.scaleY != null) node.scaleY = patch.scaleY;
  if (patch.layout) {
    node.layout = { ...node.layout, ...patch.layout };
    applyAutoLayout(node);
  }
}

/** Reset sprite size to asset pixels, scale to 1, rotation to 0 (keeps x/y). */
export function resetSpriteGeometry(doc: Document, id: string): boolean {
  const found = findNodeInDocument(doc, id);
  if (!found || found.node.locked || found.node.type !== 'sprite') return false;
  const sprite = found.node;
  const asset = doc.assets.find((a) => a.id === sprite.assetId);
  if (!asset) return false;
  sprite.transform.width = Math.max(1, asset.width);
  sprite.transform.height = Math.max(1, asset.height);
  sprite.transform.rotation = 0;
  sprite.scaleX = 1;
  sprite.scaleY = 1;
  return true;
}

export function groupNodes(doc: Document, ids: string[]): string | null {
  if (ids.length < 1) return null;
  const page = getActivePage(doc);
  if (!page) return null;

  const nodes: SceneNode[] = [];
  let parent: SceneNode | null = null;

  for (const id of ids) {
    const found = findNodeInDocument(doc, id);
    if (!found || !found.parent) continue;
    if (!parent) parent = found.parent;
    if (found.parent !== parent) continue;
    nodes.push(found.node);
  }
  if (!parent || nodes.length < 1) return null;

  parent.children = parent.children!.filter((c) => !nodes.some((n) => n.id === c.id));
  const group = createGroup('Group', nodes);

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.transform.x);
    minY = Math.min(minY, n.transform.y);
    maxX = Math.max(maxX, n.transform.x + n.transform.width);
    maxY = Math.max(maxY, n.transform.y + n.transform.height);
  }
  group.transform = {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
    rotation: 0,
    opacity: 1,
  };
  for (const n of nodes) {
    n.transform.x -= minX;
    n.transform.y -= minY;
  }
  parent.children.push(group);
  return group.id;
}

export function duplicateNodes(doc: Document, ids: string[]): string[] {
  const created: string[] = [];
  for (const id of ids) {
    const found = findNodeInDocument(doc, id);
    if (!found || !found.parent || found.node === getActivePage(doc)?.root) continue;
    const clone = cloneNodeDeep(found.node);
    clone.transform.x += 16;
    clone.transform.y += 16;
    found.parent.children!.splice(found.index + 1, 0, clone);
    created.push(clone.id);
  }
  return created;
}

export function setDesignSize(
  doc: Document,
  width: number,
  height: number,
  orientation: Document['orientation']
): void {
  const page = getActivePage(doc);
  const oldW = page?.root.transform.width ?? doc.designSize.width;
  const oldH = page?.root.transform.height ?? doc.designSize.height;
  doc.designSize = { width, height };
  doc.orientation = orientation;
  if (page) {
    page.root.transform.width = width;
    page.root.transform.height = height;
    applyConstraintsToChildren(page.root, oldW, oldH, width, height);
  }
}

export type AlignMode =
  | 'left'
  | 'right'
  | 'top'
  | 'bottom'
  | 'center-h'
  | 'center-v'
  | 'distribute-h'
  | 'distribute-v';

/** Align selected nodes to each other (2+) or to the artboard (1). Uses visual AABB (pivot/scale/rotation). */
export function alignNodes(doc: Document, ids: string[], mode: AlignMode): void {
  const page = getActivePage(doc);
  if (!page) return;

  const nodes: SceneNode[] = [];
  for (const id of ids) {
    if (id === page.root.id) continue;
    const found = findNodeInDocument(doc, id);
    if (!found || found.node.locked) continue;
    nodes.push(found.node);
  }
  if (!nodes.length) return;

  const board = {
    x: 0,
    y: 0,
    width: page.root.transform.width,
    height: page.root.transform.height,
  };

  if (nodes.length === 1) {
    const n = nodes[0];
    const box = getNodeBoundsInParent(n);
    switch (mode) {
      case 'left':
        setNodeVisualTopLeft(n, board.x, box.y);
        break;
      case 'right':
        setNodeVisualTopLeft(n, board.x + board.width - box.width, box.y);
        break;
      case 'top':
        setNodeVisualTopLeft(n, box.x, board.y);
        break;
      case 'bottom':
        setNodeVisualTopLeft(n, box.x, board.y + board.height - box.height);
        break;
      case 'center-h':
        setNodeVisualTopLeft(
          n,
          board.x + (board.width - box.width) / 2,
          box.y
        );
        break;
      case 'center-v':
        setNodeVisualTopLeft(
          n,
          box.x,
          board.y + (board.height - box.height) / 2
        );
        break;
      default:
        break;
    }
    return;
  }

  const boxes = nodes.map((n) => ({ node: n, box: getNodeBoundsInParent(n) }));
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const { box } of boxes) {
    minX = Math.min(minX, box.x);
    minY = Math.min(minY, box.y);
    maxX = Math.max(maxX, box.x + box.width);
    maxY = Math.max(maxY, box.y + box.height);
  }
  const boundsW = maxX - minX;
  const boundsH = maxY - minY;

  switch (mode) {
    case 'left':
      for (const { node, box } of boxes) setNodeVisualTopLeft(node, minX, box.y);
      break;
    case 'right':
      for (const { node, box } of boxes)
        setNodeVisualTopLeft(node, maxX - box.width, box.y);
      break;
    case 'top':
      for (const { node, box } of boxes) setNodeVisualTopLeft(node, box.x, minY);
      break;
    case 'bottom':
      for (const { node, box } of boxes)
        setNodeVisualTopLeft(node, box.x, maxY - box.height);
      break;
    case 'center-h': {
      const cx = minX + boundsW / 2;
      for (const { node, box } of boxes)
        setNodeVisualTopLeft(node, cx - box.width / 2, box.y);
      break;
    }
    case 'center-v': {
      const cy = minY + boundsH / 2;
      for (const { node, box } of boxes)
        setNodeVisualTopLeft(node, box.x, cy - box.height / 2);
      break;
    }
    case 'distribute-h': {
      const sorted = [...boxes].sort((a, b) => a.box.x - b.box.x);
      if (sorted.length < 3) return;
      const first = sorted[0]!;
      const last = sorted[sorted.length - 1]!;
      const totalW = sorted.reduce((s, b) => s + b.box.width, 0);
      const span = last.box.x + last.box.width - first.box.x - totalW;
      const gap = span / (sorted.length - 1);
      let cursor = first.box.x + first.box.width;
      for (let i = 1; i < sorted.length - 1; i++) {
        const item = sorted[i]!;
        setNodeVisualTopLeft(item.node, cursor + gap, item.box.y);
        cursor = cursor + gap + item.box.width;
      }
      break;
    }
    case 'distribute-v': {
      const sorted = [...boxes].sort((a, b) => a.box.y - b.box.y);
      if (sorted.length < 3) return;
      const first = sorted[0]!;
      const last = sorted[sorted.length - 1]!;
      const totalH = sorted.reduce((s, b) => s + b.box.height, 0);
      const span = last.box.y + last.box.height - first.box.y - totalH;
      const gap = span / (sorted.length - 1);
      let cursor = first.box.y + first.box.height;
      for (let i = 1; i < sorted.length - 1; i++) {
        const item = sorted[i]!;
        setNodeVisualTopLeft(item.node, item.box.x, cursor + gap);
        cursor = cursor + gap + item.box.height;
      }
      break;
    }
    default:
      break;
  }
}

export function updateNodeSemantics(
  doc: Document,
  id: string,
  patch: Partial<{
    role: NodeRole;
    componentKey: string | undefined;
    states: NodeUiState[];
    activeState: NodeUiState;
    binding: NodeBinding | undefined;
    locKey: string | undefined;
    notes: string | undefined;
  }>
): void {
  const found = findNodeInDocument(doc, id);
  if (!found || found.node.locked) return;
  const node = found.node;
  if (patch.role != null) {
    node.role = patch.role;
    // Ensure toggle/tab participate in normal+selected for state art
    if (patch.role === 'toggle' || patch.role === 'tab') {
      const need = ['normal', 'selected'] as const;
      for (const s of need) {
        if (!node.states.includes(s)) node.states = [...node.states, s];
      }
    }
  }
  if ('componentKey' in patch) {
    const prevKey = node.componentKey?.trim();
    const nextKey = patch.componentKey?.trim() || undefined;
    node.componentKey = nextKey;

    if (!doc.interactions) doc.interactions = [];
    // Migrate interaction targets when Key changes (avoid orphan entries).
    if (prevKey && nextKey && prevKey !== nextKey) {
      for (const ix of doc.interactions) {
        if (ix.target === prevKey) ix.target = nextKey;
      }
    } else if (!prevKey && nextKey) {
      for (const ix of doc.interactions) {
        if (ix.target === node.id) ix.target = nextKey;
      }
    } else if (prevKey && !nextKey) {
      for (const ix of doc.interactions) {
        if (ix.target === prevKey) ix.target = node.id;
      }
    }
  }
  if (patch.states) {
    node.states = patch.states.length ? [...patch.states] : ['normal'];
    if (!node.states.includes(node.activeState)) {
      node.activeState = node.states[0] ?? 'normal';
    }
  }
  if (patch.activeState != null) {
    node.activeState = patch.activeState;
    if (!node.states.includes(node.activeState)) {
      node.states = [...node.states, node.activeState];
    }
  }
  if ('binding' in patch) {
    if (!patch.binding) node.binding = undefined;
    else {
      node.binding = {
        dataPath: patch.binding.dataPath?.trim() || undefined,
        event: patch.binding.event?.trim() || undefined,
      };
      if (!node.binding.dataPath && !node.binding.event) node.binding = undefined;
    }
  }
  if ('locKey' in patch) {
    const v = patch.locKey?.trim();
    node.locKey = v || undefined;
  }
  if ('notes' in patch) {
    const v = patch.notes?.trim();
    node.notes = v || undefined;
  }
}

export function upsertInteraction(doc: Document, spec: InteractionSpec): void {
  upsertIx(doc, spec);
}

export function removeInteraction(doc: Document, target: string): void {
  removeIx(doc, target);
}
