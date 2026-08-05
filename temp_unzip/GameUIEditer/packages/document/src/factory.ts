import type {
  Asset,
  Document,
  FrameNode,
  GroupNode,
  NodeBase,
  RectNode,
  SceneNode,
  SpriteNode,
  TextNode,
  Transform,
} from './types';
import { DEFAULT_CONSTRAINTS, DEFAULT_LAYOUT, DEFAULT_PIVOT } from './types';
import { DEFAULT_DESIGN } from './design';
import { createAtlas } from './atlases';

export function createId(prefix = 'n'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function defaultTransform(
  partial: Partial<Transform> & Pick<Transform, 'width' | 'height'>
): Transform {
  return {
    x: partial.x ?? 0,
    y: partial.y ?? 0,
    width: partial.width,
    height: partial.height,
    rotation: partial.rotation ?? 0,
    opacity: partial.opacity ?? 1,
  };
}

function baseFields(
  partial?: Partial<
    Pick<
      NodeBase,
      | 'visible'
      | 'locked'
      | 'fill'
      | 'fillOpacity'
      | 'cornerRadius'
      | 'strokeColor'
      | 'strokeWidth'
      | 'strokeOpacity'
      | 'clipContent'
      | 'layout'
      | 'scaleX'
      | 'scaleY'
      | 'pivot'
      | 'constraints'
      | 'role'
      | 'componentKey'
      | 'states'
      | 'activeState'
      | 'binding'
      | 'locKey'
      | 'notes'
    >
  >
): Pick<
  NodeBase,
  | 'visible'
  | 'locked'
  | 'scaleX'
  | 'scaleY'
  | 'pivot'
  | 'fillOpacity'
  | 'cornerRadius'
  | 'strokeWidth'
  | 'strokeOpacity'
  | 'clipContent'
  | 'layout'
  | 'role'
  | 'states'
  | 'activeState'
  | 'constraints'
> & {
  fill?: string;
  strokeColor?: string;
  componentKey?: string;
  binding?: NodeBase['binding'];
  locKey?: string;
  notes?: string;
} {
  return {
    visible: partial?.visible ?? true,
    locked: partial?.locked ?? false,
    scaleX: partial?.scaleX ?? 1,
    scaleY: partial?.scaleY ?? 1,
    pivot: partial?.pivot
      ? { ...DEFAULT_PIVOT, ...partial.pivot }
      : { ...DEFAULT_PIVOT },
    fill: partial?.fill,
    fillOpacity: partial?.fillOpacity ?? 1,
    cornerRadius: partial?.cornerRadius ?? 0,
    strokeColor: partial?.strokeColor,
    strokeWidth: partial?.strokeWidth ?? 0,
    strokeOpacity: partial?.strokeOpacity ?? 1,
    clipContent: partial?.clipContent ?? false,
    layout: partial?.layout ? { ...DEFAULT_LAYOUT, ...partial.layout } : { ...DEFAULT_LAYOUT },
    constraints: partial?.constraints
      ? { ...DEFAULT_CONSTRAINTS, ...partial.constraints }
      : { ...DEFAULT_CONSTRAINTS },
    role: partial?.role ?? 'none',
    componentKey: partial?.componentKey,
    states: partial?.states?.length ? [...partial.states] : ['normal'],
    activeState: partial?.activeState ?? 'normal',
    binding: partial?.binding ? { ...partial.binding } : undefined,
    locKey: partial?.locKey,
    notes: partial?.notes,
  };
}

export function createFrame(partial?: Partial<FrameNode> & { name?: string }): FrameNode {
  const w = partial?.transform?.width ?? DEFAULT_DESIGN.width;
  const h = partial?.transform?.height ?? DEFAULT_DESIGN.height;
  return {
    id: partial?.id ?? createId('frame'),
    name: partial?.name ?? 'Frame',
    type: 'frame',
    ...baseFields({ ...partial, fill: partial?.fill ?? '#1a1d27' }),
    fill: partial?.fill ?? '#1a1d27',
    transform: defaultTransform({
      ...partial?.transform,
      width: w,
      height: h,
    }),
    children: partial?.children ?? [],
  };
}

export function createGroup(name = 'Group', children: SceneNode[] = []): GroupNode {
  return {
    id: createId('group'),
    name,
    type: 'group',
    ...baseFields(),
    transform: defaultTransform({ width: 100, height: 100 }),
    children,
  };
}

export function createRect(
  name = 'Rectangle',
  transform?: Partial<Transform>,
  fill = '#4f6ef7'
): RectNode {
  const size = 100;
  return {
    id: createId('rect'),
    name,
    type: 'rect',
    ...baseFields({ fill }),
    fill,
    transform: defaultTransform({
      width: transform?.width ?? size,
      height: transform?.height ?? size,
      x: transform?.x ?? 40,
      y: transform?.y ?? 40,
      rotation: transform?.rotation,
      opacity: transform?.opacity,
    }),
  };
}

export function createText(
  name = '文本',
  transform?: Partial<Transform>,
  partial?: Partial<
    Omit<TextNode, 'id' | 'name' | 'type' | 'transform' | 'visible' | 'locked'>
  >
): TextNode {
  return {
    id: createId('text'),
    name,
    type: 'text',
    ...baseFields(),
    content: partial?.content ?? '文本',
    fontSize: partial?.fontSize ?? 28,
    fontFamily: partial?.fontFamily ?? 'Microsoft YaHei, PingFang SC, sans-serif',
    fontWeight: partial?.fontWeight ?? 'normal',
    fontStyle: partial?.fontStyle ?? 'normal',
    color: partial?.color ?? '#ffffff',
    align: partial?.align ?? 'left',
    verticalAlign: partial?.verticalAlign ?? 'top',
    lineHeight: partial?.lineHeight ?? 0,
    letterSpacing: partial?.letterSpacing ?? 0,
    wordWrap: partial?.wordWrap ?? true,
    transform: defaultTransform({
      width: transform?.width ?? 200,
      height: transform?.height ?? 40,
      x: transform?.x ?? 40,
      y: transform?.y ?? 40,
      rotation: transform?.rotation,
      opacity: transform?.opacity,
    }),
  };
}

export function createSprite(
  asset: Asset,
  transform?: Partial<Transform>
): SpriteNode {
  return {
    id: createId('sprite'),
    name: asset.name,
    type: 'sprite',
    ...baseFields(),
    assetId: asset.id,
    nineSlice: asset.nineSlice ? { ...asset.nineSlice } : undefined,
    transform: defaultTransform({
      width: transform?.width ?? asset.width,
      height: transform?.height ?? asset.height,
      x: transform?.x ?? 40,
      y: transform?.y ?? 40,
      rotation: transform?.rotation,
      opacity: transform?.opacity,
    }),
  };
}

export function createDocument(name = '未命名界面'): Document {
  const root = createFrame({
    name: 'Page 1',
    transform: {
      x: 0,
      y: 0,
      width: DEFAULT_DESIGN.width,
      height: DEFAULT_DESIGN.height,
      rotation: 0,
      opacity: 1,
    },
  });
  const pageId = createId('page');
  const atlas = createAtlas('默认图集');
  return {
    id: createId('doc'),
    name,
    designSize: { ...DEFAULT_DESIGN },
    orientation: 'landscape',
    aspectMode: 'fixed',
    atlases: [atlas],
    activeAtlasId: atlas.id,
    assets: [],
    pages: [{ id: pageId, name: 'Page 1', root }],
    activePageId: pageId,
    interactions: [],
  };
}
