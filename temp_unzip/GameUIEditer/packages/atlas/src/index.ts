export type {
  SpriteItem,
  PackingAlgorithm,
  ExportFormat,
  PackSettings,
  PackResult,
  PackedSheet,
} from './types';

export { nextPowerOfTwo, sortSprites, packSprites, prepareSprites } from './packer';
export {
  loadImage,
  getTrimmedBounds,
  drawPackedSheet,
  drawPackedSheetPreview,
  generateAtlasJSON,
  generateAtlasCSS,
} from './image';

export const DEFAULT_PACK_SETTINGS: import('./types').PackSettings = {
  padding: 2,
  spacing: 2,
  maxWidth: 2048,
  maxHeight: 2048,
  forcePowerOfTwo: true,
  forceSquare: false,
  trim: true,
  algorithm: 'growing-binpacker',
  backgroundColor: 'transparent',
  format: 'json-hash',
  scale: 1,
  sortMethod: 'area-desc',
};
