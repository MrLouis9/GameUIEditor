/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SpriteItem, PackSettings, PackResult, PackedSheet } from './types';
import { getTrimmedBounds } from './image';

export function nextPowerOfTwo(value: number): number {
  if (value <= 0) return 1;
  let power = 1;
  while (power < value) {
    power *= 2;
  }
  return power;
}

export function sortSprites(
  sprites: SpriteItem[],
  method: PackSettings['sortMethod']
): SpriteItem[] {
  return [...sprites].sort((a, b) => {
    switch (method) {
      case 'area-desc':
        return (b.width * b.height) - (a.width * a.height);
      case 'height-desc':
        if (b.height !== a.height) {
          return b.height - a.height;
        }
        return b.width - a.width;
      case 'width-desc':
        if (b.width !== a.width) {
          return b.width - a.width;
        }
        return b.height - a.height;
      case 'max-side-desc': {
        const maxSideA = Math.max(a.width, a.height);
        const maxSideB = Math.max(b.width, b.height);
        return maxSideB - maxSideA;
      }
      case 'name-asc':
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      default:
        return 0;
    }
  });
}

interface PackerBlock {
  id: string;
  w: number;
  h: number;
  fit?: { x: number; y: number };
  sprite: SpriteItem;
}

class GrowingBinPacker {
  root: { x: number; y: number; w: number; h: number; used?: boolean; right?: any; down?: any } | null = null;
  maxWidth: number;
  maxHeight: number;

  constructor(maxWidth: number, maxHeight: number) {
    this.maxWidth = maxWidth;
    this.maxHeight = maxHeight;
  }

  fit(blocks: PackerBlock[]) {
    let len = blocks.length;
    let w = len > 0 ? blocks[0].w : 0;
    let h = len > 0 ? blocks[0].h : 0;

    // Safety check: starting block cannot exceed maximum limits
    if (w > this.maxWidth || h > this.maxHeight) {
      w = Math.min(w, this.maxWidth);
      h = Math.min(h, this.maxHeight);
    }

    this.root = { x: 0, y: 0, w: w, h: h };

    for (let n = 0; n < len; n++) {
      const block = blocks[n];
      const node = this.findNode(this.root, block.w, block.h);
      if (node) {
        block.fit = this.splitNode(node, block.w, block.h);
      } else {
        block.fit = this.growNode(block.w, block.h);
      }
    }
  }

  findNode(root: any, w: number, h: number): any {
    if (root.used) {
      return this.findNode(root.right, w, h) || this.findNode(root.down, w, h);
    } else if (w <= root.w && h <= root.h) {
      return root;
    } else {
      return null;
    }
  }

  splitNode(node: any, w: number, h: number) {
    node.used = true;
    node.down = { x: node.x, y: node.y + h, w: node.w, h: node.h - h };
    node.right = { x: node.x + w, y: node.y, w: node.w - w, h: h };
    return node;
  }

  growNode(w: number, h: number): { x: number; y: number } | undefined {
    if (!this.root) return undefined;

    const canGrowDown = w <= this.root.w;
    const canGrowRight = h <= this.root.h;

    // Boundary constraints check
    const canGrowRightConstrained = canGrowRight && this.root.w + w <= this.maxWidth;
    const canGrowDownConstrained = canGrowDown && this.root.h + h <= this.maxHeight;

    const shouldGrowRight = canGrowRightConstrained && this.root.w >= this.root.h + h;
    const shouldGrowDown = canGrowDownConstrained && this.root.h >= this.root.w + w;

    if (shouldGrowRight) {
      return this.growRight(w, h);
    } else if (shouldGrowDown) {
      return this.growDown(w, h);
    } else if (canGrowRightConstrained) {
      return this.growRight(w, h);
    } else if (canGrowDownConstrained) {
      return this.growDown(w, h);
    } else {
      return undefined; // Does not fit inside maximum bounds
    }
  }

  growRight(w: number, h: number): { x: number; y: number } | undefined {
    if (!this.root) return undefined;
    this.root = {
      used: true,
      x: 0,
      y: 0,
      w: this.root.w + w,
      h: this.root.h,
      down: this.root,
      right: { x: this.root.w, y: 0, w: w, h: this.root.h },
    };
    const node = this.findNode(this.root, w, h);
    if (node) {
      return this.splitNode(node, w, h);
    }
    return undefined;
  }

  growDown(w: number, h: number): { x: number; y: number } | undefined {
    if (!this.root) return undefined;
    this.root = {
      used: true,
      x: 0,
      y: 0,
      w: this.root.w,
      h: this.root.h + h,
      down: { x: 0, y: this.root.h, w: this.root.w, h: h },
      right: this.root,
    };
    const node = this.findNode(this.root, w, h);
    if (node) {
      return this.splitNode(node, w, h);
    }
    return undefined;
  }
}

