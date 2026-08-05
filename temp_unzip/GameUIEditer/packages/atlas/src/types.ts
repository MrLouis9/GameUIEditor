/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SpriteItem {
  id: string;
  name: string;
  file?: File;
  width: number;          // Current packed width (trimmed or original)
  height: number;         // Current packed height (trimmed or original)
  originalWidth: number;  // Source image width
  originalHeight: number; // Source image height
  trimmed: boolean;       // Whether transparent pixels were cropped
  trimOffset: {
    x: number;
    y: number;
  };
  dataUrl: string;        // Local preview data URL
  imgElement: HTMLImageElement | null; // Cached HTML Image object for canvas drawing
  trimBounds?: {          // Pre-calculated boundaries for cropping transparency
    x: number;
    y: number;
    w: number;
    h: number;
  };
  nineSlice?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

export type PackingAlgorithm = 'growing-binpacker' | 'shelf';

export type ExportFormat = 'json-hash' | 'json-array' | 'css';

export interface PackSettings {
  padding: number;          // Border around the sheet
  spacing: number;          // Spacing between sprites (inner margin/extrude)
  maxWidth: number;         // Max sheet width
  maxHeight: number;        // Max sheet height
  forcePowerOfTwo: boolean; // Force final sheet dimensions to power of 2
  forceSquare: boolean;     // Force width === height
  trim: boolean;            // Trim transparent pixels
  algorithm: PackingAlgorithm;
  backgroundColor: string;  // Canvas background (transparent, hex, etc)
  format: ExportFormat;
  scale: number;            // Scale multiplier for export
  sortMethod: 'area-desc' | 'height-desc' | 'width-desc' | 'name-asc' | 'max-side-desc';
}

export interface PackResult {
  sprite: SpriteItem;
  x: number;
  y: number;
  width: number;
  height: number;
  rotated: boolean;
  fit: boolean; // Whether it was successfully placed
}

export interface PackedSheet {
  width: number;
  height: number;
  packedItems: PackResult[];
  unfittedItems: SpriteItem[];
  efficiency: number; // Visual area usage percentage
}
