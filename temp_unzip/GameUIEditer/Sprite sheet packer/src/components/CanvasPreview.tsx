/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { PackedSheet, PackResult, PackSettings } from '../types';
import {
  ZoomIn,
  ZoomOut,
  Maximize,
  Move,
  AlertTriangle,
  Grid,
  Sparkles,
  MousePointer,
  HelpCircle,
  TrendingUp
} from 'lucide-react';
import { drawPackedSheet } from '../utils/image';

interface CanvasPreviewProps {
  sheet: PackedSheet;
  settings: PackSettings;
  selectedSpriteId: string | null;
  onSelectSprite: (spriteId: string | null) => void;
}

export const CanvasPreview: React.FC<CanvasPreviewProps> = ({
  sheet,
  settings,
  selectedSpriteId,
  onSelectSprite,
}) => {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<PackResult | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Re-draw canvas whenever sheet or settings change
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    
    if (sheet.width === 0 || sheet.height === 0) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    // Render packed sheet to canvas
    const renderedCanvas = drawPackedSheet(sheet, settings.backgroundColor, 1);
    
    // Copy rendered output to preview canvas
    canvas.width = renderedCanvas.width;
    canvas.height = renderedCanvas.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(renderedCanvas, 0, 0);
    }
  }, [sheet, settings.backgroundColor]);

  // Handle Zoom fitting
  const fitToScreen = () => {
    if (!containerRef.current || !canvasRef.current || sheet.width === 0) return;
    const container = containerRef.current;
    
    // Subtract some padding/borders from container size
    const availableW = container.clientWidth - 48;
    const availableH = container.clientHeight - 48;
    
    const zoomW = availableW / sheet.width;
    const zoomH = availableH / sheet.height;
    
    // Choose the limiting zoom factor, up to 1x max (or larger if small image)
    const newZoom = Math.min(zoomW, zoomH);
    setZoom(Math.max(0.1, parseFloat(newZoom.toFixed(2))));
    setPan({ x: 0, y: 0 });
  };

  // Zoom helpers
  const handleZoomIn = () => setZoom((prev) => Math.min(10, +(prev + 0.15).toFixed(2)));
  const handleZoomOut = () => setZoom((prev) => Math.max(0.1, +(prev - 0.15).toFixed(2)));
  const handleZoomReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Mouse move over canvas: identify hovered sprite using backing coords
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || sheet.packedItems.length === 0) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Exact ratio of backing canvas to screen size
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    // Backing coordinate system
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    if (isDragging) {
      setPan(prev => ({
        x: prev.x + e.movementX,
        y: prev.y + e.movementY
      }));
    }

    // Find if mouse is inside any sprite's packed bounds
    let foundItem: PackResult | null = null;
    
    // Loop backwards to pick the top-most item if they overlap (though they shouldn't)
    for (let i = sheet.packedItems.length - 1; i >= 0; i--) {
      const item = sheet.packedItems[i];
      if (!item.fit) continue;

      if (
        mouseX >= item.x &&
        mouseX <= item.x + item.width &&
        mouseY >= item.y &&
        mouseY <= item.y + item.height
      ) {
        foundItem = item;
        break;
      }
    }

    setHoveredItem(foundItem);

    // Update floating tooltip position (relative to screen ClientX/Y or container)
    if (containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      setTooltipPos({
        x: e.clientX - containerRect.left + 15,
        y: e.clientY - containerRect.top + 15,
      });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Middle click or Alt+Left click or just any left click for panning on background
    if (e.button === 1 || e.button === 0) {
      setIsDragging(true);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
    setHoveredItem(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom((prev) => Math.min(10, Math.max(0.1, +(prev + delta).toFixed(2))));
    } else {
      setPan((prev) => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY,
      }));
    }
  };

  const handleCanvasClick = () => {
    if (hoveredItem && onSelectSprite) {
      onSelectSprite(hoveredItem.sprite.id);
    }
  };

  // Convert backing coords to container-relative scaled coordinates for highlight overlay
  const getHighlightStyle = () => {
    if (!hoveredItem || !canvasRef.current) return {};
    
    const item = hoveredItem;
    // Scale bounding box with current zoom
    const left = item.x * zoom;
    const top = item.y * zoom;
    const width = item.width * zoom;
    const height = item.height * zoom;

    return {
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
    };
  };

  return (
    <div id="preview-main" className="flex-1 flex flex-col bg-[#F1F5F9] text-slate-600 overflow-hidden relative h-full">
      {/* Warning Panel for Unfitted Items */}
      {sheet.unfittedItems.length > 0 && (
        <div className="bg-amber-50 border-b border-amber-200 p-3 px-4 flex items-center justify-between text-amber-800 text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4.5 h-4.5 text-amber-600 animate-pulse flex-shrink-0" />
            <span>
              <strong>部分图片未能排入图集！</strong>
              有 <span className="font-semibold underline font-mono">{sheet.unfittedItems.length}</span> 张图片因超出最大尺寸限制而被跳过。请在左侧增加<strong>最大宽度/高度限制</strong>。
            </span>
          </div>
          <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full font-mono font-semibold">
            尺寸不足
          </span>
        </div>
      )}

      {/* Control bar */}
      <div className="p-3 border-b border-slate-200 bg-white flex items-center justify-between gap-4 z-10 flex-wrap shadow-sm shadow-slate-100/50">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-50 text-indigo-600 p-1.5 rounded-lg border border-indigo-100/50">
            <MousePointer className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-800 block">可视化图集预览</span>
            <span className="text-[10px] text-slate-400 font-medium">缩放、移动并悬浮查看精灵映射坐标</span>
          </div>
        </div>

        {/* Toolbar controls */}
        <div className="flex items-center gap-2">
          {/* Grid Toggle */}
          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`p-1.5 rounded-lg border text-xs flex items-center gap-1.5 cursor-pointer transition-colors font-semibold ${
              showGrid
                ? 'bg-indigo-50 text-indigo-600 border-indigo-200'
                : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100 hover:text-slate-700'
            }`}
            title="显示/隐藏排版网格线"
          >
            <Grid className="w-4 h-4" />
            <span className="hidden sm:inline">显示边框</span>
          </button>

          {/* Separator */}
          <div className="w-px h-5 bg-slate-200 mx-1"></div>

          {/* Zoom controls */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-0.5">
            <button
              onClick={handleZoomOut}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/50 rounded transition-colors cursor-pointer"
              title="缩小"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={handleZoomReset}
              className="px-2.5 py-1 text-xs font-mono font-bold text-slate-600 hover:text-slate-800 transition-colors"
              title="重置缩放"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              onClick={handleZoomIn}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/50 rounded transition-colors cursor-pointer"
              title="放大"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={fitToScreen}
            className="p-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-700 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer text-xs font-semibold"
            title="自适应大小"
          >
            <Maximize className="w-4 h-4" />
            <span className="hidden sm:inline">自适应</span>
          </button>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden p-6 flex items-center justify-center relative select-none"
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        style={{
          backgroundImage: showGrid && settings.backgroundColor === 'transparent' ? 'none' : undefined,
        }}
      >
        {/* Sleek radial dot background for high precision visual focus */}
        {settings.backgroundColor === 'transparent' && (
          <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#cbd5e1 1.2px, transparent 1.2px)', backgroundSize: '20px 20px' }} />
        )}

        {sheet.width === 0 ? (
          <div className="text-center p-8 text-slate-400 max-w-sm flex flex-col items-center justify-center gap-3 z-10">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50/60 border border-indigo-100/80 flex items-center justify-center text-indigo-600">
              <Sparkles className="w-6 h-6 stroke-[1.5]" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-700">等待上传精灵图片...</p>
              <p className="text-xs text-slate-400 leading-normal font-medium">
                在右侧面板上传几张切图图片，本区域将实时预览无缝拼合出的精灵大图，并支持交互。
              </p>
            </div>
          </div>
        ) : (
          <div
            className="relative transition-all z-10"
            style={{
              width: `${sheet.width * zoom}px`,
              height: `${sheet.height * zoom}px`,
              transform: `translate(${pan.x}px, ${pan.y}px)`,
            }}
          >
            {/* Checkerboard/background container */}
            <div
              className={`absolute inset-0 rounded-lg overflow-hidden border-2 border-slate-300/80 shadow-2xl ${
                settings.backgroundColor === 'transparent' ? 'checkerboard' : ''
              }`}
              style={{
                backgroundColor: settings.backgroundColor !== 'transparent' ? settings.backgroundColor : undefined,
              }}
            >
              {/* Target Canvas */}
              <canvas
                ref={canvasRef}
                onMouseMove={handleMouseMove}
                onClick={handleCanvasClick}
                className={`w-full h-full block image-render-pixel ${isDragging ? 'cursor-grabbing' : 'cursor-crosshair'}`}
              />
            </div>

            {/* Sprites bounding-box grid overlay (Optional) */}
            {showGrid && sheet.packedItems.map((item, idx) => {
              if (!item.fit) return null;
              return (
                <div
                  key={`border-${idx}`}
                  className="absolute border border-indigo-500/30 pointer-events-none transition-colors group-hover:border-indigo-500/50"
                  style={{
                    left: `${item.x * zoom}px`,
                    top: `${item.y * zoom}px`,
                    width: `${item.width * zoom}px`,
                    height: `${item.height * zoom}px`,
                  }}
                />
              );
            })}

            {/* Selected Highlight Box */}
            {selectedSpriteId && sheet.packedItems.find(i => i.sprite.id === selectedSpriteId) && (
              <div
                className="absolute border-[3px] border-blue-500 bg-blue-500/20 pointer-events-none z-10 shadow-[0_0_12px_rgba(59,130,246,0.8)] transition-all duration-75"
                style={(() => {
                  const item = sheet.packedItems.find(i => i.sprite.id === selectedSpriteId);
                  if (!item) return {};
                  return {
                    left: `${item.x * zoom}px`,
                    top: `${item.y * zoom}px`,
                    width: `${item.width * zoom}px`,
                    height: `${item.height * zoom}px`,
                  };
                })()}
              />
            )}

            {/* Hover Highlight Box */}
            {hoveredItem && (
              <div
                className="absolute border-2 border-indigo-500 bg-indigo-500/15 pointer-events-none z-20 shadow-[0_0_12px_rgba(99,102,241,0.6)] transition-all duration-75"
                style={getHighlightStyle()}
              />
            )}
          </div>
        )}

        {/* Floating Tooltip details */}
        {hoveredItem && (
          <div
            className="absolute z-30 bg-white/95 border border-slate-200 p-3.5 rounded-xl shadow-2xl backdrop-blur-md pointer-events-none text-slate-700 max-w-xs transition-transform duration-75 text-xs flex flex-col gap-1.5"
            style={{
              left: `${tooltipPos.x}px`,
              top: `${tooltipPos.y}px`,
              transform: 'translate(0, 0)',
            }}
          >
            <div className="flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
              <span className="font-mono font-bold text-slate-800 truncate text-[13px]">{hoveredItem.sprite.name}</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[10px] text-slate-500">
              <span>大图坐标 X:</span>
              <span className="text-slate-800 text-right font-bold">{hoveredItem.x} px</span>
              
              <span>大图坐标 Y:</span>
              <span className="text-slate-800 text-right font-bold">{hoveredItem.y} px</span>
              
              <span>排版尺寸:</span>
              <span className="text-indigo-600 text-right font-bold">
                {hoveredItem.width} × {hoveredItem.height}
              </span>
              
              <span>原始尺寸:</span>
              <span className="text-slate-700 text-right font-semibold">
                {hoveredItem.sprite.originalWidth} × {hoveredItem.sprite.originalHeight}
              </span>

              {hoveredItem.sprite.trimmed && (
                <>
                  <span className="col-span-2 border-t border-slate-100 my-1"></span>
                  <span>透明裁剪偏移 X:</span>
                  <span className="text-emerald-600 text-right font-bold">{hoveredItem.sprite.trimOffset.x} px</span>
                  <span>透明裁剪偏移 Y:</span>
                  <span className="text-emerald-600 text-right font-bold">{hoveredItem.sprite.trimOffset.y} px</span>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer statistics bar */}
      {sheet.width > 0 && (
        <div id="preview-footer" className="p-3.5 border-t border-slate-200 bg-white text-xs text-slate-500 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-sans shadow-inner shadow-slate-50/50">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">图集分辨率:</span>
              <span className="font-mono text-slate-800 font-bold bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                {sheet.width} × {sheet.height} px
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">拼合率 (Efficiency):</span>
              <span className="font-mono text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                {sheet.efficiency.toFixed(1)}%
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">已拼入精灵数:</span>
              <span className="font-mono text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100/80">
                {sheet.packedItems.filter((i) => i.fit).length} / {sheet.packedItems.length + sheet.unfittedItems.length}
              </span>
            </div>
          </div>

          <div className="text-[10px] text-slate-400 leading-normal italic text-right flex items-center gap-1 font-medium">
            <HelpCircle className="w-3 h-3" />
            支持 WebGL 等性能渲染引擎。
          </div>
        </div>
      )}
    </div>
  );
};
