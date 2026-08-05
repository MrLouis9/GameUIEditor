import React from 'react';
import { useEditorStore } from '../../store/useEditorStore';

const RightSidebar: React.FC = () => {
  const { selectedNodeIds, nodes, updateNode } = useEditorStore();

  const selectedNodeId = selectedNodeIds[0];
  const selectedNode = selectedNodeId ? nodes[selectedNodeId] : null;

  if (!selectedNode) {
    return (
      <aside className="w-72 border-l border-gray-800 bg-gray-900 shrink-0 flex items-center justify-center">
        <span className="text-xs text-gray-600">No selection</span>
      </aside>
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let parsedValue: any = value;
    
    // Convert numeric fields
    if (['x', 'y', 'width', 'height', 'rotation', 'scaleX', 'scaleY', 'alpha'].includes(name)) {
      parsedValue = parseFloat(value);
      if (isNaN(parsedValue)) return;
    }

    updateNode(selectedNodeId, { [name]: parsedValue });
  };

  return (
    <aside className="w-72 border-l border-gray-800 bg-gray-900 flex flex-col shrink-0">
      <div className="h-10 border-b border-gray-800 flex items-center px-4 font-medium text-xs text-gray-400">
        Properties
      </div>
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-sm">
        {/* Name */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Name</label>
          <input 
            type="text" 
            name="name" 
            value={selectedNode.name} 
            onChange={handleChange}
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 focus:border-blue-500 outline-none"
          />
        </div>

        {/* Transform */}
        <div>
          <div className="flex justify-between items-center mb-2 pb-1 border-b border-gray-800">
            <span className="text-xs text-gray-400 font-medium">Transform & Type</span>
            <select 
              className="bg-gray-800 text-xs text-gray-300 border border-gray-700 rounded px-1 outline-none"
              value={selectedNode.type}
              onChange={(e) => {
                const newType = e.target.value as any;
                const updates: any = { type: newType };
                if (newType === 'nineslice' && selectedNode.type !== 'nineslice') {
                  updates.leftWidth = 10;
                  updates.rightWidth = 10;
                  updates.topHeight = 10;
                  updates.bottomHeight = 10;
                }
                updateNode(selectedNodeId, updates);
              }}
            >
              <option value="container">Container</option>
              <option value="sprite">Sprite</option>
              <option value="nineslice">9-Slice</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-gray-500">X</label>
              <input type="number" name="x" value={selectedNode.x} onChange={handleChange} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 outline-none text-xs" />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500">Y</label>
              <input type="number" name="y" value={selectedNode.y} onChange={handleChange} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 outline-none text-xs" />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500">Width</label>
              <input type="number" name="width" value={selectedNode.width} onChange={handleChange} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 outline-none text-xs" />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500">Height</label>
              <input type="number" name="height" value={selectedNode.height} onChange={handleChange} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 outline-none text-xs" />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500">Rotation (rad)</label>
              <input type="number" name="rotation" step="0.1" value={selectedNode.rotation} onChange={handleChange} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 outline-none text-xs" />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500">Opacity (0-1)</label>
              <input type="number" name="alpha" step="0.1" min="0" max="1" value={selectedNode.alpha} onChange={handleChange} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 outline-none text-xs" />
            </div>
          </div>
        </div>

        {/* NineSlice params if applicable */}
        {selectedNode.type === 'nineslice' && (
           <div>
            <div className="text-xs text-gray-400 font-medium mb-2 pb-1 border-b border-gray-800">9-Slice</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-gray-500">Top</label>
                <input type="number" name="topHeight" value={(selectedNode as any).topHeight} onChange={handleChange} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 outline-none text-xs" />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500">Right</label>
                <input type="number" name="rightWidth" value={(selectedNode as any).rightWidth} onChange={handleChange} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 outline-none text-xs" />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500">Bottom</label>
                <input type="number" name="bottomHeight" value={(selectedNode as any).bottomHeight} onChange={handleChange} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 outline-none text-xs" />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500">Left</label>
                <input type="number" name="leftWidth" value={(selectedNode as any).leftWidth} onChange={handleChange} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 outline-none text-xs" />
              </div>
            </div>
           </div>
        )}

      </div>
    </aside>
  );
};

export default RightSidebar;
