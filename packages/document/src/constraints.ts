import type { Constraints, SceneNode } from './types';
import { DEFAULT_CONSTRAINTS } from './types';
import { getNodeBoundsInParent, setNodeVisualTopLeft } from './transform';

/**
 * Reposition / resize a child when its parent size changes.
 * Uses Figma-like horizontal/vertical constraints on the **visual AABB**
 * (pivot + scale + rotation aware).
 */
export function applyConstraintToChild(
  child: SceneNode,
  parentOldW: number,
  parentOldH: number,
  parentNewW: number,
  parentNewH: number
): void {
  if (parentOldW <= 0 || parentOldH <= 0) return;
  if (parentOldW === parentNewW && parentOldH === parentNewH) return;

  const c: Constraints = child.constraints ?? DEFAULT_CONSTRAINTS;
  const t = child.transform;
  const prevW = t.width;
  const prevH = t.height;
  const box = getNodeBoundsInParent(child);

  // Horizontal — margins from visual AABB
  const rightMargin = parentOldW - box.x - box.width;
  const centerOffsetX = box.x + box.width / 2 - parentOldW / 2;
  switch (c.horizontal) {
    case 'left':
      break;
    case 'right':
      setNodeVisualTopLeft(child, parentNewW - rightMargin - box.width, box.y);
      break;
    case 'center': {
      const nx = parentNewW / 2 + centerOffsetX - box.width / 2;
      setNodeVisualTopLeft(child, nx, box.y);
      break;
    }
    case 'left-right': {
      // Stretch unscaled width so visual width roughly follows (ignore rotation for stretch)
      const sx = child.scaleX || 1;
      const targetVisualW = Math.max(1, parentNewW - box.x - rightMargin);
      t.width = Math.max(1, targetVisualW / sx);
      setNodeVisualTopLeft(child, box.x, getNodeBoundsInParent(child).y);
      break;
    }
    case 'scale': {
      const sx = parentNewW / parentOldW;
      t.x *= sx;
      t.width = Math.max(1, t.width * sx);
      break;
    }
  }

  const boxAfterH = getNodeBoundsInParent(child);

  // Vertical
  const bottomMargin = parentOldH - box.y - box.height;
  const centerOffsetY = box.y + box.height / 2 - parentOldH / 2;
  switch (c.vertical) {
    case 'top':
      break;
    case 'bottom':
      setNodeVisualTopLeft(
        child,
        boxAfterH.x,
        parentNewH - bottomMargin - boxAfterH.height
      );
      break;
    case 'center': {
      const ny = parentNewH / 2 + centerOffsetY - boxAfterH.height / 2;
      setNodeVisualTopLeft(child, boxAfterH.x, ny);
      break;
    }
    case 'top-bottom': {
      const sy = child.scaleY || 1;
      const targetVisualH = Math.max(1, parentNewH - boxAfterH.y - bottomMargin);
      t.height = Math.max(1, targetVisualH / sy);
      setNodeVisualTopLeft(child, boxAfterH.x, boxAfterH.y);
      break;
    }
    case 'scale': {
      const sy = parentNewH / parentOldH;
      t.y *= sy;
      t.height = Math.max(1, t.height * sy);
      break;
    }
  }

  if (
    child.children?.length &&
    (t.width !== prevW || t.height !== prevH)
  ) {
    applyConstraintsToChildren(child, prevW, prevH, t.width, t.height);
  }
}

export function applyConstraintsToChildren(
  parent: SceneNode,
  parentOldW: number,
  parentOldH: number,
  parentNewW: number,
  parentNewH: number
): void {
  if (!parent.children?.length) return;
  if (parent.layout?.mode && parent.layout.mode !== 'none') return;

  for (const child of parent.children) {
    applyConstraintToChild(
      child,
      parentOldW,
      parentOldH,
      parentNewW,
      parentNewH
    );
  }
}
