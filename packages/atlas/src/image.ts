/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PackedSheet, SpriteItem } from './types';

/**
 * Helper to wrap image loading in a promise
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error('Failed to load image: ' + e));
    img.src = src;
  });
}

/**
 * Calculates the bounding box of non-transparent pixels in an image
 */
export function getTrimmedBounds(img: HTMLImageElement): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { x: 0, y: 0, width: canvas.width, height: canvas.height };
  }

  ctx.drawImage(img, 0, 0);
  try {
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    let minX = canvas.width;
    let minY = canvas.height;
    let maxX = 0;
    let maxY = 0;
    let hasContent = false;

    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const alphaIndex = (y * canvas.width + x) * 4 + 3;
        const alpha = data[alphaIndex];
        if (alpha > 0) { // Keep any pixel that has some opacity
          hasContent = true;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (!hasContent) {
      // Completely transparent image, return tiny 1x1
      return { x: 0, y: 0, width: 1, height: 1 };
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    };
  } catch (err) {
    // Fail-safe for tainted canvas or security issues, return original bounds
    console.warn('Canvas pixel analysis failed, skipping trim:', err);
    return { x: 0, y: 0, width: canvas.width, height: canvas.height };
  }
}

/**
 * Renders the sprite sheet layout to a single canvas (export size = effective sheet).
 */
export function drawPackedSheet(
  sheet: PackedSheet,
  backgroundColor: string,
  scale: number = 1,
  options?: { showBorder?: boolean }
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sheet.width * scale));
  canvas.height = Math.max(1, Math.round(sheet.height * scale));
  const ctx = canvas.getContext('2d');

  if (!ctx) return canvas;

  // Set background color
  if (backgroundColor && backgroundColor !== 'transparent') {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  // Draw each sprite
  for (const item of sheet.packedItems) {
    if (!item.fit || !item.sprite.imgElement) continue;

    const s = item.sprite;
    const destX = item.x * scale;
    const destY = item.y * scale;
    const destW = item.width * scale;
    const destH = item.height * scale;

    if (s.trimmed) {
      // Draw cropped section of original image
      ctx.drawImage(
        s.imgElement!,
        s.trimOffset.x,
        s.trimOffset.y,
        s.width,
        s.height,
        destX,
        destY,
        destW,
        destH
      );
    } else {
      // Draw entire original image
      ctx.drawImage(s.imgElement!, destX, destY, destW, destH);
    }

    if (options?.showBorder) {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
      ctx.lineWidth = Math.max(1, scale);
      ctx.strokeRect(destX + 0.5, destY + 0.5, destW - 1, destH - 1);
    }
  }

  return canvas;
}

/**
 * Preview canvas: full max canvas (background layer) + effective packed sheet (image layer).
 */
