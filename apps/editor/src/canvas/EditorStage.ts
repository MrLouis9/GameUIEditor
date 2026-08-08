import {
  Application,
  Container,
  Graphics,
  NineSliceSprite,
  Rectangle,
  Sprite,
  Text,
  Texture,
  FederatedPointerEvent,
} from 'pixi.js';
import type { Asset, Document, SceneNode, TextNode, Mat2D } from '@game-ui/document';
import {
  ASSET_DRAG_MIME,
  decodeAssetDragPayload,
  findNodeInDocument,
  getActivePage,
  resolvePivot,
  nodeLocalMatrix,
  multiplyMat,
  aabbFromMatrix,
  IDENTITY_MAT,
  getNodeWorldBounds,
  resolveSpriteAssetId,
  normalizeTextShadow,
} from '@game-ui/document';

export interface CanvasCallbacks {
  onSelect: (ids: string[], additive: boolean) => void;
  onSelectRange?: (targetId: string) => void;
  onPromoteSelection?: (id: string) => void;
  onTransformLive: (
    id: string,
    transform: {
      x?: number;
      y?: number;
      width?: number;
      height?: number;
    }
  ) => void;
  onTransformsLive?: (
    patches: Array<{
      id: string;
      transform: {
        x?: number;
        y?: number;
        width?: number;
        height?: number;
      };
    }>
  ) => void;
  onTransformEnd: () => void;
  getTool: () => 'select' | 'hand';
  getSelectedIds: () => string[];
  getDocument: () => Document;
  onAssetDrop?: (assetId: string, artboardPos: { x: number; y: number }) => void;
  onCameraChange?: (camera: { x: number; y: number; zoom: number }) => void;
}

type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

interface DragState {
  mode: 'move' | 'pan' | 'resize';
  nodeId?: string;
  /** Origins for multi-move (id → {x,y}). */
  moveOrigins?: Map<string, { x: number; y: number }>;
  handle?: HandleId;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  originW: number;
  originH: number;
  cameraX: number;
  cameraY: number;
}

const HANDLE_SIZE = 8;
const MIN_SIZE = 4;

export interface EditorStageOptions {
  /** When false, no pan/select/drag (preview mode). */
  interactive?: boolean;
}

export class EditorStage {
  app: Application | null = null;
  world = new Container();
  artboard = new Container();
  content = new Container();
  overlay = new Container();
  private nodeMap = new Map<string, Container>();
  private textureCache = new Map<string, Texture>();
  private textureSource = new Map<string, string>();
  private callbacks: CanvasCallbacks;
  private drag: DragState | null = null;
  private camera = { x: 40, y: 40, zoom: 0.75 };
  private artboardBg = new Graphics();
  private selectionGfx = new Graphics();
  private handlesLayer = new Container();
  private handleHit: Partial<Record<HandleId, Graphics>> = {};
  private disposed = false;
  private activeDoc: Document | null = null;
  private interactive: boolean;
  /** Guard overlapping async syncDocument calls (asset updates). */
  private syncGeneration = 0;
  private hostEl: HTMLElement | null = null;
  private panPointerId: number | null = null;
  /** Destroy after scene rebuild so live sprites never hold a freed GPU texture. */
  private pendingTextureDestroy: Texture[] = [];

  constructor(callbacks: CanvasCallbacks, options?: EditorStageOptions) {
    this.callbacks = callbacks;
    this.interactive = options?.interactive !== false;
    this.world.addChild(this.artboard);
    this.artboard.addChild(this.artboardBg);
    this.artboard.addChild(this.content);
    this.world.addChild(this.overlay);
    this.overlay.addChild(this.selectionGfx);
    this.overlay.addChild(this.handlesLayer);
    this.handlesLayer.eventMode = 'static';
  }

