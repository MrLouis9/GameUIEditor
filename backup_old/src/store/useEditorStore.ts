import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { SceneNode, Asset } from '../types';

interface HistoryState {
  nodes: Record<string, SceneNode>;
  rootNodes: string[];
}

interface EditorState {
  nodes: Record<string, SceneNode>;
  rootNodes: string[]; // IDs of nodes at the root level
  selectedNodeIds: string[];
  assets: Record<string, Asset>;
  
  // History
  past: HistoryState[];
  future: HistoryState[];
  
  // Actions
  addNode: (node: Omit<SceneNode, 'id'>, parentId?: string | null) => void;
  updateNode: (id: string, updates: Partial<SceneNode>) => void;
  removeNode: (id: string) => void;
  moveNode: (id: string, targetId: string | null, position: 'before' | 'after' | 'inside') => void;
  setSelectedNodes: (ids: string[]) => void;
  addAsset: (asset: Asset) => void;
  
  undo: () => void;
  redo: () => void;
  saveHistory: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  nodes: {},
  rootNodes: [],
  selectedNodeIds: [],
  assets: {},
  past: [],
  future: [],

  saveHistory: () => {
    set((state) => ({
      past: [...state.past, { nodes: state.nodes, rootNodes: state.rootNodes }],
      future: [],
    }));
  },

  undo: () => {
    set((state) => {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      const newPast = state.past.slice(0, state.past.length - 1);
      return {
        past: newPast,
        future: [{ nodes: state.nodes, rootNodes: state.rootNodes }, ...state.future],
        nodes: previous.nodes,
        rootNodes: previous.rootNodes,
        selectedNodeIds: state.selectedNodeIds.filter(id => previous.nodes[id])
      };
    });
  },

  redo: () => {
    set((state) => {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      const newFuture = state.future.slice(1);
      return {
        past: [...state.past, { nodes: state.nodes, rootNodes: state.rootNodes }],
        future: newFuture,
        nodes: next.nodes,
        rootNodes: next.rootNodes,
      };
    });
  },

  addNode: (nodeData, parentId = null) => {
    const id = uuidv4();
    const newNode: SceneNode = { ...nodeData, id, parentId } as SceneNode;

    get().saveHistory();

    set((state) => {
      const newNodes = { ...state.nodes, [id]: newNode };
      const newRootNodes = [...state.rootNodes];

      if (parentId && state.nodes[parentId]) {
        const parent = state.nodes[parentId];
        newNodes[parentId] = {
          ...parent,
          children: [...parent.children, id],
        };
      } else {
        newRootNodes.push(id);
      }

      return {
        nodes: newNodes,
        rootNodes: newRootNodes,
      };
    });
  },

  updateNode: (id, updates) => {
    get().saveHistory();
    set((state) => {
      if (!state.nodes[id]) return state;
      return {
        nodes: {
          ...state.nodes,
          [id]: { ...state.nodes[id], ...updates } as SceneNode,
        },
      };
    });
  },

  removeNode: (id) => {
    get().saveHistory();
    set((state) => {
      const newNodes = { ...state.nodes };
      const newRootNodes = state.rootNodes.filter((nodeId) => nodeId !== id);
      
      const nodeToRemove = state.nodes[id];
      if (!nodeToRemove) return state;

      // Clean up parent's children array
      if (nodeToRemove.parentId && newNodes[nodeToRemove.parentId]) {
        newNodes[nodeToRemove.parentId] = {
          ...newNodes[nodeToRemove.parentId],
          children: newNodes[nodeToRemove.parentId].children.filter(childId => childId !== id)
        };
      }

      // Recursively remove children (simplified version)
      const removeChildren = (nodeId: string) => {
        const node = newNodes[nodeId];
        if (node && node.children) {
          node.children.forEach(removeChildren);
        }
        delete newNodes[nodeId];
      };

      removeChildren(id);

      return {
        nodes: newNodes,
        rootNodes: newRootNodes,
        selectedNodeIds: state.selectedNodeIds.filter(selId => newNodes[selId] !== undefined)
      };
    });
  },

  moveNode: (id, targetId, position) => {
    if (id === targetId) return; // Can't move to itself
    
    get().saveHistory();
    set((state) => {
      const newNodes = { ...state.nodes };
      let newRootNodes = [...state.rootNodes];
      
      const nodeToMove = newNodes[id];
      if (!nodeToMove) return state;
      
      // Prevent moving a node inside its own descendants
      const isDescendant = (potentialChildId: string, parentId: string): boolean => {
        if (potentialChildId === parentId) return true;
        const parent = newNodes[parentId];
        if (!parent || !parent.children) return false;
        return parent.children.some(childId => isDescendant(potentialChildId, childId));
      };
      
      if (targetId && isDescendant(targetId, id)) {
        return state; // Invalid move
      }

      // 1. Remove from current parent
      if (nodeToMove.parentId && newNodes[nodeToMove.parentId]) {
        newNodes[nodeToMove.parentId] = {
          ...newNodes[nodeToMove.parentId],
          children: newNodes[nodeToMove.parentId].children.filter(childId => childId !== id)
        };
      } else {
        newRootNodes = newRootNodes.filter(nodeId => nodeId !== id);
      }

      // 2. Add to new position
      if (position === 'inside' && targetId) {
        const targetNode = newNodes[targetId];
        if (targetNode) {
          newNodes[id] = { ...nodeToMove, parentId: targetId };
          newNodes[targetId] = {
            ...targetNode,
            children: [...targetNode.children, id]
          };
        }
      } else if (targetId) {
        // before or after
        const targetNode = newNodes[targetId];
        const newParentId = targetNode.parentId;
        newNodes[id] = { ...nodeToMove, parentId: newParentId };
        
        if (newParentId && newNodes[newParentId]) {
          const parent = newNodes[newParentId];
          const targetIndex = parent.children.indexOf(targetId);
          const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
          const newChildren = [...parent.children];
          newChildren.splice(insertIndex, 0, id);
          
          newNodes[newParentId] = { ...parent, children: newChildren };
        } else {
          // root level
          const targetIndex = newRootNodes.indexOf(targetId);
          const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
          newRootNodes.splice(insertIndex, 0, id);
        }
      }

      return {
        nodes: newNodes,
        rootNodes: newRootNodes
      };
    });
  },

  setSelectedNodes: (ids) => {
    set({ selectedNodeIds: ids });
  },

  addAsset: (asset) => {
    set((state) => ({
      assets: { ...state.assets, [asset.id]: asset }
    }));
  }
}));