export function drawPackedSheetPreview(
  sheet: PackedSheet,
  settings: {
    maxWidth: number;
    maxHeight: number;
    backgroundColor?: string;
  },
  scale: number = 1,
  options?: { showBorder?: boolean }
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const maxW = Math.max(sheet.width, settings.maxWidth);
  const maxH = Math.max(sheet.height, settings.maxHeight);
  canvas.width = Math.max(1, Math.round(maxW * scale));
  canvas.height = Math.max(1, Math.round(maxH * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // Background layer — checkerboard over max canvas
  const cell = Math.max(4, Math.round(8 * scale));
  for (let y = 0; y < canvas.height; y += cell) {
    for (let x = 0; x < canvas.width; x += cell) {
      const odd = ((x / cell) | 0) + ((y / cell) | 0);
      ctx.fillStyle = odd % 2 === 0 ? '#2a2a2a' : '#1e1e1e';
      ctx.fillRect(x, y, cell, cell);
    }
  }

  // Effective image layer — solid plate under packed sprites
  const effW = Math.round(sheet.width * scale);
  const effH = Math.round(sheet.height * scale);
  if (effW > 0 && effH > 0) {
    const bg = settings.backgroundColor;
    if (bg && bg !== 'transparent') {
      ctx.fillStyle = bg;
    } else {
      ctx.fillStyle = '#f4f4f5';
    }
    ctx.fillRect(0, 0, effW, effH);

    const sheetCanvas = drawPackedSheet(
      sheet,
      'transparent',
      scale,
      options
    );
    ctx.drawImage(sheetCanvas, 0, 0);

    // Outline effective layer
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
    ctx.lineWidth = Math.max(1, scale);
    ctx.strokeRect(0.5, 0.5, effW - 1, effH - 1);
  }

  // Outline full background canvas
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
  ctx.lineWidth = Math.max(1, scale);
  ctx.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);

  return canvas;
}

/**
 * Formats layout data into TexturePacker JSON Hash style
 */
export function generateAtlasJSON(
  sheet: PackedSheet,
  imageName: string,
  format: 'json-hash' | 'json-array',
  scale: number = 1
): string {
  const meta = {
    app: 'Sprite Sheet Packer',
    version: '1.0',
    image: imageName,
    format: 'RGBA8888',
    // Round to match canvas pixel size from drawPackedSheet
    size: {
      w: Math.max(1, Math.round(sheet.width * scale)),
      h: Math.max(1, Math.round(sheet.height * scale)),
    },
    scale: String(scale),
  };

  const framesData = sheet.packedItems.map((item) => {
    const s = item.sprite;
    const frameData: any = {
      filename: s.name,
      frame: {
        x: Math.round(item.x * scale),
        y: Math.round(item.y * scale),
        w: Math.round(item.width * scale),
        h: Math.round(item.height * scale),
      },
      rotated: false,
      trimmed: s.trimmed,
      spriteSourceSize: {
        x: Math.round(s.trimOffset.x * scale),
        y: Math.round(s.trimOffset.y * scale),
        w: Math.round(s.width * scale),
        h: Math.round(s.height * scale),
      },
      sourceSize: {
        w: Math.round(s.originalWidth * scale),
        h: Math.round(s.originalHeight * scale),
      },
    };

    if (s.nineSlice) {
      frameData.borders = [
        s.nineSlice.top,
        s.nineSlice.right,
        s.nineSlice.bottom,
        s.nineSlice.left
      ];
    }

    return frameData;
  });

  if (format === 'json-hash') {
    const frames: Record<string, any> = {};
    framesData.forEach((frame) => {
      // Remove filename from inside hash properties
      const { filename, ...rest } = frame;
      frames[filename] = rest;
    });

    return JSON.stringify({ frames, meta }, null, 2);
  } else {
    // json-array format
    return JSON.stringify({ frames: framesData, meta }, null, 2);
  }
}

/**
 * Formats layout data into CSS Sprite style
 */
export function generateAtlasCSS(
  sheet: PackedSheet,
  imageName: string,
  scale: number = 1
): string {
  let css = `/* Sprite sheet stylesheet generated by Sprite Sheet Packer */\n\n`;
  
  css += `.sprite-sheet {\n`;
  css += `  background-image: url('${imageName}');\n`;
  css += `  background-repeat: no-repeat;\n`;
  css += `  display: inline-block;\n`;
  css += `}\n\n`;

  for (const item of sheet.packedItems) {
    if (!item.fit) continue;
    const s = item.sprite;
    // Format name into valid CSS selector (sanitize spaces/special chars)
    const sanitizedName = s.name
      .replace(/\.[^/.]+$/, '') // remove extension if exists
      .replace(/[^a-zA-Z0-9-_]/g, '-');

    css += `.sprite-${sanitizedName} {\n`;
    css += `  width: ${item.width * scale}px;\n`;
    css += `  height: ${item.height * scale}px;\n`;
    css += `  background-position: -${item.x * scale}px -${item.y * scale}px;\n`;
    if (s.trimmed) {
      css += `  /* Trimmed original size: ${s.originalWidth * scale}px x ${s.originalHeight * scale}px */\n`;
    }
    css += `}\n\n`;
  }

  return css;
}
