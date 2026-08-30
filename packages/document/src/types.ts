export const SCHEMA_VERSION = 7 as const;

export type NodeType = 'frame' | 'group' | 'sprite' | 'rect' | 'text';
export type Orientation = 'landscape' | 'portrait';
export type AspectMode = 'fixed' | 'adaptive';

export type LayoutMode = 'none' | 'horizontal' | 'vertical' | 'grid';
export type LayoutAlign = 'start' | 'center' | 'end' | 'space-between';

/** Semantic role for AI / runtime (not visual type). */
export type NodeRole =
  | 'none'
  | 'button'
  | 'input'
  | 'toggle'
  | 'list'
  | 'listItem'
  | 'scroll'
  | 'label'
  | 'image'
  | 'panel'
  | 'icon'
  | 'progress'
  | 'dynamicValue'
  | 'tab'
  | 'other';

export type NodeUiState =
  | 'normal'
  | 'pressed'
  | 'disabled'
  | 'selected'
  | 'hover';

/** Data / event binding hint for MVVM or codegen. */
export interface NodeBinding {
  dataPath?: string;
  event?: string;
}

/** Page interaction / API notes keyed by componentKey or node id. */
export interface InteractionSpec {
  /** Prefer componentKey; falls back to node id */
  target: string;
  onClick?: string;
  navigate?: string;
  api?: string;
  animation?: string;
  notes?: string;
}

export const NODE_ROLES: NodeRole[] = [
  'none',
  'button',
  'input',
  'toggle',
  'list',
  'listItem',
  'scroll',
  'label',
  'image',
  'panel',
  'icon',
  'progress',
  'dynamicValue',
  'tab',
  'other',
];

export const NODE_UI_STATES: NodeUiState[] = [
  'normal',
  'pressed',
  'disabled',
  'selected',
  'hover',
];

