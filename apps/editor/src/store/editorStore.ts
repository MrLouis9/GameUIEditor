import { create } from 'zustand';
import {
  Asset,
  Document,
  DocumentHistory,
  DESIGN_PRESETS,
  AlignMode,
  NineSlice,
  TextNode,
  commands,
  createDocument,
  createId,
  downloadJson,
  findNodeInDocument,
  flattenNodes,
  getActivePage,
  migrateDocument,
  parseDocumentJson,
  serializeDocumentJson,
  SceneNode,
} from '@game-ui/document';

const STORAGE_KEY = 'game-ui-editer:document:v1';

function loadInitial(): Document {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return parseDocumentJson(raw);
  } catch {
    /* ignore */
  }
  return createDocument('未命名界面');
}

const history = new DocumentHistory(migrateDocument(loadInitial()));

interface EditorState {
  document: Document;
  canUndo: boolean;
  canRedo: boolean;
  selectedIds: string[];
  clipboard: string[];
  tool: 'select' | 'hand';
  showAssetPanel: boolean;
  camera: { x: number; y: number; zoom: number };
  rightPanel: 'assets' | 'atlas';

  syncFromHistory: () => void;
  persist: () => void;
  commit: (updater: (doc: Document) => void) => void;

  select: (ids: string[], additive?: boolean) => void;
  /** Shift-range select in flattened layer order between anchor and target. */
  selectRange: (targetId: string) => void;
  /** Keep multi-selection; move id to front as primary. */
  promoteSelection: (id: string) => void;
  clearSelection: () => void;
  setTool: (tool: 'select' | 'hand') => void;
  setCamera: (camera: Partial<EditorState['camera']>) => void;

  undo: () => void;
  redo: () => void;

  addFrame: () => void;
  addRect: () => void;
  addText: () => void;
  /** Create a new page / interface Root and switch to it. */
  addPage: () => void;
  setActivePage: (pageId: string) => void;
  addSprite: (assetId: string, position?: { x: number; y: number }) => void;
  moveLayer: (
    nodeId: string,
    targetId: string,
    mode: 'before' | 'after' | 'inside'
  ) => void;
  moveLayers: (
    nodeIds: string[],
    targetId: string,
    mode: 'before' | 'after' | 'inside'
  ) => void;
  updateNodeStyle: (
    id: string,
    patch: Partial<{
      fill: string | undefined;
      fillOpacity: number;
      cornerRadius: number;
      strokeColor: string | undefined;
      strokeWidth: number;
      strokeOpacity: number;
      clipContent: boolean;
      scaleX: number;
      scaleY: number;
      layout: Partial<import('@game-ui/document').AutoLayout>;
    }>
  ) => void;
  /** Apply style patch to all currently selected unlocked nodes. */
  updateSelectionStyle: (
    patch: Partial<{
      fill: string | undefined;
      fillOpacity: number;
      cornerRadius: number;
      strokeColor: string | undefined;
      strokeWidth: number;
      strokeOpacity: number;
      clipContent: boolean;
      scaleX: number;
      scaleY: number;
      layout: Partial<import('@game-ui/document').AutoLayout>;
    }>
  ) => void;
  resetSpriteGeometry: (id: string) => void;
  updateNodeSemantics: (
    id: string,
    patch: Partial<{
      role: import('@game-ui/document').NodeRole;
      componentKey: string | undefined;
      states: import('@game-ui/document').NodeUiState[];
      activeState: import('@game-ui/document').NodeUiState;
      binding: import('@game-ui/document').NodeBinding | undefined;
      locKey: string | undefined;
      notes: string | undefined;
    }>
  ) => void;
  setConstraints: (
    id: string,
    patch: Partial<import('@game-ui/document').Constraints>
  ) => void;
  upsertInteraction: (spec: import('@game-ui/document').InteractionSpec) => void;
  deleteSelection: () => void;
  renameSelected: (name: string) => void;
  renameNode: (id: string, name: string) => void;
  setLocked: (locked: boolean) => void;
  setVisible: (visible: boolean) => void;
  reorder: (direction: 'up' | 'down' | 'top' | 'bottom') => void;
  groupSelection: () => void;
  duplicateSelection: () => void;
  copySelection: () => void;
  pasteClipboard: () => void;
  setTransform: (
    id: string,
    transform: Partial<Document['pages'][0]['root']['transform']>,
    commit?: boolean
  ) => void;
  /** Apply the same transform patch to every selected unlocked node. */
  setSelectionTransform: (
    transform: Partial<Document['pages'][0]['root']['transform']>,
    commit?: boolean
  ) => void;
  /** Live-drag: set absolute transforms for multiple nodes in one draft. */
  setTransformsLive: (
    patches: Array<{
      id: string;
      transform: Partial<Document['pages'][0]['root']['transform']>;
    }>
  ) => void;
  flushTransform: () => void;

