import type { Document, DocumentFile } from './types';
import { SCHEMA_VERSION } from './types';
import { migrateDocument } from './atlases';
import { mergeDuplicateNamedAssets } from './commands';

export function serializeDocument(doc: Document): DocumentFile {
  return {
    schemaVersion: SCHEMA_VERSION,
    document: structuredClone(doc),
  };
}

export function serializeDocumentJson(doc: Document, pretty = true): string {
  return JSON.stringify(serializeDocument(doc), null, pretty ? 2 : undefined);
}

export function parseDocumentJson(json: string): Document {
  const file = JSON.parse(json) as DocumentFile;
  if (!file.document) {
    throw new Error('Invalid document file: missing document');
  }
  const doc = migrateDocument(file.document);
  // Heal legacy same-name duplicates that left canvas sprites on orphan ids
  mergeDuplicateNamedAssets(doc);
  return doc;
}

export function downloadJson(filename: string, json: string): void {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
