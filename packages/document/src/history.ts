import type { Document } from './types';

export type HistoryListener = (doc: Document, canUndo: boolean, canRedo: boolean) => void;

/**
 * Snapshot-based history. Simple and reliable for P1 document sizes.
 * Can be replaced with command patches later without changing editor API.
 */
export class DocumentHistory {
  private past: Document[] = [];
  private future: Document[] = [];
  private current: Document;
  private listeners = new Set<HistoryListener>();
  private maxSize: number;

  constructor(initial: Document, maxSize = 80) {
    this.current = structuredClone(initial);
    this.maxSize = maxSize;
  }

  get document(): Document {
    return this.current;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  subscribe(listener: HistoryListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.current, this.canUndo, this.canRedo);
    }
  }

  /** Replace current without pushing history (e.g. load file). */
  reset(doc: Document): void {
    this.current = structuredClone(doc);
    this.past = [];
    this.future = [];
    this.notify();
  }

  /** Mutate current without undo entry (e.g. active atlas tab). */
  replaceSilent(doc: Document): void {
    this.current = structuredClone(doc);
    this.notify();
  }

  /** Commit a new document snapshot (pushes undo stack). */
  commit(next: Document): void {
    this.past.push(structuredClone(this.current));
    if (this.past.length > this.maxSize) {
      this.past.shift();
    }
    this.current = structuredClone(next);
    this.future = [];
    this.notify();
  }

  /** Mutate via updater; auto-commit snapshot. */
  update(updater: (draft: Document) => void): void {
    const draft = structuredClone(this.current);
    updater(draft);
    this.commit(draft);
  }

  undo(): Document | null {
    if (!this.canUndo) return null;
    this.future.push(structuredClone(this.current));
    this.current = this.past.pop()!;
    this.notify();
    return this.current;
  }

  redo(): Document | null {
    if (!this.canRedo) return null;
    this.past.push(structuredClone(this.current));
    this.current = this.future.pop()!;
    this.notify();
    return this.current;
  }
}