  addAssetFromFile: (file: File, atlasId?: string) => Promise<Asset | null>;
  removeAsset: (assetId: string) => void;
  updateAsset: (
    assetId: string,
    patch: Partial<Pick<Asset, 'name' | 'dataUrl' | 'width' | 'height' | 'nineSlice' | 'atlasId'>>
  ) => void;
  setAssetNineSlice: (assetId: string, nineSlice: NineSlice | undefined) => void;
  replaceAssetImage: (assetId: string, file: File) => Promise<void>;
  updateText: (
    id: string,
    patch: Partial<
      Pick<
        TextNode,
        | 'content'
        | 'fontSize'
        | 'fontFamily'
        | 'fontWeight'
        | 'fontStyle'
        | 'color'
        | 'align'
        | 'verticalAlign'
        | 'lineHeight'
        | 'letterSpacing'
        | 'wordWrap'
        | 'strokeColor'
        | 'strokeWidth'
        | 'strokeOpacity'
        | 'shadow'
      >
    >
  ) => void;
  updateSelectionText: (
    patch: Partial<
      Pick<
        TextNode,
        | 'content'
        | 'fontSize'
        | 'fontFamily'
        | 'fontWeight'
        | 'fontStyle'
        | 'color'
        | 'align'
        | 'verticalAlign'
        | 'lineHeight'
        | 'letterSpacing'
        | 'wordWrap'
        | 'strokeColor'
        | 'strokeWidth'
        | 'strokeOpacity'
        | 'shadow'
      >
    >
  ) => void;
  updateSpriteStateAssets: (
    id: string,
    patch: import('@game-ui/document').StateAssets
  ) => void;
  setNodeActiveState: (
    id: string,
    state: import('@game-ui/document').NodeUiState
  ) => void;

  setActiveAtlas: (atlasId: string) => void;
  createAtlas: (name: string) => void;
  renameAtlas: (atlasId: string, name: string) => void;
  deleteAtlas: (atlasId: string) => void;

  setDesignPreset: (presetId: string) => void;
  alignSelection: (mode: AlignMode) => void;
  exportJson: () => void;
  importJsonFile: (file: File) => Promise<void>;
  newDocument: () => void;
  setRightPanel: (panel: 'assets' | 'atlas') => void;
}

let transformDraft: Document | null = null;