export interface NineSlice {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Transform {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
}

/**
 * Normalized pivot (0–1) for rotation & scale, relative to width/height.
 * Default center (0.5, 0.5). Contract for AI / runtime:
 * - transform.x/y = top-left of the unscaled local box in parent space
 * - rotation (deg) & scaleX/Y apply around pivot
 */
export interface Pivot {
  x: number;
  y: number;
}

export const DEFAULT_PIVOT: Pivot = { x: 0.5, y: 0.5 };

/** Auto-layout similar to Figma Auto Layout / CSS flex+grid. */
export interface AutoLayout {
  mode: LayoutMode;
  /** Gap between children */
  gap: number;
  /** Inner padding */
  padding: number;
  /** Grid columns (grid mode) */
  columns: number;
  /** Grid rows; 0 = auto */
  rows: number;
  /** Main-axis alignment */
  primaryAlign: LayoutAlign;
  /** Cross-axis alignment */
  counterAlign: 'start' | 'center' | 'end';
}

export const DEFAULT_LAYOUT: AutoLayout = {
  mode: 'none',
  gap: 8,
  padding: 0,
  columns: 2,
  rows: 0,
  primaryAlign: 'start',
  counterAlign: 'start',
};

/**
 * Parent-relative constraints (Figma-style).
 * Stored for runtime / AI; editor reapplies when parent size changes.
 */
export type HorizontalConstraint =
  | 'left'
  | 'right'
  | 'center'
  | 'left-right'
  | 'scale';

export type VerticalConstraint =
  | 'top'
  | 'bottom'
  | 'center'
  | 'top-bottom'
  | 'scale';

export interface Constraints {
  horizontal: HorizontalConstraint;
  vertical: VerticalConstraint;
}

export const DEFAULT_CONSTRAINTS: Constraints = {
  horizontal: 'left',
  vertical: 'top',
};

export const HORIZONTAL_CONSTRAINTS: HorizontalConstraint[] = [
  'left',
  'right',
  'center',
  'left-right',
  'scale',
];

export const VERTICAL_CONSTRAINTS: VerticalConstraint[] = [
  'top',
  'bottom',
  'center',
  'top-bottom',
  'scale',
];

/** Named sprite sheet group (icons / activity / HUD …). */
export interface Atlas {
  id: string;
  name: string;
}

export interface Asset {
  id: string;
  name: string;
  atlasId: string;
  width: number;
  height: number;
  dataUrl: string;
  nineSlice?: NineSlice;
  /** Relative file path when exported in AI handoff package */
  file?: string;
}

export interface NodeBase {
  id: string;
  name: string;
  type: NodeType;
  visible: boolean;
  locked: boolean;
  transform: Transform;
  /**
   * Pivot for rotation/scale (0–1). Default `{ x: 0.5, y: 0.5 }` (center).
   * See docs/document-schema.md.
   */
  pivot: Pivot;
  /** Scale applied around pivot (on top of width/height) */
  scaleX: number;
  scaleY: number;
  /** Background / solid fill (hex). Frames, rects, groups. */
  fill?: string;
  /** Fill alpha 0–1 (independent of node opacity) */
  fillOpacity: number;
  /**
   * Optional background / icon sprite (frame / rect / group).
   * Renders stretched (or nine-slice from asset) behind children.
   * Runtime: resolve like sprite `assetId` → atlas frame.
   */
  iconAssetId?: string;
  /** Corner radius in px (rects / frames) */
  cornerRadius: number;
  /** Stroke color (hex). Empty / undefined = no stroke when width is 0 */
  strokeColor?: string;
  /** Stroke width in px */
  strokeWidth: number;
  /** Stroke alpha 0–1 */
  strokeOpacity: number;
  /** Clip children to bounds (ScrollView / mask) */
  clipContent: boolean;
  /** Auto layout for children */
  layout: AutoLayout;
  /** How this node follows parent size changes (Figma constraints) */
  constraints: Constraints;
  /** Semantic role for codegen / AI handoff */
  role: NodeRole;
  /**
   * Stable business key for binding (e.g. btn_login).
   * Prefer this over display `name` when wiring logic.
   */
  componentKey?: string;
  /** UI states this node participates in */
  states: NodeUiState[];
  /** Current / default state */
  activeState: NodeUiState;
  /** Optional MVVM / event binding hints */
  binding?: NodeBinding;
  /** Localization key (text nodes); content is placeholder */
  locKey?: string;
  /** Free-form notes for implementers */
  notes?: string;
  children?: SceneNode[];
}

export interface FrameNode extends NodeBase {
  type: 'frame';
  children: SceneNode[];
}

export interface GroupNode extends NodeBase {
  type: 'group';
  children: SceneNode[];
}

export interface SpriteNode extends NodeBase {
  type: 'sprite';
  /** Default / fallback asset (also used as `stateAssets.normal` if unset). */
  assetId: string;
  /**
   * Per-state art for toggle / tab (AI + runtime).
   * Keys are `NodeUiState`; values are asset ids.
   * - toggle: `normal` = off art, `selected` = on art
   * - tab: `normal` = unselected, `selected` = selected
   */
  stateAssets?: StateAssets;
  nineSlice?: NineSlice;
  tint?: string;
}

export interface RectNode extends NodeBase {
  type: 'rect';
  fill: string;
}

/** Drop shadow for text (Pixi dropShadow / CSS text-shadow analog). */
export interface TextShadow {
  enabled: boolean;
  color: string;
  /** 0–1 */
  alpha: number;
  blur: number;
  offsetX: number;
  offsetY: number;
}

export const DEFAULT_TEXT_SHADOW: TextShadow = {
  enabled: false,
  color: '#000000',
  alpha: 0.55,
  blur: 4,
  offsetX: 2,
  offsetY: 2,
};

export interface TextNode extends NodeBase {
  type: 'text';
  content: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  color: string;
  align: 'left' | 'center' | 'right';
  verticalAlign: 'top' | 'middle' | 'bottom';
  lineHeight: number;
  letterSpacing: number;
  wordWrap: boolean;
  /** Optional drop shadow */
  shadow?: TextShadow;
}

/**
 * Maps UI state → assetId for sprites that swap art (toggle / tab).
 * Export contract for AI / runtime.
 */
export type StateAssets = Partial<Record<NodeUiState, string>>;

export type SceneNode = FrameNode | GroupNode | SpriteNode | RectNode | TextNode;

export interface Page {
  id: string;
  name: string;
  root: FrameNode;
}

export interface Document {
  id: string;
  name: string;
  designSize: { width: number; height: number };
  orientation: Orientation;
  aspectMode: AspectMode;
  atlases: Atlas[];
  activeAtlasId: string;
  assets: Asset[];
  pages: Page[];
  activePageId: string;
  /** Interaction / navigation / API specs for AI handoff */
  interactions: InteractionSpec[];
}

export interface DocumentFile {
  schemaVersion: number;
  document: Document;
}

export interface DesignPreset {
  id: string;
  label: string;
  width: number;
  height: number;
  orientation: Orientation;
}

export const ASSET_DRAG_MIME = 'application/x-gameui-asset';
export const ASSET_DRAG_PREFIX = 'gameui-asset:';
export const LAYER_DRAG_MIME = 'application/x-gameui-layer';
export const LAYER_DRAG_PREFIX = 'gameui-layer:';

export function encodeAssetDragPayload(assetId: string): string {
  return `${ASSET_DRAG_PREFIX}${assetId}`;
}

export function decodeAssetDragPayload(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const text = raw.trim();
  if (text.startsWith(ASSET_DRAG_PREFIX)) {
    return text.slice(ASSET_DRAG_PREFIX.length) || null;
  }
  if (text.startsWith('asset_')) return text;
  return null;
}

/** Encode one or more layer ids for hierarchy drag-drop. */
export function encodeLayerDragPayload(nodeIds: string | string[]): string {
  const ids = Array.isArray(nodeIds) ? nodeIds : [nodeIds];
  return `${LAYER_DRAG_PREFIX}${JSON.stringify(ids)}`;
}

/**
 * Decode layer drag payload.
 * Supports JSON array (`gameui-layer:["a","b"]`) and legacy single id (`gameui-layer:a`).
 */
export function decodeLayerDragPayload(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const text = raw.trim();
  if (!text.startsWith(LAYER_DRAG_PREFIX)) return [];
  const body = text.slice(LAYER_DRAG_PREFIX.length);
  if (!body) return [];
  if (body.startsWith('[')) {
    try {
      const parsed = JSON.parse(body) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((x): x is string => typeof x === 'string' && !!x);
      }
    } catch {
      return [];
    }
  }
  return [body];
}

export function canHaveChildren(node: SceneNode): boolean {
  return node.type === 'frame' || node.type === 'group' || !!node.children;
}

export function ensureChildren(node: SceneNode): SceneNode[] {
  if (!node.children) {
    (node as SceneNode & { children: SceneNode[] }).children = [];
  }
  return node.children!;
}
