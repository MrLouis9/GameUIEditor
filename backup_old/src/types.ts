export type NodeType = 'container' | 'sprite' | 'nineslice';

export interface BaseNode {
  id: string;
  type: NodeType;
  name: string;
  parentId: string | null; // null means it's attached to root
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // in radians or degrees (PixiJS uses radians, we can store in radians)
  scaleX: number;
  scaleY: number;
  alpha: number;
  visible: boolean;
  locked: boolean;
  children: string[]; // IDs of child nodes
}

export interface SpriteNode extends BaseNode {
  type: 'sprite';
  textureId: string | null;
  tint: number; // hex color e.g., 0xffffff
}

export interface NineSliceNode extends BaseNode {
  type: 'nineslice';
  textureId: string | null;
  tint: number;
  leftWidth: number;
  rightWidth: number;
  topHeight: number;
  bottomHeight: number;
}

export type SceneNode = BaseNode | SpriteNode | NineSliceNode;

export interface Asset {
  id: string;
  name: string;
  url: string;
  width: number;
  height: number;
}