export const useEditorStore = create<EditorState>((set, get) => {
  history.subscribe((doc, canUndo, canRedo) => {
    set({ document: structuredClone(doc), canUndo, canRedo });
    try {
      localStorage.setItem(STORAGE_KEY, serializeDocumentJson(doc, false));
    } catch {
      /* quota */
    }
  });

  return {
    document: structuredClone(history.document),
    canUndo: false,
    canRedo: false,
    selectedIds: [],
    clipboard: [],
    tool: 'select',
    showAssetPanel: true,
    camera: { x: 40, y: 40, zoom: 0.75 },
    rightPanel: 'assets' as const,

    syncFromHistory: () => {
      set({
        document: structuredClone(history.document),
        canUndo: history.canUndo,
        canRedo: history.canRedo,
      });
    },

    persist: () => {
      localStorage.setItem(
        STORAGE_KEY,
        serializeDocumentJson(history.document, false)
      );
    },

    commit: (updater) => {
      history.update(updater);
    },

    select: (ids, additive = false) => {
      if (additive) {
        const setIds = new Set(get().selectedIds);
        for (const id of ids) {
          if (setIds.has(id)) setIds.delete(id);
          else setIds.add(id);
        }
        set({ selectedIds: [...setIds] });
      } else {
        set({ selectedIds: ids });
      }
    },

    selectRange: (targetId) => {
      const doc = get().document;
      const page = getActivePage(doc);
      if (!page) {
        set({ selectedIds: [targetId] });
        return;
      }
      const flat = flattenNodes(page.root)
        .map((n) => n.id)
        .filter((id) => id !== page.root.id);
      const anchor = get().selectedIds[0] ?? targetId;
      const a = flat.indexOf(anchor);
      const b = flat.indexOf(targetId);
      if (a < 0 || b < 0) {
        set({ selectedIds: [targetId] });
        return;
      }
      const [lo, hi] = a < b ? [a, b] : [b, a];
      set({ selectedIds: flat.slice(lo, hi + 1) });
    },

    promoteSelection: (id) => {
      const cur = get().selectedIds;
      if (!cur.includes(id)) {
        set({ selectedIds: [id] });
        return;
      }
      set({ selectedIds: [id, ...cur.filter((x) => x !== id)] });
    },

    clearSelection: () => set({ selectedIds: [] }),

    setTool: (tool) => set({ tool }),

    setCamera: (camera) =>
      set((s) => ({ camera: { ...s.camera, ...camera } })),

    undo: () => {
      history.undo();
    },

    redo: () => {
      history.redo();
    },

    addFrame: () => {
      let id = '';
      history.update((doc) => {
        const node = commands.addFrame(doc);
        id = node.id;
      });
      set({ selectedIds: [id] });
    },

    addRect: () => {
      let id = '';
      history.update((doc) => {
        const node = commands.addRect(doc);
        id = node.id;
      });
      set({ selectedIds: [id] });
    },

    addText: () => {
      let id = '';
      history.update((doc) => {
        const node = commands.addText(doc);
        id = node.id;
      });
      set({ selectedIds: [id] });
    },

    addPage: () => {
      let rootId = '';
      history.update((doc) => {
        const page = commands.addPage(doc);
        rootId = page.root.id;
      });
      set({ selectedIds: [rootId] });
    },

    setActivePage: (pageId) => {
      const doc = structuredClone(history.document);
      if (!commands.setActivePage(doc, pageId)) return;
      history.replaceSilent(doc);
      const page = getActivePage(history.document);
      if (page) set({ selectedIds: [page.root.id] });
    },

    moveLayer: (nodeId, targetId, mode) => {
      history.update((doc) => {
        commands.moveLayerNodes(doc, [nodeId], targetId, mode);
      });
    },

    moveLayers: (nodeIds, targetId, mode) => {
      history.update((doc) => {
        commands.moveLayerNodes(doc, nodeIds, targetId, mode);
      });
    },

    updateNodeStyle: (id, patch) => {
      history.update((doc) => commands.updateNodeStyle(doc, id, patch));
    },

    updateSelectionStyle: (patch) => {
      const ids = get().selectedIds;
      if (!ids.length) return;
      history.update((doc) => {
        for (const id of ids) commands.updateNodeStyle(doc, id, patch);
      });
    },

    resetSpriteGeometry: (id) => {
      history.update((doc) => {
        commands.resetSpriteGeometry(doc, id);
      });
    },

    updateNodeSemantics: (id, patch) => {
      history.update((doc) => commands.updateNodeSemantics(doc, id, patch));
    },

    setConstraints: (id, patch) => {
      history.update((doc) => commands.setNodeConstraints(doc, id, patch));
    },

    upsertInteraction: (spec) => {
      history.update((doc) => commands.upsertInteraction(doc, spec));
    },

    addSprite: (assetId, position) => {
      let id = '';
      history.update((doc) => {
        const node = commands.addSpriteFromAsset(
          doc,
          assetId,
          undefined,
          position
        );
        if (node) id = node.id;
      });
      if (id) set({ selectedIds: [id] });
    },

    deleteSelection: () => {
      const ids = get().selectedIds;
      if (!ids.length) return;
      history.update((doc) => commands.deleteNodes(doc, ids));
      set({ selectedIds: [] });
    },

    renameSelected: (name) => {
      const id = get().selectedIds[0];
      if (!id) return;
      history.update((doc) => commands.renameNode(doc, id, name));
    },

    renameNode: (id, name) => {
      history.update((doc) => commands.renameNode(doc, id, name));
    },

    setLocked: (locked) => {
      const ids = get().selectedIds;
      history.update((doc) => {
        for (const id of ids) commands.setNodeLocked(doc, id, locked);
      });
    },

    setVisible: (visible) => {
      const ids = get().selectedIds;
      history.update((doc) => {
        for (const id of ids) commands.setNodeVisible(doc, id, visible);
      });
    },

    reorder: (direction) => {
      const id = get().selectedIds[0];
      if (!id) return;
      history.update((doc) => commands.reorderNode(doc, id, direction));
    },

    groupSelection: () => {
      const ids = get().selectedIds;
      let groupId: string | null = null;
      history.update((doc) => {
        groupId = commands.groupNodes(doc, ids);
      });
      if (groupId) set({ selectedIds: [groupId] });
    },

    duplicateSelection: () => {
      const ids = get().selectedIds;
      let created: string[] = [];
      history.update((doc) => {
        created = commands.duplicateNodes(doc, ids);
      });
      if (created.length) set({ selectedIds: created });
    },

    copySelection: () => {
      set({ clipboard: [...get().selectedIds] });
    },

    pasteClipboard: () => {
      const ids = get().clipboard;
      if (!ids.length) return;
      let created: string[] = [];
      history.update((doc) => {
        created = commands.duplicateNodes(doc, ids);
      });
      if (created.length) set({ selectedIds: created });
    },

    setTransform: (id, transform, commit = false) => {
      if (commit) {
        history.update((doc) => commands.setNodeTransform(doc, id, transform));
        transformDraft = null;
        return;
      }
      if (!transformDraft) {
        transformDraft = structuredClone(history.document);
      }
      commands.setNodeTransform(transformDraft, id, transform);
      set({ document: structuredClone(transformDraft) });
    },

    setSelectionTransform: (transform, commit = false) => {
      const ids = get().selectedIds;
      if (!ids.length) return;
      if (commit) {
        history.update((doc) => {
          for (const id of ids) commands.setNodeTransform(doc, id, transform);
        });
        transformDraft = null;
        return;
      }
      if (!transformDraft) {
        transformDraft = structuredClone(history.document);
      }
      for (const id of ids) {
        commands.setNodeTransform(transformDraft, id, transform);
      }
      set({ document: structuredClone(transformDraft) });
    },

    setTransformsLive: (patches) => {
      if (!patches.length) return;
      if (!transformDraft) {
        transformDraft = structuredClone(history.document);
      }
      for (const { id, transform } of patches) {
        commands.setNodeTransform(transformDraft, id, transform);
      }
      set({ document: structuredClone(transformDraft) });
    },

    flushTransform: () => {
      if (!transformDraft) return;
      history.commit(transformDraft);
      transformDraft = null;
    },

    addAssetFromFile: async (file, atlasId) => {
      const dataUrl = await readFileAsDataUrl(file);
      const img = await loadHtmlImage(dataUrl);
      const targetAtlas = atlasId ?? history.document.activeAtlasId;
      const asset: Asset = {
        id: createId('asset'),
        name: file.name.replace(/\.[^.]+$/, ''),
        atlasId: targetAtlas,
        width: img.naturalWidth,
        height: img.naturalHeight,
        dataUrl,
      };
      history.update((doc) => commands.addAsset(doc, asset));
      return asset;
    },

    removeAsset: (assetId) => {
      history.update((doc) => commands.removeAsset(doc, assetId));
    },

    updateAsset: (assetId, patch) => {
      history.update((doc) => commands.updateAsset(doc, assetId, patch));
    },

    setAssetNineSlice: (assetId, nineSlice) => {
      history.update((doc) =>
        commands.updateAssetNineSlice(doc, assetId, nineSlice)
      );
    },

    replaceAssetImage: async (assetId, file) => {
      const dataUrl = await readFileAsDataUrl(file);
      const img = await loadHtmlImage(dataUrl);
      history.update((doc) =>
        commands.updateAsset(doc, assetId, {
          dataUrl,
          width: img.naturalWidth,
          height: img.naturalHeight,
        })
      );
    },

    updateText: (id, patch) => {
      history.update((doc) => commands.updateTextNode(doc, id, patch));
    },

    updateSelectionText: (patch) => {
      const ids = get().selectedIds;
      if (!ids.length) return;
      history.update((doc) => {
        for (const id of ids) {
          const found = findNodeInDocument(doc, id);
          if (found?.node.type === 'text') {
            commands.updateTextNode(doc, id, patch);
          }
        }
      });
    },

    updateSpriteStateAssets: (id, patch) => {
      history.update((doc) => commands.updateSpriteStateAssets(doc, id, patch));
    },

    setNodeActiveState: (id, state) => {
      history.update((doc) => commands.setNodeActiveState(doc, id, state));
    },

    setActiveAtlas: (atlasId) => {
      const doc = structuredClone(history.document);
      commands.setActiveAtlas(doc, atlasId);
      history.replaceSilent(doc);
    },

    createAtlas: (name) => {
      history.update((doc) => {
        commands.addAtlas(doc, name);
      });
    },

    renameAtlas: (atlasId, name) => {
      history.update((doc) => commands.renameAtlas(doc, atlasId, name));
    },

    deleteAtlas: (atlasId) => {
      history.update((doc) => commands.deleteAtlas(doc, atlasId));
    },

    setDesignPreset: (presetId) => {
      const preset = DESIGN_PRESETS.find((p) => p.id === presetId);
      if (!preset) return;
      history.update((doc) =>
        commands.setDesignSize(doc, preset.width, preset.height, preset.orientation)
      );
    },

    alignSelection: (mode) => {
      const ids = get().selectedIds;
      if (!ids.length) return;
      history.update((doc) => commands.alignNodes(doc, ids, mode));
    },

    setRightPanel: (panel) => set({ rightPanel: panel }),

    exportJson: () => {
      const doc = history.document;
      const safeName = (doc.name || 'ui').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'ui';
      downloadJson(`${safeName}.gameui.json`, serializeDocumentJson(doc));
    },

    importJsonFile: async (file) => {
      const text = await file.text();
      const doc = parseDocumentJson(text);
      history.reset(doc);
      set({ selectedIds: [] });
    },

    newDocument: () => {
      history.reset(createDocument('未命名界面'));
      set({ selectedIds: [] });
    },
  };
});

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function getSelectedNode(): SceneNode | null {
  const { document: doc, selectedIds } = useEditorStore.getState();
  if (!selectedIds[0]) return null;
  return findNodeInDocument(doc, selectedIds[0])?.node ?? null;
}
