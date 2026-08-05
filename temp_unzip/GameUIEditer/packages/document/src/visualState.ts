import type { SpriteNode, StateAssets, TextShadow } from './types';
import { DEFAULT_TEXT_SHADOW } from './types';

/**
 * Resolve which asset to draw for a sprite given activeState + stateAssets.
 * Contract: `stateAssets[activeState] ?? stateAssets.normal ?? assetId`
 */
export function resolveSpriteAssetId(node: SpriteNode): string {
  const map = node.stateAssets;
  const fromState = map?.[node.activeState];
  if (fromState) return fromState;
  if (map?.normal) return map.normal;
  return node.assetId;
}

export function mergeStateAssets(
  current: StateAssets | undefined,
  patch: StateAssets
): StateAssets {
  const next: StateAssets = { ...(current ?? {}) };
  for (const [k, v] of Object.entries(patch) as Array<
    [keyof StateAssets, string | undefined]
  >) {
    if (v === undefined || v === '') delete next[k];
    else next[k] = v;
  }
  return next;
}

export function normalizeTextShadow(
  shadow: TextShadow | undefined
): TextShadow {
  if (!shadow) return { ...DEFAULT_TEXT_SHADOW };
  return {
    ...DEFAULT_TEXT_SHADOW,
    ...shadow,
    color: shadow.color || DEFAULT_TEXT_SHADOW.color,
    alpha: Math.min(1, Math.max(0, shadow.alpha ?? DEFAULT_TEXT_SHADOW.alpha)),
    blur: Math.max(0, shadow.blur ?? DEFAULT_TEXT_SHADOW.blur),
    offsetX: shadow.offsetX ?? DEFAULT_TEXT_SHADOW.offsetX,
    offsetY: shadow.offsetY ?? DEFAULT_TEXT_SHADOW.offsetY,
    enabled: !!shadow.enabled,
  };
}
