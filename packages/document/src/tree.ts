import type { Document, Page, SceneNode } from './types';

export function getActivePage(doc: Document): Page | undefined {
  return doc.pages.find((p) => p.id === doc.activePageId) ?? doc.pages[0];
}

export function findNode(
  nodes: SceneNode[],
  id: string
): { node: SceneNode; parent: SceneNode | null; index: number } | null {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.id === id) {
      return { node, parent: null, index: i };
    }
    if (node.children) {
      const nested = findNodeInParent(node, id);
      if (nested) return nested;
    }
  }
  return null;
}

function findNodeInParent(
  parent: SceneNode,
  id: string
): { node: SceneNode; parent: SceneNode; index: number } | null {
  if (!parent.children) return null;
  for (let i = 0; i < parent.children.length; i++) {
    const child = parent.children[i];
    if (child.id === id) {
      return { node: child, parent, index: i };
    }
    if (child.children) {
      const nested = findNodeInParent(child, id);
      if (nested) return nested;
    }
  }
  return null;
}

export function findNodeInDocument(
  doc: Document,
  id: string
): { node: SceneNode; parent: SceneNode | null; index: number; page: Page } | null {
  for (const page of doc.pages) {
    if (page.root.id === id) {
      return { node: page.root, parent: null, index: 0, page };
    }
    const found = findNodeInParent(page.root, id);
    if (found) {
      return { ...found, page };
    }
  }
  return null;
}

/**
 * Ancestor ids from root down to (but not including) `targetId`.
 * Empty if target is missing or is the root itself.
 */
export function getNodeAncestorIds(
  root: SceneNode,
  targetId: string
): string[] {
  if (root.id === targetId) return [];
  const path: string[] = [];
  const walk = (node: SceneNode, ancestors: string[]): boolean => {
    if (node.id === targetId) {
      path.push(...ancestors);
      return true;
    }
    for (const child of node.children ?? []) {
      if (walk(child, [...ancestors, node.id])) return true;
    }
    return false;
  };
  walk(root, []);
  return path;
}

export function isDescendantOf(ancestor: SceneNode, maybeChildId: string): boolean {
  if (!ancestor.children) return false;
  for (const c of ancestor.children) {
    if (c.id === maybeChildId) return true;
    if (isDescendantOf(c, maybeChildId)) return true;
  }
  return false;
}

/** True if nodeId is selected or nested under any selected node. */
export function isUnderSelection(
  doc: Document,
  nodeId: string,
  selectedIds: string[]
): boolean {
  if (selectedIds.includes(nodeId)) return true;
  for (const sid of selectedIds) {
    const found = findNodeInDocument(doc, sid);
    if (found && isDescendantOf(found.node, nodeId)) return true;
  }
  return false;
}

/**
 * Keep only top-level selected ids (drop ids whose ancestor is also selected).
 * Moving these translates children with them.
 */
export function filterTopLevelNodeIds(doc: Document, ids: string[]): string[] {
  return ids.filter((id) => {
    const found = findNodeInDocument(doc, id);
    if (!found) return false;
    const ancestors = getNodeAncestorIds(found.page.root, id);
    return !ancestors.some((a) => ids.includes(a));
  });
}

export function walkNodes(node: SceneNode, visit: (n: SceneNode) => void): void {
  visit(node);
  if (node.children) {
    for (const child of node.children) {
      walkNodes(child, visit);
    }
  }
}

export function cloneNodeDeep(node: SceneNode, idMap?: Map<string, string>): SceneNode {
  const newId = `${node.type}_${Math.random().toString(36).slice(2, 10)}`;
  idMap?.set(node.id, newId);
  const cloned: SceneNode = {
    ...structuredClone(node),
    id: newId,
  };
  if (cloned.children) {
    cloned.children = cloned.children.map((c) => cloneNodeDeep(c, idMap));
  }
  return cloned;
}

export function flattenNodes(root: SceneNode): SceneNode[] {
  const list: SceneNode[] = [];
  walkNodes(root, (n) => list.push(n));
  return list;
}

/** Node transform origin in artboard space (matches Pixi parent scale chain). */
export interface AbsoluteOrigin {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
}

export function getNodeAbsoluteOrigin(
  root: SceneNode,
  nodeId: string
): AbsoluteOrigin | null {
  let result: AbsoluteOrigin | null = null;

  function walk(
    node: SceneNode,
    parentX: number,
    parentY: number,
    parentScaleX: number,
    parentScaleY: number,
    isRoot: boolean
  ): boolean {
    const sx = parentScaleX * (node.scaleX ?? 1);
    const sy = parentScaleY * (node.scaleY ?? 1);
    const x = isRoot ? parentX : parentX + node.transform.x * parentScaleX;
    const y = isRoot ? parentY : parentY + node.transform.y * parentScaleY;

    if (node.id === nodeId) {
      result = { x, y, scaleX: sx, scaleY: sy };
      return true;
    }
    for (const child of node.children ?? []) {
      if (walk(child, x, y, sx, sy, false)) return true;
    }
    return false;
  }

  walk(root, 0, 0, 1, 1, true);
  return result;
}
