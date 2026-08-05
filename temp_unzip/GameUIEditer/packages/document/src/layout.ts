import type { AutoLayout, SceneNode } from './types';
import { DEFAULT_CONSTRAINTS, DEFAULT_LAYOUT, DEFAULT_PIVOT } from './types';

export function normalizeNodeDefaults(node: SceneNode): void {
  if (node.scaleX == null) node.scaleX = 1;
  if (node.scaleY == null) node.scaleY = 1;
  if (!node.pivot) {
    node.pivot = { ...DEFAULT_PIVOT };
  } else {
    node.pivot = {
      x: node.pivot.x ?? DEFAULT_PIVOT.x,
      y: node.pivot.y ?? DEFAULT_PIVOT.y,
    };
  }
  if (node.fillOpacity == null) node.fillOpacity = 1;
  if (node.cornerRadius == null) node.cornerRadius = 0;
  if (node.strokeWidth == null) node.strokeWidth = 0;
  if (node.strokeOpacity == null) node.strokeOpacity = 1;
  if (node.clipContent == null) node.clipContent = false;
  if (!node.layout) node.layout = { ...DEFAULT_LAYOUT };
  else node.layout = { ...DEFAULT_LAYOUT, ...node.layout };
  if (!node.constraints) {
    node.constraints = { ...DEFAULT_CONSTRAINTS };
  } else {
    node.constraints = {
      horizontal: node.constraints.horizontal ?? 'left',
      vertical: node.constraints.vertical ?? 'top',
    };
  }
  if (!node.role) node.role = 'none';
  if (!node.states || node.states.length === 0) node.states = ['normal'];
  if (!node.activeState) node.activeState = 'normal';
  if (node.componentKey === '') node.componentKey = undefined;
  if (node.locKey === '') node.locKey = undefined;
  if (node.notes === '') node.notes = undefined;
  if (node.children) {
    for (const child of node.children) normalizeNodeDefaults(child);
  }
}

/** Position children according to auto-layout. Mutates child transforms. */
export function applyAutoLayout(parent: SceneNode): void {
  const layout = parent.layout ?? DEFAULT_LAYOUT;
  if (!parent.children || layout.mode === 'none' || parent.children.length === 0) {
    return;
  }

  const pad = layout.padding || 0;
  const gap = layout.gap || 0;
  const kids = parent.children.filter((c) => c.visible);
  if (!kids.length) return;

  const innerW = Math.max(0, parent.transform.width - pad * 2);
  const innerH = Math.max(0, parent.transform.height - pad * 2);

  if (layout.mode === 'horizontal') {
    const totalChildW = kids.reduce((s, c) => s + c.transform.width * (c.scaleX || 1), 0);
    const totalGaps = gap * Math.max(0, kids.length - 1);
    let x = pad;
    if (layout.primaryAlign === 'center') {
      x = pad + (innerW - totalChildW - totalGaps) / 2;
    } else if (layout.primaryAlign === 'end') {
      x = pad + (innerW - totalChildW - totalGaps);
    } else if (layout.primaryAlign === 'space-between' && kids.length > 1) {
      const free = Math.max(0, innerW - totalChildW);
      const step = free / (kids.length - 1);
      let cursor = pad;
      for (const child of kids) {
        const h = child.transform.height * (child.scaleY || 1);
        child.transform.x = cursor;
        child.transform.y = alignCross(pad, innerH, h, layout.counterAlign);
        cursor += child.transform.width * (child.scaleX || 1) + step;
      }
      return;
    }
    for (const child of kids) {
      const h = child.transform.height * (child.scaleY || 1);
      child.transform.x = x;
      child.transform.y = alignCross(pad, innerH, h, layout.counterAlign);
      x += child.transform.width * (child.scaleX || 1) + gap;
    }
    return;
  }

  if (layout.mode === 'vertical') {
    const totalChildH = kids.reduce((s, c) => s + c.transform.height * (c.scaleY || 1), 0);
    const totalGaps = gap * Math.max(0, kids.length - 1);
    let y = pad;
    if (layout.primaryAlign === 'center') {
      y = pad + (innerH - totalChildH - totalGaps) / 2;
    } else if (layout.primaryAlign === 'end') {
      y = pad + (innerH - totalChildH - totalGaps);
    } else if (layout.primaryAlign === 'space-between' && kids.length > 1) {
      const free = Math.max(0, innerH - totalChildH);
      const step = free / (kids.length - 1);
      let cursor = pad;
      for (const child of kids) {
        const w = child.transform.width * (child.scaleX || 1);
        child.transform.y = cursor;
        child.transform.x = alignCross(pad, innerW, w, layout.counterAlign);
        cursor += child.transform.height * (child.scaleY || 1) + step;
      }
      return;
    }
    for (const child of kids) {
      const w = child.transform.width * (child.scaleX || 1);
      child.transform.y = y;
      child.transform.x = alignCross(pad, innerW, w, layout.counterAlign);
      y += child.transform.height * (child.scaleY || 1) + gap;
    }
    return;
  }

  if (layout.mode === 'grid') {
    const cols = Math.max(1, layout.columns || 1);
    kids.forEach((child, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cellW =
        (innerW - gap * Math.max(0, cols - 1)) / cols;
      child.transform.x = pad + col * (cellW + gap);
      child.transform.y = pad + row * ((child.transform.height * (child.scaleY || 1)) + gap);
      void cellW;
    });
  }
}

function alignCross(
  pad: number,
  inner: number,
  size: number,
  align: AutoLayout['counterAlign']
): number {
  if (align === 'center') return pad + (inner - size) / 2;
  if (align === 'end') return pad + (inner - size);
  return pad;
}
