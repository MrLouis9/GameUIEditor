import type { Document, SceneNode } from './types';
import { getActivePage, walkNodes } from './tree';

export interface DesignTokens {
  schemaVersion: 1;
  designSize: { width: number; height: number };
  colors: string[];
  fontFamilies: string[];
  fontSizes: number[];
  radii: number[];
  spacing: number[];
  strokeWidths: number[];
}

function pushUniqueSortedNumber(list: number[], value: number): void {
  if (!Number.isFinite(value)) return;
  const v = Math.round(value * 1000) / 1000;
  if (!list.includes(v)) list.push(v);
}

function pushUniqueString(list: string[], value: string | undefined): void {
  if (!value) return;
  const v = value.trim();
  if (!v) return;
  if (!list.includes(v)) list.push(v);
}

/** Extract design tokens from document node styles (P2). */
export function extractDesignTokens(doc: Document): DesignTokens {
  const colors: string[] = [];
  const fontFamilies: string[] = [];
  const fontSizes: number[] = [];
  const radii: number[] = [];
  const spacing: number[] = [];
  const strokeWidths: number[] = [];

  const visit = (node: SceneNode) => {
    pushUniqueString(colors, node.fill);
    pushUniqueString(colors, node.strokeColor);
    pushUniqueSortedNumber(radii, node.cornerRadius ?? 0);
    pushUniqueSortedNumber(strokeWidths, node.strokeWidth ?? 0);
    if (node.layout) {
      pushUniqueSortedNumber(spacing, node.layout.gap);
      pushUniqueSortedNumber(spacing, node.layout.padding);
    }
    if (node.type === 'text') {
      pushUniqueString(colors, node.color);
      pushUniqueString(fontFamilies, node.fontFamily);
      pushUniqueSortedNumber(fontSizes, node.fontSize);
    }
  };

  for (const page of doc.pages) {
    walkNodes(page.root, visit);
  }

  colors.sort();
  fontFamilies.sort();
  fontSizes.sort((a, b) => a - b);
  radii.sort((a, b) => a - b);
  spacing.sort((a, b) => a - b);
  strokeWidths.sort((a, b) => a - b);

  return {
    schemaVersion: 1,
    designSize: { ...doc.designSize },
    colors: colors.filter((c) => c !== ''),
    fontFamilies,
    fontSizes: fontSizes.filter((n) => n > 0),
    radii: radii.filter((n) => n > 0),
    spacing: spacing.filter((n) => n > 0),
    strokeWidths: strokeWidths.filter((n) => n > 0),
  };
}

export function tokensToMarkdown(tokens: DesignTokens): string {
  return `# Design Tokens

设计尺寸：${tokens.designSize.width}×${tokens.designSize.height}

## Colors
${tokens.colors.map((c) => `- \`${c}\``).join('\n') || '- （无）'}

## Font families
${tokens.fontFamilies.map((f) => `- ${f}`).join('\n') || '- （无）'}

## Font sizes
${tokens.fontSizes.map((n) => `- ${n}px`).join('\n') || '- （无）'}

## Radii
${tokens.radii.map((n) => `- ${n}px`).join('\n') || '- （无）'}

## Spacing (gap / padding)
${tokens.spacing.map((n) => `- ${n}px`).join('\n') || '- （无）'}

## Stroke widths
${tokens.strokeWidths.map((n) => `- ${n}px`).join('\n') || '- （无）'}
`;
}

/** Convenience: tokens for active page only (same as full doc for single-page). */
export function extractActivePageTokens(doc: Document): DesignTokens {
  const page = getActivePage(doc);
  if (!page) return extractDesignTokens(doc);
  const clone: Document = {
    ...doc,
    pages: [page],
  };
  return extractDesignTokens(clone);
}
