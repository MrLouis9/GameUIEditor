import React, { useState, useRef } from 'react';
import { useEditorStore } from '../../store/useEditorStore';
import { v4 as uuidv4 } from 'uuid';

const LeftSidebar: React.FC = () => {
  const { rootNodes, nodes, selectedNodeIds, setSelectedNodes, assets, addAsset } = useEditorStore();
  const [activeTab, setActiveTab] = useState<'layers' | 'assets'>('layers');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSelect = (id: string) => {
    setSelectedNodes([id]);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        addAsset({
          id: uuidv4(),
          name: file.name,
          url,
          width: img.width,
          height: img.height,
        });
      };
      img.src = url;
    });
    
    // reset
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddNodeFromAsset = (assetId: string) => {
    const asset = assets[assetId];
    if (!asset) return;

    useEditorStore.getState().addNode({
      type: 'sprite',
      name: asset.name,
      x: 100 + Math.random() * 50,
      y: 100 + Math.random() * 50,
      width: asset.width,
      height: asset.height,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      alpha: 1,
      visible: true,
      locked: false,
      children: [],
      textureId: assetId,
      tint: 0xffffff
    } as any);
  };

  const renderNodeTree = (nodeId: string, depth = 0) => {
    const node = nodes[nodeId];
    if (!node) return null;

    const isSelected = selectedNodeIds.includes(nodeId);

    const handleDragStart = (e: React.DragEvent) => {
      e.dataTransfer.setData('nodeId', nodeId);
      e.stopPropagation();
    };

    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.classList.add('bg-gray-700');
    };

    const handleDragLeave = (e: React.DragEvent) => {
      e.currentTarget.classList.remove('bg-gray-700');
    };

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.classList.remove('bg-gray-700');
      
      const draggedId = e.dataTransfer.getData('nodeId');
      if (!draggedId || draggedId === nodeId) return;

      // Determine drop position based on mouse position relative to element
      const rect = e.currentTarget.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const height = rect.height;
      
      let position: 'before' | 'after' | 'inside' = 'inside';
      
      if (y < height * 0.25) {
        position = 'before';
      } else if (y > height * 0.75) {
        position = 'after';
      }

      useEditorStore.getState().moveNode(draggedId, nodeId, position);
    };

    return (
      <div key={nodeId} className="flex flex-col">
        <div 
          className={`flex items-center px-2 py-1 text-xs cursor-pointer select-none group border-y border-transparent
            ${isSelected ? 'bg-blue-600 text-white' : 'hover:bg-gray-800 text-gray-300'}`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => handleSelect(nodeId)}
          draggable
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <span className="mr-2 text-gray-500">{node.type === 'container' ? '📦' : '🖼️'}</span>
          <span className="truncate flex-1">{node.name}</span>
          <button 
            className="hidden group-hover:block px-1 text-gray-400 hover:text-white"
            onClick={(e) => { e.stopPropagation(); useEditorStore.getState().removeNode(nodeId); }}
            title="Delete"
          >
            ✕
          </button>
        </div>
        {node.children.map(childId => renderNodeTree(childId, depth + 1))}
      </div>
    );
  };

  return (
    <aside className="w-64 border-r border-gray-800 bg-gray-900 flex flex-col shrink-0">
      <div className="flex border-b border-gray-800">
        <button 
          className={`flex-1 h-10 text-xs font-medium ${activeTab === 'layers' ? 'text-blue-400 border-b-2 border-blue-500 bg-gray-800' : 'text-gray-400 hover:bg-gray-800'}`}
          onClick={() => setActiveTab('layers')}
        >
          Layers
        </button>
        <button 
          className={`flex-1 h-10 text-xs font-medium ${activeTab === 'assets' ? 'text-blue-400 border-b-2 border-blue-500 bg-gray-800' : 'text-gray-400 hover:bg-gray-800'}`}
          onClick={() => setActiveTab('assets')}
        >
          Assets
        </button>
      </div>
      
      {activeTab === 'layers' && (
        <>
          <div className="p-2 border-b border-gray-800">
            <button 
              className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded py-1 text-xs"
              onClick={() => {
                useEditorStore.getState().addNode({
                  type: 'sprite',
                  name: 'New Sprite',
                  x: 100 + Math.random() * 200,
                  y: 100 + Math.random() * 200,
                  width: 100,
                  height: 100,
                  rotation: 0,
                  scaleX: 1,
                  scaleY: 1,
                  alpha: 1,
                  visible: true,
                  locked: false,
                  children: [],
                  textureId: null,
                  tint: 0xffffff
                } as any);
              }}
            >
              + Add Empty Sprite
            </button>
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            {rootNodes.map(id => renderNodeTree(id))}
            {rootNodes.length === 0 && (
              <div className="px-4 py-8 text-center text-xs text-gray-600">
                No layers yet
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'assets' && (
        <>
          <div className="p-2 border-b border-gray-800">
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              multiple 
              onChange={handleFileUpload}
            />
            <button 
              className="w-full bg-gray-800 border border-gray-700 hover:bg-gray-700 text-white rounded py-1 text-xs"
              onClick={() => fileInputRef.current?.click()}
            >
              + Upload Images
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 grid grid-cols-2 gap-2 content-start">
            {Object.values(assets).map(asset => (
              <div 
                key={asset.id} 
                className="bg-gray-950 border border-gray-800 rounded p-2 flex flex-col items-center cursor-pointer hover:border-blue-500 group"
                onClick={() => handleAddNodeFromAsset(asset.id)}
                title="Click to add to canvas"
              >
                <div className="h-16 w-full flex items-center justify-center mb-1">
                  <img src={asset.url} alt={asset.name} className="max-h-full max-w-full object-contain" />
                </div>
                <div className="text-[10px] text-gray-400 truncate w-full text-center">
                  {asset.name}
                </div>
              </div>
            ))}
            {Object.values(assets).length === 0 && (
              <div className="col-span-2 py-8 text-center text-xs text-gray-600">
                No assets uploaded
              </div>
            )}
          </div>
        </>
      )}
    </aside>
  );
};

export default LeftSidebar;
