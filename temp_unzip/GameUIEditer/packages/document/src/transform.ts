import type { Pivot, SceneNode } from './types';
import { DEFAULT_PIVOT } from './types';

export type Rect = { x: number; y: number; width: number; height: number };

/** 2D affine matrix: [a c tx; b d ty; 0 0 1] */
export type Mat2D = {
  a: number;
  b: number;
  c: number;
  d: number;
  tx: number;
  ty: number;
};

export const IDENTITY_MAT: Mat2D = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };

export function resolvePivot(node: Pick<SceneNode, 'pivot'>): Pivot {
  const p = node.pivot ?? DEFAULT_PIVOT;
  return {
    x: Number.isFinite(p.x) ? p.x : DEFAULT_PIVOT.x,
    y: Number.isFinite(p.y) ? p.y : DEFAULT_PIVOT.y,
  };
}

export function multiplyMat(m1: Mat2D, m2: Mat2D): Mat2D {
  return {
    a: m1.a * m2.a + m1.c * m2.b,
    b: m1.b * m2.a + m1.d * m2.b,
    c: m1.a * m2.c + m1.c * m2.d,
    d: m1.b * m2.c + m1.d * m2.d,
    tx: m1.a * m2.tx + m1.c * m2.ty + m1.tx,
    ty: m1.b * m2.tx + m1.d * m2.ty + m1.ty,
  };
}

export function applyMat(m: Mat2D, x: number, y: number): { x: number; y: number } {
  return {
    x: m.a * x + m.c * y + m.tx,
    y: m.b * x + m.d * y + m.ty,
  };
}

export function invertMat(m: Mat2D): Mat2D | null {
  const det = m.a * m.d - m.b * m.c;
  if (Math.abs(det) < 1e-12) return null;
  const invDet = 1 / det;
  const a = m.d * invDet;
  const b = -m.b * invDet;
  const c = -m.c * invDet;
  const d = m.a * invDet;
  return {
    a,
    b,
    c,
    d,
    tx: -(a * m.tx + c * m.ty),
    ty: -(b * m.tx + d * m.ty),
  };
}

function translateMat(tx: number, ty: number): Mat2D {
  return { a: 1, b: 0, c: 0, d: 1, tx, ty };
}

function rotateMat(rad: number): Mat2D {
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { a: cos, b: sin, c: -sin, d: cos, tx: 0, ty: 0 };
}

function scaleMat(sx: number, sy: number): Mat2D {
  return { a: sx, b: 0, c: 0, d: sy, tx: 0, ty: 0 };
}

/**
 * Local→parent matrix matching Pixi: T(pos) · R · S · T(-pivot)
 * where pos = (x + pivotX, y + pivotY) and (x,y) is the unscaled box top-left.
 * Root nodes are identity (artboard origin).
 */
export function nodeLocalMatrix(node: SceneNode, isRoot: boolean): Mat2D {
  if (isRoot) return { ...IDENTITY_MAT };
  const t = node.transform;
  const pivot = resolvePivot(node);
  const px = pivot.x * t.width;
  const py = pivot.y * t.height;
  const sx = node.scaleX ?? 1;
  const sy = node.scaleY ?? 1;
  const rad = ((t.rotation ?? 0) * Math.PI) / 180;
  return multiplyMat(
    translateMat(t.x + px, t.y + py),
    multiplyMat(rotateMat(rad), multiplyMat(scaleMat(sx, sy), translateMat(-px, -py)))
  );
}

/** Axis-aligned bounds of the local box mapped by matrix. */
export function aabbFromMatrix(
  m: Mat2D,
  width: number,
  height: number
): Rect {
  const corners = [
    applyMat(m, 0, 0),
    applyMat(m, width, 0),
    applyMat(m, width, height),
    applyMat(m, 0, height),
  ];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of corners) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return {
    x: minX,
    y: minY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
  };
}

/** Visual AABB of node in its parent’s local space. */
export function getNodeBoundsInParent(node: SceneNode): Rect {
  return aabbFromMatrix(nodeLocalMatrix(node, false), node.transform.width, node.transform.height);
}

/**
 * Move node so its visual AABB top-left becomes (vx, vy) in parent space.
 * Keeps width/height/rotation/scale/pivot; only adjusts transform.x/y.
 */
export function setNodeVisualTopLeft(node: SceneNode, vx: number, vy: number): void {
  const before = getNodeBoundsInParent(node);
  node.transform.x += vx - before.x;
  node.transform.y += vy - before.y;
}

/** World (artboard) matrix for a node under root. */
export function getNodeWorldMatrix(root: SceneNode, nodeId: string): Mat2D | null {
  let result: Mat2D | null = null;

  function walk(node: SceneNode, parentMat: Mat2D, isRoot: boolean): boolean {
    const local = nodeLocalMatrix(node, isRoot);
    const world = isRoot ? parentMat : multiplyMat(parentMat, local);
    if (node.id === nodeId) {
      result = world;
      return true;
    }
    for (const child of node.children ?? []) {
      if (walk(child, world, false)) return true;
    }
    return false;
  }

  walk(root, IDENTITY_MAT, true);
  return result;
}

export function getNodeWorldBounds(root: SceneNode, nodeId: string): Rect | null {
  const found = findNodeMatrixAndSize(root, nodeId);
  if (!found) return null;
  return aabbFromMatrix(found.matrix, found.width, found.height);
}

function findNodeMatrixAndSize(
  root: SceneNode,
  nodeId: string
): { matrix: Mat2D; width: number; height: number } | null {
  let result: { matrix: Mat2D; width: number; height: number } | null = null;

  function walk(node: SceneNode, parentMat: Mat2D, isRoot: boolean): boolean {
    const local = nodeLocalMatrix(node, isRoot);
    const world = isRoot ? parentMat : multiplyMat(parentMat, local);
    if (node.id === nodeId) {
      result = {
        matrix: world,
        width: node.transform.width,
        height: node.transform.height,
      };
      return true;
    }
    for (const child of node.children ?? []) {
      if (walk(child, world, false)) return true;
    }
    return false;
  }

  walk(root, IDENTITY_MAT, true);
  return result;
}

/** Artboard position of local (0,0) — used when reparenting to keep the box corner stable. */
export function getLocalOriginWorldPos(
  root: SceneNode,
  nodeId: string
): { x: number; y: number } | null {
  const m = getNodeWorldMatrix(root, nodeId);
  if (!m) return null;
  return applyMat(m, 0, 0);
}