  async mount(host: HTMLElement): Promise<void> {
    const app = new Application();
    await app.init({
      resizeTo: host,
      background: '#0b0e14',
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    });
    if (this.disposed) {
      app.destroy(true);
      return;
    }
    this.app = app;
    this.hostEl = host;
    host.appendChild(app.canvas);
    app.stage.addChild(this.world);
    app.stage.eventMode = this.interactive ? 'static' : 'none';
    app.stage.hitArea = app.screen;

    if (this.interactive) {
      app.canvas.addEventListener('dragover', this.onCanvasDragOver);
      app.canvas.addEventListener('drop', this.onCanvasDrop);
      // Middle-pan: native capture + preventDefault blocks Chrome autoscroll
      app.canvas.style.touchAction = 'none';
      const panOpts: AddEventListenerOptions = { capture: true };
      app.canvas.addEventListener('mousedown', this.onNativeMouseDown, panOpts);
      app.canvas.addEventListener('auxclick', this.onNativeAuxClick, panOpts);
      app.canvas.addEventListener('pointerdown', this.onNativePointerDown, panOpts);
      // Also on host — covers letterboxing / hit-area edge cases
      host.addEventListener('mousedown', this.onNativeMouseDown, panOpts);
      host.addEventListener('pointerdown', this.onNativePointerDown, panOpts);
      window.addEventListener('pointermove', this.onNativePointerMove);
      window.addEventListener('pointerup', this.onNativePointerUp);
      window.addEventListener('pointercancel', this.onNativePointerUp);
      app.stage.on('pointerdown', this.onPointerDown);
      app.stage.on('pointermove', this.onPointerMove);
      app.stage.on('pointerup', this.onPointerUp);
      app.stage.on('pointerupoutside', this.onPointerUp);
      host.addEventListener('wheel', this.onWheel, { passive: false });
    }

    this.applyCamera();
  }

  destroy(): void {
    this.disposed = true;
    const canvas = this.app?.canvas;
    const host = this.hostEl ?? canvas?.parentElement;
    if (this.interactive && canvas) {
      canvas.removeEventListener('dragover', this.onCanvasDragOver);
      canvas.removeEventListener('drop', this.onCanvasDrop);
      canvas.removeEventListener('mousedown', this.onNativeMouseDown, true);
      canvas.removeEventListener('auxclick', this.onNativeAuxClick, true);
      canvas.removeEventListener('pointerdown', this.onNativePointerDown, true);
      window.removeEventListener('pointermove', this.onNativePointerMove);
      window.removeEventListener('pointerup', this.onNativePointerUp);
      window.removeEventListener('pointercancel', this.onNativePointerUp);
    }
    if (this.interactive && host) {
      host.removeEventListener('mousedown', this.onNativeMouseDown, true);
      host.removeEventListener('pointerdown', this.onNativePointerDown, true);
      host.removeEventListener('wheel', this.onWheel);
    }
    this.hostEl = null;
    this.app?.destroy(true);
    this.app = null;
    this.nodeMap.clear();
    for (const tex of this.textureCache.values()) {
      try {
        tex.destroy(true);
      } catch {
        /* ignore */
      }
    }
    this.textureCache.clear();
    this.textureSource.clear();
  }

  setCamera(camera: { x: number; y: number; zoom: number }): void {
    this.camera = { ...camera };
    this.applyCamera();
    if (this.activeDoc) this.drawSelection(this.activeDoc);
  }

  /** Convert browser client coordinates to artboard (design) space. */
  clientToArtboard(clientX: number, clientY: number): { x: number; y: number } | null {
    if (!this.app) return null;
    const canvas = this.app.canvas;
    const bounds = canvas.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return null;
    const sx = ((clientX - bounds.left) / bounds.width) * this.app.screen.width;
    const sy = ((clientY - bounds.top) / bounds.height) * this.app.screen.height;
    const world = this.world.toLocal({ x: sx, y: sy });
    return { x: world.x, y: world.y };
  }

  getCamera(): { x: number; y: number; zoom: number } {
    return { ...this.camera };
  }

  /** Fit the artboard into the current viewport (preview / reset view). */
  fitArtboard(padding = 32): void {
    if (!this.app || !this.activeDoc) return;
    const page = getActivePage(this.activeDoc);
    if (!page) return;
    const w = page.root.transform.width || this.activeDoc.designSize.width;
    const h = page.root.transform.height || this.activeDoc.designSize.height;
    const sw = this.app.screen.width;
    const sh = this.app.screen.height;
    const zoom = Math.min((sw - padding * 2) / w, (sh - padding * 2) / h, 2);
    this.camera = {
      zoom,
      x: (sw - w * zoom) / 2,
      y: (sh - h * zoom) / 2,
    };
    this.applyCamera();
    if (this.interactive) this.drawSelection(this.activeDoc);
  }