function finalizeSheet(
  rawWidth: number,
  rawHeight: number,
  packedItems: PackResult[],
  unfittedItems: SpriteItem[],
  settings: PackSettings
): PackedSheet {
  const { padding, forcePowerOfTwo, forceSquare, maxWidth, maxHeight } = settings;

  // Add borders
  let finalWidth = rawWidth > 0 ? rawWidth + 2 * padding : 0;
  let finalHeight = rawHeight > 0 ? rawHeight + 2 * padding : 0;

  // Power of 2 rounding
  if (forcePowerOfTwo) {
    finalWidth = nextPowerOfTwo(finalWidth);
    finalHeight = nextPowerOfTwo(finalHeight);
  }

  // Square rounding
  if (forceSquare) {
    const maxSide = Math.max(finalWidth, finalHeight);
    finalWidth = finalHeight = forcePowerOfTwo ? nextPowerOfTwo(maxSide) : maxSide;
  }

  // Clamp to max constraints
  finalWidth = Math.min(finalWidth, maxWidth);
  finalHeight = Math.min(finalHeight, maxHeight);

  // Offset coordinates of packed items by padding
  const items = packedItems.map((item) => ({
    ...item,
    x: item.x + padding,
    y: item.y + padding,
  }));

  // Calculate efficiency
  let totalSpriteArea = 0;
  for (const item of items) {
    if (item.fit) {
      totalSpriteArea += item.width * item.height;
    }
  }

  const canvasArea = finalWidth * finalHeight;
  const efficiency = canvasArea > 0 ? Math.min(100, (totalSpriteArea / canvasArea) * 100) : 0;

  return {
    width: finalWidth,
    height: finalHeight,
    packedItems: items,
    unfittedItems,
    efficiency,
  };
}

export function packSprites(
  sprites: SpriteItem[],
  settings: PackSettings
): PackedSheet {
  if (sprites.length === 0) {
    return {
      width: 0,
      height: 0,
      packedItems: [],
      unfittedItems: [],
      efficiency: 0,
    };
  }

  // Apply trim before packing so sort / bins use trimmed sizes
  const prepared = prepareSprites(sprites, settings.trim);
  const { padding, spacing, maxWidth, maxHeight, algorithm, sortMethod } = settings;

  // Shelf Packing algorithm
  if (algorithm === 'shelf') {
    const sortedSprites = sortSprites(prepared, sortMethod);
    const packedItems: PackResult[] = [];
    const unfittedItems: SpriteItem[] = [];

    let currentX = 0;
    let currentY = 0;
    let currentShelfHeight = 0;
    let maxW = 0;
    let maxH = 0;

    const availableW = maxWidth - 2 * padding;
    const availableH = maxHeight - 2 * padding;

    for (const sprite of sortedSprites) {
      const w = sprite.width + spacing;
      const h = sprite.height + spacing;

      // If the sprite alone is bigger than the available width/height, it can never fit
      if (sprite.width > availableW || sprite.height > availableH) {
        unfittedItems.push(sprite);
        continue;
      }

      // Check if it fits on current shelf. If not, start new shelf
      if (currentX + sprite.width > availableW) {
        currentX = 0;
        currentY += currentShelfHeight;
        currentShelfHeight = 0;
      }

      // Check if it fits vertically in the sheet
      if (currentY + sprite.height > availableH) {
        unfittedItems.push(sprite);
        continue;
      }

      packedItems.push({
        sprite,
        x: currentX,
        y: currentY,
        width: sprite.width,
        height: sprite.height,
        rotated: false,
        fit: true,
      });

      currentX += w;
      currentShelfHeight = Math.max(currentShelfHeight, h);
      maxW = Math.max(maxW, currentX);
      maxH = Math.max(maxH, currentY + currentShelfHeight);
    }

    // Raw width is maxW minus the trailing spacing
    const rawW = maxW > 0 ? maxW - spacing : 0;
    const rawH = maxH > 0 ? maxH - spacing : 0;

    return finalizeSheet(rawW, rawH, packedItems, unfittedItems, settings);
  }

  // Growing Bin Packer (Default)
  // Sort sprites
  const sortedSprites = sortSprites(prepared, sortMethod);

  // Prepare blocks with spacing
  const blocks: PackerBlock[] = sortedSprites.map((sprite) => ({
    id: sprite.id,
    w: sprite.width + spacing,
    h: sprite.height + spacing,
    sprite,
  }));

  const packer = new GrowingBinPacker(maxWidth - 2 * padding, maxHeight - 2 * padding);
  packer.fit(blocks);

  const packedItems: PackResult[] = [];
  const unfittedItems: SpriteItem[] = [];

  let maxW = 0;
  let maxH = 0;

  for (const block of blocks) {
    if (block.fit) {
      packedItems.push({
        sprite: block.sprite,
        x: block.fit.x,
        y: block.fit.y,
        width: block.sprite.width,
        height: block.sprite.height,
        rotated: false,
        fit: true,
      });
      maxW = Math.max(maxW, block.fit.x + block.w);
      maxH = Math.max(maxH, block.fit.y + block.h);
    } else {
      unfittedItems.push(block.sprite);
    }
  }

  // Subtract trailing spacing
  const rawW = maxW > 0 ? maxW - spacing : 0;
  const rawH = maxH > 0 ? maxH - spacing : 0;

  return finalizeSheet(rawW, rawH, packedItems, unfittedItems, settings);
}

/** Clone sprites and optionally trim transparent edges for packing. */
export function prepareSprites(sprites: SpriteItem[], trim: boolean): SpriteItem[] {
  return sprites.map((s) => {
    const ow = s.originalWidth || s.width;
    const oh = s.originalHeight || s.height;
    if (!trim || !s.imgElement) {
      return {
        ...s,
        originalWidth: ow,
        originalHeight: oh,
        width: ow,
        height: oh,
        trimmed: false,
        trimOffset: { x: 0, y: 0 },
        trimBounds: undefined,
      };
    }

    const bounds = getTrimmedBounds(s.imgElement);
    return {
      ...s,
      originalWidth: ow,
      originalHeight: oh,
      width: bounds.width,
      height: bounds.height,
      trimmed: true,
      trimOffset: { x: bounds.x, y: bounds.y },
      trimBounds: {
        x: bounds.x,
        y: bounds.y,
        w: bounds.width,
        h: bounds.height,
      },
    };
  });
}
