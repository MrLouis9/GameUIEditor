import type { Atlas, Asset, Document } from './types';
import { normalizeNodeDefaults } from './layout';

function makeId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createAtlas(name: string, id?: string): Atlas {
  return {
    id: id ?? makeId('atlas'),
    name,
  };
}

/** Upgrade older documents to multi-atlas + node defaults + v4 semantics. */
export function migrateDocument(raw: unknown): Document {
  const doc = structuredClone(raw) as Document & {
    atlases?: Atlas[];
    activeAtlasId?: string;
    assets?: Array<Asset & { atlasId?: string }>;
    interactions?: Document['interactions'];
  };

  if (!doc.atlases || doc.atlases.length === 0) {
    const atlas = createAtlas('默认图集');
    doc.atlases = [atlas];
    doc.activeAtlasId = atlas.id;
  }

  if (!doc.activeAtlasId || !doc.atlases.some((a) => a.id === doc.activeAtlasId)) {
    doc.activeAtlasId = doc.atlases[0].id;
  }

  doc.assets = (doc.assets ?? []).map((asset) => ({
    ...asset,
    atlasId:
      asset.atlasId && doc.atlases.some((a) => a.id === asset.atlasId)
        ? asset.atlasId
        : doc.activeAtlasId,
  }));

  if (!Array.isArray(doc.interactions)) {
    doc.interactions = [];
  }

  for (const page of doc.pages ?? []) {
    if (page.root) normalizeNodeDefaults(page.root);
  }

  return doc as Document;
}

export function getActiveAtlas(doc: Document): Atlas | undefined {
  return doc.atlases.find((a) => a.id === doc.activeAtlasId) ?? doc.atlases[0];
}

export function getAssetsInAtlas(doc: Document, atlasId?: string): Asset[] {
  const id = atlasId ?? doc.activeAtlasId;
  return doc.assets.filter((a) => a.atlasId === id);
}
