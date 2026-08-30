import type { SpriteNode, StateAssets, TextShadow, NineSlice } from './types';
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

/** True if any edge inset is > 0 (horizontal-only with top=bottom=0 counts). */
export function isActiveNineSlice(
  slice: NineSlice | undefined | null
): boolean {
  if (!slice) return false;
  return (
    slice.top > 0 || slice.right > 0 || slice.bottom > 0 || slice.left > 0
  );
}

/**
 * Effective nine-slice: node override, else asset.
 * Top/bottom 0 = vertical uniform scale; left/right > 0 = horizontal 3-slice.
 */
export function resolveNineSlice(
  nodeSlice: NineSlice | undefined,
  assetSlice: NineSlice | undefined
): NineSlice | undefined {
  const slice = nodeSlice ?? assetSlice;
  return isActiveNineSlice(slice) ? { ...slice! } : undefined;
}

/**
 * Keep at least 1px stretchable center so Pixi NineSliceSprite can elongate.
 */
export function clampNineSliceToTexture(
  slice: NineSlice,
  texW: number,
  texH: number
): NineSlice {
  let top = Math.max(0, Math.round(slice.top));
  let right = Math.max(0, Math.round(slice.right));
  let bottom = Math.max(0, Math.round(slice.bottom));
  let left = Math.max(0, Math.round(slice.left));
  const maxW = Math.max(1, Math.floor(texW));
  const maxH = Math.max(1, Math.floor(texH));
  if (left + right >= maxW) {
    const sum = left + right || 1;
    const budget = maxW - 1;
    left = Math.max(0, Math.floor((left / sum) * budget));
    right = Math.max(0, budget - left);
  }
  if (top + bottom >= maxH) {
    const sum = top + bottom || 1;
    const budget = maxH - 1;
    top = Math.max(0, Math.floor((top / sum) * budget));
    bottom = Math.max(0, budget - top);
  }
  return { top, right, bottom, left };
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
