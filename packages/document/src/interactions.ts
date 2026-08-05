import type { Document, InteractionSpec, SceneNode } from './types';
import { flattenNodes, getActivePage } from './tree';

/** Resolve interaction target: componentKey preferred, else node id. */
export function interactionTargetOf(node: SceneNode): string {
  return node.componentKey?.trim() || node.id;
}

export function findInteraction(
  doc: Document,
  target: string
): InteractionSpec | undefined {
  return (doc.interactions ?? []).find((i) => i.target === target);
}

export function findInteractionForNode(
  doc: Document,
  node: SceneNode
): InteractionSpec | undefined {
  const key = node.componentKey?.trim();
  if (key) {
    const byKey = findInteraction(doc, key);
    if (byKey) return byKey;
  }
  return findInteraction(doc, node.id);
}

export function upsertInteraction(
  doc: Document,
  spec: InteractionSpec
): void {
  if (!doc.interactions) doc.interactions = [];
  const target = spec.target.trim();
  if (!target) return;
  const idx = doc.interactions.findIndex((i) => i.target === target);
  const next: InteractionSpec = {
    target,
    onClick: emptyToUndef(spec.onClick),
    navigate: emptyToUndef(spec.navigate),
    api: emptyToUndef(spec.api),
    animation: emptyToUndef(spec.animation),
    notes: emptyToUndef(spec.notes),
  };
  const hasAny =
    next.onClick || next.navigate || next.api || next.animation || next.notes;
  if (!hasAny) {
    if (idx >= 0) doc.interactions.splice(idx, 1);
    return;
  }
  if (idx >= 0) doc.interactions[idx] = next;
  else doc.interactions.push(next);
}

export function removeInteraction(doc: Document, target: string): void {
  if (!doc.interactions) return;
  doc.interactions = doc.interactions.filter((i) => i.target !== target);
}

function emptyToUndef(v?: string): string | undefined {
  const t = v?.trim();
  return t ? t : undefined;
}

/** Acceptance checklist for AI implementers. */
export function buildAcceptanceChecklist(doc: Document): string {
  const page = getActivePage(doc);
  const nodes = page ? flattenNodes(page.root) : [];
  const interactive = nodes.filter(
    (n) =>
      n.role === 'button' ||
      n.role === 'input' ||
      n.role === 'toggle' ||
      n.role === 'tab' ||
      n.role === 'list' ||
      !!n.componentKey ||
      !!findInteractionForNode(doc, n)
  );

  const lines = interactive.map((n) => {
    const target = interactionTargetOf(n);
    const ix = findInteractionForNode(doc, n);
    const bits = [`role=${n.role}`, `target=${target}`];
    if (ix?.onClick) bits.push(`onClick=${ix.onClick}`);
    if (ix?.navigate) bits.push(`navigate=${ix.navigate}`);
    if (ix?.api) bits.push(`api=${ix.api}`);
    return `- [ ] ${n.name} (${bits.join(', ')})`;
  });

  const orphanIx = (doc.interactions ?? []).filter((i) => {
    return !nodes.some((n) => interactionTargetOf(n) === i.target || n.id === i.target);
  });

  return `# 验收清单

设计尺寸 ${doc.designSize.width}×${doc.designSize.height} · 文档「${doc.name}」

## 必须实现的交互节点
${lines.length ? lines.join('\n') : '- （暂无标注角色/交互的节点）'}

## 交互表条目
${
  (doc.interactions ?? []).length
    ? (doc.interactions ?? [])
        .map(
          (i) =>
            `- [ ] \`${i.target}\`` +
            [
              i.onClick && `onClick=${i.onClick}`,
              i.navigate && `navigate=${i.navigate}`,
              i.api && `api=${i.api}`,
              i.animation && `animation=${i.animation}`,
            ]
              .filter(Boolean)
              .join(' · ')
        )
        .join('\n')
    : '- （interactions.json 为空时可在编辑器属性面板填写）'
}

${
  orphanIx.length
    ? `## 警告：找不到对应节点的交互\n${orphanIx.map((i) => `- ${i.target}`).join('\n')}\n`
    : ''
}
`;
}

export function interactionsToMarkdown(doc: Document): string {
  const list = doc.interactions ?? [];
  if (!list.length) {
    return `# 页面交互说明

（空）请在编辑器选中节点后填写 onClick / navigate / api，或直接编辑 interactions.json。
`;
  }
  return `# 页面交互说明

| target | onClick | navigate | api | animation | notes |
|--------|---------|----------|-----|-----------|-------|
${list
  .map(
    (i) =>
      `| ${i.target} | ${i.onClick ?? ''} | ${i.navigate ?? ''} | ${i.api ?? ''} | ${i.animation ?? ''} | ${i.notes ?? ''} |`
  )
  .join('\n')}
`;
}
