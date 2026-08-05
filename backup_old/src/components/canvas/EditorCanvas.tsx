import React, { useRef, useEffect, useState } from 'react';
import { Application, extend } from '@pixi/react';
import { Container, Sprite, NineSliceSprite, Texture } from 'pixi.js';
import { useEditorStore } from '../../store/useEditorStore';

extend({ Container, Sprite, NineSliceSprite });

// Render a single node and its children recursively
const RenderNode: React.FC<{ nodeId: string }> = ({ nodeId }) => {
  const { nodes, selectedNodeIds, setSelectedNodes, updateNode } = useEditorStore();
  const node = nodes[nodeId];
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0, nodeX: 0, nodeY: 0 });

  if (!node) return null;

  const isSelected = selectedNodeIds.includes(nodeId);

  const getTexture = () => {
    if ((node as any).textureId) {
      const asset = useEditorStore.getState().assets[(node as any).textureId];
      if (asset && asset.url) {
        return Texture.from(asset.url);
      }
    }
    return Texture.WHITE;
  };

  const handlePointerDown = (e: any) => {
    if (e.button === 1 || e.button === 2 || e.altKey) return; // Ignore pan triggers
    e.stopPropagation();
    setSelectedNodes([nodeId]);
    
    // Start drag
    setIsDragging(true);
    const parentPos = e.data.getLocalPosition(e.currentTarget.parent);
    dragStartPos.current = { 
      x: parentPos.x, 
      y: parentPos.y, 
      nodeX: node.x, 
      nodeY: node.y 
    };
  };

  const handlePointerMove = (e: any) => {
    if (isDragging && !isResizing && isSelected) {
      const parentPos = e.data.getLocalPosition(e.currentTarget.parent);
      const dx = parentPos.x - dragStartPos.current.x;
      const dy = parentPos.y - dragStartPos.current.y;
      
      updateNode(nodeId, {
        x: dragStartPos.current.nodeX + dx,
        y: dragStartPos.current.nodeY + dy,
      });
    }
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    setIsResizing(false);
  };

  const handleResizeStart = (e: any) => {
    e.stopPropagation();
    setIsResizing(true);
    const parentPos = e.data.getLocalPosition(e.currentTarget.parent.parent); // parent is the outline container, its parent is the node's parent
    dragStartPos.current = {
      x: parentPos.x,
      y: parentPos.y,
      nodeX: node.width,
      nodeY: node.height
    };
  };

  const handleResizeMove = (e: any) => {
    if (isResizing && isSelected) {
      e.stopPropagation();
      const parentPos = e.data.getLocalPosition(e.currentTarget.parent.parent);
      const dx = parentPos.x - dragStartPos.current.x;
      const dy = parentPos.y - dragStartPos.current.y;
      
      updateNode(nodeId, {
        width: Math.max(10, dragStartPos.current.nodeX + dx),
        height: Math.max(10, dragStartPos.current.nodeY + dy),
      });
    }
  };

  const commonProps = {
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    rotation: node.rotation,
    scale: { x: node.scaleX, y: node.scaleY },
    alpha: node.alpha,
    visible: node.visible,
    eventMode: "static",
    pointerdown: handlePointerDown,
    pointerup: handlePointerUp,
    pointerupoutside: handlePointerUp,
    pointermove: handlePointerMove,
  };

  const renderChildren = () => {
    return node.children.map(childId => (
      <RenderNode key={childId} nodeId={childId} />
    ));
  };

  const renderSelectionOutline = () => {
    if (!isSelected) return null;
    return (
      <pixiContainer>
        <pixiSprite 
          texture={Texture.WHITE} 
          width={node.width} 
          height={node.height} 
          alpha={0.2} 
          tint={0x0066ff} 
        />
        {/* Resize Handle (Bottom-Right) */}
        <pixiSprite
          texture={Texture.WHITE}
          x={node.width - 5}
          y={node.height - 5}
          width={10}
          height={10}
          tint={0xffffff}
          eventMode="static"
          cursor="nwse-resize"
          pointerdown={handleResizeStart}
          pointermove={handleResizeMove}
          pointerup={handlePointerUp}
          pointerupoutside={handlePointerUp}
        />
      </pixiContainer>
    );
  };

  if (node.type === 'sprite') {
    return (
      <pixiSprite {...commonProps as any} texture={getTexture()} tint={(node as any).tint || 0xcccccc}>
        {renderChildren()}
        {renderSelectionOutline()}
      </pixiSprite>
    );
  }

  if (node.type === 'nineslice') {
    const ns = node as any;
    return (
      <pixiNineSliceSprite
        {...commonProps as any}
        texture={getTexture()}
        leftWidth={ns.leftWidth}
        rightWidth={ns.rightWidth}
        topHeight={ns.topHeight}
        bottomHeight={ns.bottomHeight}
        tint={ns.tint || 0xdddddd}
      >
        {renderChildren()}
        {renderSelectionOutline()}
      </pixiNineSliceSprite>
    );
  }

  return (
    <pixiContainer {...commonProps as any}>
      {renderChildren()}
      {renderSelectionOutline()}
    </pixiContainer>
  );
};

const EditorCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [camera, setCamera] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const lastPanRef = useRef({ x: 0, y: 0 });
  
  const { rootNodes, setSelectedNodes, selectedNodeIds } = useEditorStore();

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
        setCamera(prev => ({
          ...prev,
          x: containerRef.current!.clientWidth / 2,
          y: containerRef.current!.clientHeight / 2,
        }));
      }
    };
    
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button === 1 || e.button === 2 || e.altKey) { // Middle click, right click, or Alt+click for panning
      setIsPanning(true);
      lastPanRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isPanning) {
      const dx = e.clientX - lastPanRef.current.x;
      const dy = e.clientY - lastPanRef.current.y;
      setCamera(prev => ({
        ...prev,
        x: prev.x + dx,
        y: prev.y + dy,
      }));
      lastPanRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handlePointerUp = () => {
    setIsPanning(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomSensitivity = 0.001;
    const delta = -e.deltaY * zoomSensitivity;
    
    setCamera(prev => {
      const newScale = Math.max(0.1, Math.min(prev.scale * (1 + delta), 10));
      // Keep the mouse point fixed during zoom
      const rect = containerRef.current!.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const worldX = (mouseX - prev.x) / prev.scale;
      const worldY = (mouseY - prev.y) / prev.scale;
      
      return {
        ...prev,
        scale: newScale,
        x: mouseX - worldX * newScale,
        y: mouseY - worldY * newScale
      };
    });
  };

  // Prevent default context menu
  const handleContextMenu = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full relative cursor-crosshair" 
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onWheel={handleWheel}
      onContextMenu={handleContextMenu}
    >
      {dimensions.width > 0 && dimensions.height > 0 && (
        <Application 
          width={dimensions.width} 
          height={dimensions.height} 
          backgroundColor={0x1a1a1a}
          resolution={window.devicePixelRatio || 1}
          autoDensity={true}
        >
          <pixiSprite 
            texture={Texture.WHITE}
            width={dimensions.width}
            height={dimensions.height}
            alpha={0}
            eventMode="static"
            pointerdown={() => setSelectedNodes([])}
          />
          <pixiContainer x={camera.x} y={camera.y} scale={camera.scale}>
             {/* The origin of the world is 0,0 */}
             <pixiContainer>
               {rootNodes.map(id => (
                 <RenderNode key={id} nodeId={id} />
               ))}
             </pixiContainer>
          </pixiContainer>
        </Application>
      )}
    </div>
  );
};

export default EditorCanvas;