  private applyCamera(): void {
    this.world.position.set(this.camera.x, this.camera.y);
    this.world.scale.set(this.camera.zoom);
  }

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const next = Math.min(3, Math.max(0.2, this.camera.zoom * zoomFactor));
    this.camera.zoom = next;
    this.applyCamera();
    this.callbacks.onCameraChange?.({ ...this.camera });
    if (this.activeDoc) this.drawSelection(this.activeDoc);
  };

  private onCanvasDragOver = (e: DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  };

  private onCanvasDrop = (e: DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.dataTransfer || !this.callbacks.onAssetDrop) return;
    const raw =
      e.dataTransfer.getData(ASSET_DRAG_MIME) ||
      e.dataTransfer.getData('text/plain') ||
      e.dataTransfer.getData('text');
    const assetId = decodeAssetDragPayload(raw) ?? (raw?.startsWith('asset_') ? raw : null);
    if (!assetId) return;
    const pos = this.clientToArtboard(e.clientX, e.clientY);
    if (!pos) return;
    this.callbacks.onAssetDrop(assetId, pos);
  };

  private onNativeMouseDown = (e: MouseEvent): void => {
    // Middle button: stop browser autoscroll (otherwise pan "fails" often)
    if (e.button === 1) {
      e.preventDefault();
    }
  };

  private onNativeAuxClick = (e: MouseEvent): void => {
    if (e.button === 1) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  private onNativePointerDown = (e: PointerEvent): void => {
    if (e.button !== 1) return;
    e.preventDefault();
    e.stopPropagation();
    // Already panning with this pointer
    if (this.panPointerId === e.pointerId) return;
    this.panPointerId = e.pointerId;
    this.drag = {
      mode: 'pan',
      startX: e.clientX,
      startY: e.clientY,
      originX: 0,
      originY: 0,
      originW: 0,
      originH: 0,
      cameraX: this.camera.x,
      cameraY: this.camera.y,
    };
    const captureEl = this.app?.canvas ?? this.hostEl;
    try {
      captureEl?.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  private onNativePointerMove = (e: PointerEvent): void => {
    if (!this.drag || this.drag.mode !== 'pan') return;
    if (this.panPointerId != null && e.pointerId !== this.panPointerId) return;
    // Native middle-pan uses client coords (not Pixi global)
    if (this.panPointerId != null) {
      const dx = e.clientX - this.drag.startX;
      const dy = e.clientY - this.drag.startY;
      this.camera.x = this.drag.cameraX + dx;
      this.camera.y = this.drag.cameraY + dy;
      this.applyCamera();
      this.callbacks.onCameraChange?.({ ...this.camera });
      if (this.activeDoc) this.drawSelection(this.activeDoc);
    }
  };

  private onNativePointerUp = (e: PointerEvent): void => {
    if (this.panPointerId == null) return;
    if (e.pointerId !== this.panPointerId && e.type !== 'pointercancel') return;
    const captureEl = this.app?.canvas ?? this.hostEl;
    try {
      captureEl?.releasePointerCapture(this.panPointerId);
    } catch {
      /* ignore */
    }
    this.panPointerId = null;
    if (this.drag?.mode === 'pan') {
      this.drag = null;
    }
  };

  async syncDocument(doc: Document): Promise<void> {
    const gen = ++this.syncGeneration;
    this.activeDoc = doc;
    const page = getActivePage(doc);
    if (!page) return;

    const { width, height } = doc.designSize;
    this.artboardBg.clear();
    this.artboardBg.rect(0, 0, width, height);
    this.artboardBg.fill({ color: 0x1a1d27 });
    this.artboardBg.stroke({ width: 1, color: 0x3b4254 });

    // Load textures first (tolerate individual failures)
    await Promise.all(
      doc.assets.map(async (asset) => {
        try {
          await this.ensureTexture(asset);
        } catch (err) {
          console.warn('[EditorStage] texture load failed', asset.name, err);
        }
      })
    );
    if (gen !== this.syncGeneration || this.disposed) return;

    const keep = new Set<string>();
    this.syncNodeTree(page.root, this.content, doc.assets, keep, true);

    for (const [id, display] of [...this.nodeMap]) {
      if (!keep.has(id)) {
        display.removeFromParent();
        // Do not destroy() with children:true — child node containers are reused via nodeMap.
        display.destroy({ children: false });
        this.nodeMap.delete(id);
      }
    }

    // Drop textures for assets no longer in the document
    const assetIds = new Set(doc.assets.map((a) => a.id));
    for (const [id, tex] of [...this.textureCache]) {
      if (!assetIds.has(id)) {
        this.textureCache.delete(id);
        this.textureSource.delete(id);
        this.pendingTextureDestroy.push(tex);
      }
    }
    this.flushPendingTextureDestroy();

    if (this.interactive) this.drawSelection(doc);
    else {
      this.selectionGfx.clear();
      this.handlesLayer.removeChildren().forEach((c) => c.destroy());
    }
  }

  private flushPendingTextureDestroy(): void {
    const list = this.pendingTextureDestroy;
    this.pendingTextureDestroy = [];
    for (const tex of list) {
      try {
        tex.destroy(true);
      } catch {
        /* ignore */
      }
    }
  }

  private async ensureTexture(asset: Asset): Promise<Texture> {
    const prev = this.textureSource.get(asset.id);
    const cached = this.textureCache.get(asset.id);
    const cachedOk =
      !!cached &&
      !cached.destroyed &&
      prev === asset.dataUrl &&
      !!asset.dataUrl &&
      (cached.width > 0 || (cached.source?.width ?? 0) > 0);
    if (cachedOk && cached) {
      return cached;
    }

    if (!asset.dataUrl) {
      if (cached) {
        this.textureCache.delete(asset.id);
        this.pendingTextureDestroy.push(cached);
      }
      this.textureSource.delete(asset.id);
      throw new Error(`Asset has empty dataUrl: ${asset.name}`);
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () =>
        reject(new Error(`Failed to load asset image: ${asset.name}`));
      img.src = asset.dataUrl;
    });
    try {
      await img.decode();
    } catch {
      /* decode optional */
    }

    const texture = Texture.from(img);
    // Swap cache; destroy old only after scene rebuild (see syncDocument)
    const old = this.textureCache.get(asset.id);
    this.textureCache.set(asset.id, texture);
    this.textureSource.set(asset.id, asset.dataUrl);
    if (old && old !== texture) {
      this.pendingTextureDestroy.push(old);
    }
    return texture;
  }

  private syncNodeTree(
    node: SceneNode,
    parent: Container,
    assets: Asset[],
    keep: Set<string>,
    isRoot: boolean
  ): void {
    keep.add(node.id);

    let display = this.nodeMap.get(node.id);
    if (!display) {
      display = new Container();
      display.eventMode = 'static';
      display.cursor = 'pointer';
      (display as Container & { nodeId?: string }).nodeId = node.id;
      this.nodeMap.set(node.id, display);
      parent.addChild(display);
    } else if (display.parent !== parent) {
      parent.addChild(display);
    }

    display.visible = node.visible;
    display.alpha = node.transform.opacity;
    if (isRoot) {
      display.pivot.set(0, 0);
      display.position.set(0, 0);
      display.rotation = 0;
      display.scale.set(1, 1);
    } else {
      const t = node.transform;
      const pivot = resolvePivot(node);
      const px = pivot.x * t.width;
      const py = pivot.y * t.height;
      // x/y = unscaled box top-left; rotation & scale around pivot (default center)
      display.pivot.set(px, py);
      display.position.set(t.x + px, t.y + py);
      display.rotation = (t.rotation * Math.PI) / 180;
      display.scale.set(node.scaleX ?? 1, node.scaleY ?? 1);
    }
    display.mask = null;

    const visuals = display.children.filter(
      (c) => !(c as Container & { nodeId?: string }).nodeId
    );
    for (const v of visuals) {
      try {
        // Never free shared atlas textures — they live in textureCache
        v.destroy({ children: true, texture: false, textureSource: false });
      } catch {
        /* destroyed texture refs */
      }
    }

    // Background fill + stroke (frames / groups / rects)
    if (node.type === 'rect' || ((node.type === 'frame' || node.type === 'group') && (node.fill || node.strokeWidth))) {
      const g = new Graphics();
      const r = Math.min(
        node.cornerRadius ?? 0,
        node.transform.width / 2,
        node.transform.height / 2
      );
      if (r > 0) {
        g.roundRect(0, 0, node.transform.width, node.transform.height, r);
      } else {
        g.rect(0, 0, node.transform.width, node.transform.height);
      }
      if (node.fill) {
        g.fill({
          color: parseColor(node.fill),
          alpha: node.fillOpacity ?? 1,
        });
      } else if (node.type === 'rect') {
        g.fill({
          color: parseColor('#4f6ef7'),
          alpha: node.fillOpacity ?? 1,
        });
      }
      if ((node.strokeWidth ?? 0) > 0 && node.strokeColor) {
        g.stroke({
          width: node.strokeWidth,
          color: parseColor(node.strokeColor),
          alpha: node.strokeOpacity ?? 1,
        });
      }
      display.addChildAt(g, 0);
    }

    if (node.type === 'sprite') {
      const resolvedId = resolveSpriteAssetId(node);
      const asset = assets.find((a) => a.id === resolvedId);
      const texture = asset ? this.textureCache.get(asset.id) : undefined;
      const texW = texture ? texture.width || texture.source?.width || 0 : 0;
      const texH = texture ? texture.height || texture.source?.height || 0 : 0;
      if (texture && texW > 0 && texH > 0) {
        const slice = node.nineSlice ?? asset?.nineSlice;
        if (slice && (slice.top || slice.right || slice.bottom || slice.left)) {
          const nine = new NineSliceSprite({
            texture,
            leftWidth: slice.left,
            topHeight: slice.top,
            rightWidth: slice.right,
            bottomHeight: slice.bottom,
          });
          nine.width = node.transform.width;
          nine.height = node.transform.height;
          display.addChildAt(nine, 0);
        } else {
          const sprite = new Sprite(texture);
          sprite.width = node.transform.width;
          sprite.height = node.transform.height;
          display.addChildAt(sprite, 0);
        }
      } else {
        // Placeholder so empty/missing texture is still visible while debugging
        const g = new Graphics();
        g.rect(0, 0, node.transform.width, node.transform.height);
        g.fill({ color: 0xff6688, alpha: 0.35 });
        g.stroke({ width: 1, color: 0xff6688 });
        display.addChildAt(g, 0);
      }
      display.hitArea = new Rectangle(0, 0, node.transform.width, node.transform.height);
    } else if (node.type === 'text') {
      const text = buildPixiText(node);
      display.addChildAt(text, 0);
      display.hitArea = new Rectangle(0, 0, node.transform.width, node.transform.height);
    } else if (node.type === 'frame' || node.type === 'group' || node.type === 'rect') {
      display.hitArea = new Rectangle(0, 0, node.transform.width, node.transform.height);
    }

    display.eventMode = node.locked ? 'none' : 'static';

    if (node.children) {
      for (const child of node.children) {
        this.syncNodeTree(child, display, assets, keep, false);
      }
      // Enforce array order = draw order (later = higher z / front)
      let slot = 0;
      for (const child of display.children) {
        if (!(child as Container & { nodeId?: string }).nodeId) slot++;
      }
      for (const child of node.children) {
        const childDisplay = this.nodeMap.get(child.id);
        if (childDisplay && childDisplay.parent === display) {
          display.addChildAt(childDisplay, slot++);
        }
      }
    }

    if (node.clipContent) {
      const mask = new Graphics();
      const r = Math.min(
        node.cornerRadius ?? 0,
        node.transform.width / 2,
        node.transform.height / 2
      );
      if (r > 0) {
        mask.roundRect(0, 0, node.transform.width, node.transform.height, r);
      } else {
        mask.rect(0, 0, node.transform.width, node.transform.height);
      }
      mask.fill({ color: 0xffffff });
      display.addChild(mask);
      display.mask = mask;
    }
  }

  drawSelection(doc: Document): void {
    this.selectionGfx.clear();
    this.handlesLayer.removeChildren().forEach((c) => c.destroy());
    this.handleHit = {};

    const ids = this.callbacks.getSelectedIds();
    const page = getActivePage(doc);
    if (!page || !ids.length) return;

    const primaryId = ids[0];
    for (const id of ids) {
      if (id === page.root.id) continue;
      const box = getAbsoluteNodeRect(page.root, id);
      if (!box) continue;
      this.selectionGfx.rect(box.x, box.y, box.w, box.h);
      this.selectionGfx.stroke({
        width: 1 / this.camera.zoom,
        color: 0x4f8cff,
      });
    }

    if (primaryId === page.root.id) return;
    const found = findNodeInDocument(doc, primaryId);
    if (!found || found.node.locked) return;

    const box = getAbsoluteNodeRect(page.root, primaryId);
    if (!box) return;

    const hs = HANDLE_SIZE / this.camera.zoom;
    const positions: Record<HandleId, { x: number; y: number; cursor: string }> = {
      nw: { x: box.x, y: box.y, cursor: 'nwse-resize' },
      n: { x: box.x + box.w / 2, y: box.y, cursor: 'ns-resize' },
      ne: { x: box.x + box.w, y: box.y, cursor: 'nesw-resize' },
      e: { x: box.x + box.w, y: box.y + box.h / 2, cursor: 'ew-resize' },
      se: { x: box.x + box.w, y: box.y + box.h, cursor: 'nwse-resize' },
      s: { x: box.x + box.w / 2, y: box.y + box.h, cursor: 'ns-resize' },
      sw: { x: box.x, y: box.y + box.h, cursor: 'nesw-resize' },
      w: { x: box.x, y: box.y + box.h / 2, cursor: 'ew-resize' },
    };

    for (const [id, pos] of Object.entries(positions) as [HandleId, (typeof positions)[HandleId]][]) {
      const g = new Graphics();
      g.rect(-hs / 2, -hs / 2, hs, hs);
      g.fill({ color: 0xffffff });
      g.stroke({ width: 1 / this.camera.zoom, color: 0x4f8cff });
      g.position.set(pos.x, pos.y);
      g.eventMode = 'static';
      g.cursor = pos.cursor;
      g.hitArea = new Rectangle(-hs / 2, -hs / 2, hs, hs);
      (g as Graphics & { handleId?: HandleId }).handleId = id;
      g.on('pointerdown', (e: FederatedPointerEvent) => {
        e.stopPropagation();
        this.beginResize(primaryId, id, e);
      });
      this.handlesLayer.addChild(g);
      this.handleHit[id] = g;
    }
  }

  private beginResize(nodeId: string, handle: HandleId, e: FederatedPointerEvent): void {
    const doc = this.callbacks.getDocument();
    const found = findNodeInDocument(doc, nodeId);
    if (!found || found.node.locked) return;
    const t = found.node.transform;
    this.drag = {
      mode: 'resize',
      nodeId,
      handle,
      startX: e.globalX,
      startY: e.globalY,
      originX: t.x,
      originY: t.y,
      originW: t.width,
      originH: t.height,
      cameraX: this.camera.x,
      cameraY: this.camera.y,
    };
  }

  /** Front-most node under artboard point (document space), skipping root. */
  private pickNodeAt(artboardX: number, artboardY: number, doc: Document): string | null {
    const page = getActivePage(doc);
    if (!page) return null;
    const stack: AbsNodeRect[] = [];
    collectAbsoluteRects(page.root, IDENTITY_MAT, true, stack);
    for (let i = stack.length - 1; i >= 0; i--) {
      const r = stack[i]!;
      if (!r.visible || r.locked) continue;
      if (
        artboardX >= r.x &&
        artboardX <= r.x + r.w &&
        artboardY >= r.y &&
        artboardY <= r.y + r.h
      ) {
        return r.id;
      }
    }
    return null;
  }

  private onPointerDown = (e: FederatedPointerEvent): void => {
    if (this.drag?.mode === 'resize') return;
    // Middle pan is handled by native listeners (more reliable vs browser autoscroll)
    if (e.button === 1 || this.panPointerId != null) return;

    // Resize handles stop propagation; anything else uses document-space picking.
    const handleId = (e.target as Graphics & { handleId?: HandleId } | null)?.handleId;
    if (handleId) return;

    const tool = this.callbacks.getTool();
    if (tool === 'hand') {
      this.drag = {
        mode: 'pan',
        startX: e.globalX,
        startY: e.globalY,
        originX: 0,
        originY: 0,
        originW: 0,
        originH: 0,
        cameraX: this.camera.x,
        cameraY: this.camera.y,
      };
      return;
    }

    const artboardPt = this.app
      ? this.world.toLocal(e.global)
      : null;
    const doc = this.callbacks.getDocument();
    const nodeId = artboardPt
      ? this.pickNodeAt(artboardPt.x, artboardPt.y, doc)
      : null;
    const page = getActivePage(doc);
    const rootId = page?.root.id;

    if (!nodeId || nodeId === rootId) {
      this.callbacks.onSelect([], false);
      return;
    }

    const selected = this.callbacks.getSelectedIds();
    const additive = e.ctrlKey || e.metaKey;
    const range = e.shiftKey;

    if (range && this.callbacks.onSelectRange) {
      this.callbacks.onSelectRange(nodeId);
    } else if (additive) {
      this.callbacks.onSelect([nodeId], true);
    } else if (selected.includes(nodeId) && selected.length > 1) {
      this.callbacks.onPromoteSelection?.(nodeId);
    } else {
      this.callbacks.onSelect([nodeId], false);
    }

    const found = findNodeInDocument(doc, nodeId);
    if (!found || found.node.locked) return;

    // After selection update, resolve move set from latest selection
    const moveIds = (() => {
      const ids = this.callbacks.getSelectedIds();
      if (ids.includes(nodeId) && ids.length > 1) {
        return ids.filter((id) => {
          const f = findNodeInDocument(doc, id);
          return !!f && !f.node.locked && id !== rootId;
        });
      }
      return [nodeId];
    })();

    const moveOrigins = new Map<string, { x: number; y: number }>();
    for (const id of moveIds) {
      const f = findNodeInDocument(doc, id);
      if (f) {
        moveOrigins.set(id, {
          x: f.node.transform.x,
          y: f.node.transform.y,
        });
      }
    }

    this.drag = {
      mode: 'move',
      nodeId,
      moveOrigins,
      startX: e.globalX,
      startY: e.globalY,
      originX: found.node.transform.x,
      originY: found.node.transform.y,
      originW: 0,
      originH: 0,
      cameraX: this.camera.x,
      cameraY: this.camera.y,
    };
  };

  private onPointerMove = (e: FederatedPointerEvent): void => {
    if (!this.drag) return;
    // Native middle-pan owns pointermove while panPointerId is set
    if (this.drag.mode === 'pan' && this.panPointerId != null) return;
    if (this.drag.mode === 'pan') {
      const dx = e.globalX - this.drag.startX;
      const dy = e.globalY - this.drag.startY;
      this.camera.x = this.drag.cameraX + dx;
      this.camera.y = this.drag.cameraY + dy;
      this.applyCamera();
      this.callbacks.onCameraChange?.({ ...this.camera });
      return;
    }
    if (this.drag.mode === 'move' && this.drag.nodeId) {
      const dx = (e.globalX - this.drag.startX) / this.camera.zoom;
      const dy = (e.globalY - this.drag.startY) / this.camera.zoom;
      const origins = this.drag.moveOrigins;
      if (origins && origins.size > 1 && this.callbacks.onTransformsLive) {
        const patches: Array<{
          id: string;
          transform: { x: number; y: number };
        }> = [];
        for (const [id, origin] of origins) {
          patches.push({
            id,
            transform: { x: origin.x + dx, y: origin.y + dy },
          });
        }
        this.callbacks.onTransformsLive(patches);
      } else {
        this.callbacks.onTransformLive(this.drag.nodeId, {
          x: this.drag.originX + dx,
          y: this.drag.originY + dy,
        });
      }
      return;
    }
    if (this.drag.mode === 'resize' && this.drag.nodeId && this.drag.handle) {
      const dx = (e.globalX - this.drag.startX) / this.camera.zoom;
      const dy = (e.globalY - this.drag.startY) / this.camera.zoom;
      const next = computeResize(
        this.drag.handle,
        this.drag.originX,
        this.drag.originY,
        this.drag.originW,
        this.drag.originH,
        dx,
        dy
      );
      this.callbacks.onTransformLive(this.drag.nodeId, next);
    }
  };

  private onPointerUp = (): void => {
    // Native middle-pan owns its own pointerup; Pixi must not clear it mid-drag
    if (this.panPointerId != null) return;
    if (this.drag?.mode === 'move' || this.drag?.mode === 'resize') {
      this.callbacks.onTransformEnd();
    }
    this.drag = null;
  };
}

function computeResize(
  handle: HandleId,
  ox: number,
  oy: number,
  ow: number,
  oh: number,
  dx: number,
  dy: number
): { x: number; y: number; width: number; height: number } {
  let x = ox;
  let y = oy;
  let w = ow;
  let h = oh;

  if (handle.includes('e')) w = ow + dx;
  if (handle.includes('s')) h = oh + dy;
  if (handle.includes('w')) {
    w = ow - dx;
    x = ox + dx;
  }
  if (handle.includes('n')) {
    h = oh - dy;
    y = oy + dy;
  }

  if (w < MIN_SIZE) {
    if (handle.includes('w')) x = ox + ow - MIN_SIZE;
    w = MIN_SIZE;
  }
  if (h < MIN_SIZE) {
    if (handle.includes('n')) y = oy + oh - MIN_SIZE;
    h = MIN_SIZE;
  }

  return { x, y, width: w, height: h };
}

type AbsNodeRect = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  visible: boolean;
  locked: boolean;
};

