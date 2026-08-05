import type { DesignPreset } from './types';

/** Default landscape artboard */
export const DEFAULT_DESIGN = { width: 1280, height: 720 } as const;

/** Portrait preset */
export const PORTRAIT_DESIGN = { width: 720, height: 1280 } as const;

/** 21:9 on 720p height → 1680×720 */
export const ULTRAWIDE_LANDSCAPE = { width: 1680, height: 720 } as const;

/** Portrait tall adaptive (21:9 on 720 width) → 720×1560 */
export const TALL_PORTRAIT = { width: 720, height: 1560 } as const;

export const DESIGN_PRESETS: DesignPreset[] = [
  { id: '1280x720', label: '横屏 1280×720 (16:9)', width: 1280, height: 720, orientation: 'landscape' },
  { id: '1680x720', label: '横屏 1680×720 (21:9)', width: 1680, height: 720, orientation: 'landscape' },
  { id: '720x1280', label: '竖屏 720×1280 (9:16)', width: 720, height: 1280, orientation: 'portrait' },
  { id: '720x1560', label: '竖屏 720×1560 (9:21)', width: 720, height: 1560, orientation: 'portrait' },
];

/** Clamp adaptive size between 16:9 and 21:9 for a fixed short side of 720. */
export function resolveAdaptiveSize(
  orientation: 'landscape' | 'portrait',
  longSide: number
): { width: number; height: number } {
  if (orientation === 'landscape') {
    const minW = Math.round(720 * (16 / 9)); // 1280
    const maxW = Math.round(720 * (21 / 9)); // 1680
    return { width: Math.min(maxW, Math.max(minW, Math.round(longSide))), height: 720 };
  }
  const minH = Math.round(720 * (16 / 9)); // 1280
  const maxH = Math.round(720 * (21 / 9)); // 1560
  return { width: 720, height: Math.min(maxH, Math.max(minH, Math.round(longSide))) };
}
