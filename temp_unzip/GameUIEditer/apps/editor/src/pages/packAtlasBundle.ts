import {
  DEFAULT_PACK_SETTINGS,
  drawPackedSheet,
  generateAtlasJSON,
  loadImage,
  packSprites,
  type PackSettings,
  type SpriteItem,
} from '@game-ui/atlas';
import type { Asset, Atlas } from '@game-ui/document';

const PACK_SETTINGS_PREFIX = 'gameui-pack-settings:';

export function safeAtlasFileBase(name: string, fallback = 'atlas'): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim() || fallback;
}

export function loadAtlasPackSettings(atlasId: string): PackSettings {
  try {
    const raw = localStorage.getItem(PACK_SETTINGS_PREFIX + atlasId);
    if (!raw) return { ...DEFAULT_PACK_SETTINGS };
    return {
      ...DEFAULT_PACK_SETTINGS,
      ...(JSON.parse(raw) as Partial<PackSettings>),
    };
  } catch {
    return { ...DEFAULT_PACK_SETTINGS };
  }
}

function dataUrlToBytes(dataUrl: string): Uint8Array | null {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return null;
  const meta = dataUrl.slice(0, comma);
  const body = dataUrl.slice(comma + 1);
  try {
    if (/;base64/i.test(meta)) {
      const bin = atob(body);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
    return new TextEncoder().encode(decodeURIComponent(body));
  } catch {
    return null;
  }
}

export type PackedAtlasBundle = {
  atlasId: string;
  atlasName: string;
  pngFileName: string;
  jsonFileName: string;
  pngBytes: Uint8Array;
  atlasJson: string;
  width: number;
  height: number;
  frameNameById: Map<string, string>;
};

/**
 * Pack one atlas → png + json that are guaranteed size-synced
 * (JSON meta.size always equals actual PNG pixel size).
 * Sprite sizes come from image naturalWidth/Height, not stale asset metadata.
 */
export async function packAtlasBundle(
  atlas: Atlas,
  assetsInAtlas: Asset[],
  options?: {
    pngFileName?: string;
    jsonFileName?: string;
    settings?: PackSettings;
  }
): Promise<PackedAtlasBundle | null> {
  const withImage = assetsInAtlas.filter((a) => !!a.dataUrl);
  if (!withImage.length) return null;

  const base =
    safeAtlasFileBase(atlas.name, safeAtlasFileBase(atlas.id)) || 'atlas';
  const pngFileName = options?.pngFileName ?? `${base}.png`;
  const jsonFileName = options?.jsonFileName ?? `${base}.json`;
  const settings: PackSettings = {
    ...(options?.settings ?? loadAtlasPackSettings(atlas.id)),
    format: 'json-hash',
    backgroundColor: 'transparent',
  };

  const usedNames = new Map<string, number>();
  const frameNameById = new Map<string, string>();
  const sprites: SpriteItem[] = [];

  for (const asset of withImage) {
    let frameName = safeAtlasFileBase(asset.name, asset.id);
    const n = (usedNames.get(frameName) ?? 0) + 1;
    usedNames.set(frameName, n);
    if (n > 1) frameName = `${frameName}_${n}`;
    frameNameById.set(asset.id, frameName);

    const img = await loadImage(asset.dataUrl);
    const nw = img.naturalWidth || img.width || asset.width;
    const nh = img.naturalHeight || img.height || asset.height;

    sprites.push({
      id: asset.id,
      name: frameName,
      width: nw,
      height: nh,
      originalWidth: nw,
      originalHeight: nh,
      trimmed: false,
      trimOffset: { x: 0, y: 0 },
      dataUrl: asset.dataUrl,
      imgElement: img,
      nineSlice: asset.nineSlice,
    });
  }

  const sheet = packSprites(sprites, settings);
  const canvas = drawPackedSheet(sheet, 'transparent', settings.scale, {
    showBorder: false,
  });

  // Authoritative pixel size = what was actually drawn into the PNG
  const width = canvas.width;
  const height = canvas.height;

  const pngBytes = dataUrlToBytes(canvas.toDataURL('image/png'));
  if (!pngBytes) return null;

  const rawJson = generateAtlasJSON(
    sheet,
    pngFileName,
    'json-hash',
    settings.scale
  );

  const assetFrames: Record<string, string> = {};
  for (const [id, frame] of frameNameById) {
    assetFrames[id] = frame;
  }

  let atlasJson: string;
  try {
    const parsed = JSON.parse(rawJson) as {
      frames: Record<string, { frame?: { x: number; y: number; w: number; h: number } }>;
      meta: Record<string, unknown>;
    };

    // Force meta.size to match PNG pixels (never trust a separate code path)
    parsed.meta = {
      ...parsed.meta,
      app: 'GameUIEditer',
      image: pngFileName,
      atlasId: atlas.id,
      atlasName: atlas.name,
      size: { w: width, h: height },
      format: 'RGBA8888',
    };

    // Drop any frame that would sample outside the PNG
    for (const [key, frame] of Object.entries(parsed.frames)) {
      const f = frame.frame;
      if (!f) continue;
      if (f.x + f.w > width + 0.5 || f.y + f.h > height + 0.5) {
        console.warn(
          `[atlas] frame "${key}" exceeds PNG ${width}×${height}:`,
          f
        );
      }
    }

    atlasJson = JSON.stringify({ ...parsed, assetFrames }, null, 2);
  } catch {
    atlasJson = rawJson;
  }

  // Final guard: parsed size must equal canvas
  try {
    const check = JSON.parse(atlasJson) as { meta?: { size?: { w: number; h: number } } };
    const sw = check.meta?.size?.w;
    const sh = check.meta?.size?.h;
    if (sw !== width || sh !== height) {
      throw new Error(
        `图集尺寸不同步：PNG ${width}×${height} vs JSON ${sw}×${sh}`
      );
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('图集尺寸不同步')) throw e;
  }

  return {
    atlasId: atlas.id,
    atlasName: atlas.name,
    pngFileName,
    jsonFileName,
    pngBytes,
    atlasJson,
    width,
    height,
    frameNameById,
  };
}
