/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PackedSheet, SpriteItem } from '../types';

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
 * Renders the sprite sheet layout to a single canvas
 */
export function drawPackedSheet(
  sheet: PackedSheet,
  backgroundColor: string,
  scale: number = 1
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = sheet.width * scale;
  canvas.height = sheet.height * scale;
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
        s.imgElement,
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
      ctx.drawImage(s.imgElement, destX, destY, destW, destH);
    }
  }

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
    size: { w: sheet.width * scale, h: sheet.height * scale },
    scale: String(scale),
  };

  const framesData = sheet.packedItems.map((item) => {
    const s = item.sprite;
    const frameData: any = {
      filename: s.name,
      frame: {
        x: item.x * scale,
        y: item.y * scale,
        w: item.width * scale,
        h: item.height * scale,
      },
      rotated: false,
      trimmed: s.trimmed,
      spriteSourceSize: {
        x: s.trimOffset.x * scale,
        y: s.trimOffset.y * scale,
        w: s.width * scale,
        h: s.height * scale,
      },
      sourceSize: {
        w: s.originalWidth * scale,
        h: s.originalHeight * scale,
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