/** Collect node AABBs in artboard space (pivot / scale / rotation aware). */
function collectAbsoluteRects(
  node: SceneNode,
  parentMat: Mat2D,
  isRoot: boolean,
  out: AbsNodeRect[]
): void {
  const local = nodeLocalMatrix(node, isRoot);
  const world = isRoot ? parentMat : multiplyMat(parentMat, local);

  if (!isRoot) {
    const box = aabbFromMatrix(
      world,
      node.transform.width,
      node.transform.height
    );
    out.push({
      id: node.id,
      x: box.x,
      y: box.y,
      w: box.width,
      h: box.height,
      visible: node.visible,
      locked: node.locked,
    });
  }

  for (const child of node.children ?? []) {
    collectAbsoluteRects(child, world, false, out);
  }
}

function getAbsoluteNodeRect(
  root: SceneNode,
  nodeId: string
): { x: number; y: number; w: number; h: number } | null {
  const box = getNodeWorldBounds(root, nodeId);
  return box ? { x: box.x, y: box.y, w: box.width, h: box.height } : null;
}

function buildPixiText(node: TextNode): Text {
  const fontSize = node.fontSize || 28;
  const lineHeight = node.lineHeight > 0 ? node.lineHeight : Math.round(fontSize * 1.25);
  const boxW = Math.max(8, node.transform.width);
  const boxH = node.transform.height;
  const align = node.align || 'left';

  const text = new Text({
    text: node.content || '',
    style: {
      fontFamily: node.fontFamily || 'Microsoft YaHei, PingFang SC, sans-serif',
      fontSize,
      fontWeight: node.fontWeight === 'bold' ? 'bold' : 'normal',
      fontStyle: node.fontStyle === 'italic' ? 'italic' : 'normal',
      fill: parseColor(node.color || '#ffffff'),
      // Multi-line line alignment inside wrap width (Pixi ignores this for single-line).
      align,
      letterSpacing: node.letterSpacing || 0,
      lineHeight,
      wordWrap: node.wordWrap !== false,
      wordWrapWidth: boxW,
      breakWords: true,
      ...(node.strokeWidth && node.strokeWidth > 0
        ? {
            stroke: {
              color: parseColor(node.strokeColor || '#000000'),
              width: node.strokeWidth,
            },
          }
        : {}),
      ...(() => {
        const shadow = normalizeTextShadow(node.shadow);
        if (!shadow.enabled) return {};
        const dist = Math.hypot(shadow.offsetX, shadow.offsetY);
        const angle =
          dist > 0 ? Math.atan2(shadow.offsetY, shadow.offsetX) : Math.PI / 4;
        return {
          dropShadow: {
            alpha: shadow.alpha,
            color: shadow.color,
            blur: shadow.blur,
            distance: dist,
            angle,
          },
        };
      })(),
    },
  });

  // Position the text block inside the node box (Figma-like).
  // Pixi TextStyle.align alone does not move single-line text within the frame.
  const textW = text.width;
  const textH = text.height;
  if (align === 'center') {
    text.x = (boxW - textW) / 2;
  } else if (align === 'right') {
    text.x = boxW - textW;
  } else {
    text.x = 0;
  }

  if (node.verticalAlign === 'middle') {
    text.y = (boxH - textH) / 2;
  } else if (node.verticalAlign === 'bottom') {
    text.y = boxH - textH;
  } else {
    text.y = 0;
  }

  return text;
}

function parseColor(hex: string): number {
  const cleaned = hex.replace('#', '');
  if (cleaned.length === 6) return parseInt(cleaned, 16);
  if (cleaned.length === 8) return parseInt(cleaned.slice(0, 6), 16);
  return 0x888888;
}
