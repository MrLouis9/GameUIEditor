/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { SpriteItem } from '../types';
import { NineSliceModal } from './NineSliceModal';
import {
  Upload,
  Trash2,
  Search,
  Edit3,
  Check,
  X,
  Image as ImageIcon,
  FolderOpen,
  Info,
  Grid3X3
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SpriteListProps {
  sprites: SpriteItem[];
  onUpload: (files: FileList | File[]) => void;
  onDelete: (id: string) => void;
  onDeleteAll: () => void;
  onRename: (id: string, newName: string) => void;
  onUpdateNineSlice: (id: string, nineSlice: {top: number, right: number, bottom: number, left: number} | undefined) => void;
  selectedSpriteId: string | null;
  onSelectSprite: (spriteId: string | null) => void;
}

export const SpriteList: React.FC<SpriteListProps> = ({
  sprites,
  onUpload,
  onDelete,
  onDeleteAll,
  onRename,
  onUpdateNineSlice,
  selectedSpriteId,
  onSelectSprite,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUpload(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUpload(e.target.files);
    }
  };

  const startEditing = (id: string, currentName: string) => {
    setEditingId(id);
    setEditingValue(currentName);
  };

  const saveEditing = (id: string) => {
    if (editingValue.trim() && editingValue.trim() !== '') {
      onRename(id, editingValue.trim());
    }
    setEditingId(null);
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedSpriteId && listRef.current) {
      const element = document.getElementById(`sprite-item-${selectedSpriteId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [selectedSpriteId]);

  const filteredSprites = sprites.filter((sprite) =>
    sprite.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const expandedSprite = sprites.find(s => s.id === expandedId) || null;

  return (
    <div id="spritelist-container" className="w-full lg:w-80 bg-white border-l border-slate-200 text-slate-600 flex flex-col h-full overflow-hidden">
      {/* Search & Header */}
      <div className="p-4 border-b border-slate-200 space-y-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-1.5">
            <FolderOpen className="w-4 h-4 text-indigo-600" />
            <h3 className="font-bold text-sm text-slate-800">图片素材库</h3>
            <span className="bg-indigo-50 text-indigo-600 text-xs px-2 py-0.5 rounded-full font-mono font-bold border border-indigo-100">
              {sprites.length}
            </span>
          </div>
          {sprites.length > 0 && (
            <button
              onClick={onDeleteAll}
              className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 py-1 rounded-lg border border-rose-100 transition-all flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              清空
            </button>
          )}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="搜索精灵名称..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 placeholder-slate-400"
          />
        </div>
      </div>

      {/* Upload Box */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/20">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
            isDragging
              ? 'border-indigo-500 bg-indigo-50/50 shadow-md shadow-indigo-100 scale-[0.98]'
              : 'border-slate-300 hover:border-indigo-400 hover:text-indigo-500 bg-slate-50 hover:bg-white'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/png, image/jpeg, image/svg+xml, image/webp"
            className="hidden"
            onChange={handleFileChange}
          />
          <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600 border border-indigo-100/50">
            <Upload className="w-5 h-5" />
          </div>
          <div className="space-y-0.5">
            <p className="text-xs font-bold text-slate-700">点击或拖拽图片到这里</p>
            <p className="text-[10px] text-slate-400 font-medium">支持 PNG, JPG, WEBP, SVG</p>
          </div>
        </div>
      </div>

      {/* Sprite List Scroll Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2 bg-[#F8FAFC]/50">
        {sprites.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-center text-slate-400 gap-2 p-4">
            <ImageIcon className="w-8 h-8 text-slate-300 stroke-[1.5]" />
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-600">素材库空空如也</p>
              <p className="text-[10px] text-slate-400 leading-normal max-w-[200px] font-medium">
                请在上方拖入游戏切图或动画帧图片，系统将自动进行无缝超紧凑排版。
              </p>
            </div>
          </div>
        ) : filteredSprites.length === 0 ? (
          <div className="h-32 flex flex-col items-center justify-center text-center text-slate-400 gap-1.5">
            <p className="text-xs font-bold text-slate-600">没有找到匹配的精灵</p>
            <p className="text-[10px] text-slate-400 font-medium">尝试修改搜索关键字。</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {filteredSprites.map((sprite) => {
              const isEditing = editingId === sprite.id;
              
              return (
                <motion.div
                  key={sprite.id}
                  id={`sprite-item-${sprite.id}`}
                  layoutId={`sprite-card-${sprite.id}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className={`bg-white border rounded-xl p-2.5 flex flex-col gap-2 group hover:shadow-sm transition-all cursor-pointer ${selectedSpriteId === sprite.id ? 'border-blue-500 shadow-[0_0_0_2px_rgba(59,130,246,0.2)]' : 'border-slate-200/85 hover:border-indigo-300'}`}
                  onClick={() => onSelectSprite(sprite.id)}
                >
                  <div className="flex items-center justify-between gap-3">
                    {/* Left: Thumbnail Preview */}
                    <div className="flex items-center gap-3 overflow-hidden flex-1">
                      <div className="w-12 h-12 rounded-lg bg-white border border-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0 relative checkerboard">
                      <img
                        src={sprite.dataUrl}
                        alt={sprite.name}
                        referrerPolicy="no-referrer"
                        className="max-w-full max-h-full object-contain pointer-events-none"
                      />
                    </div>

                    {/* Middle: Details & Edit Name */}
                    <div className="flex-1 overflow-hidden min-w-0 pr-1">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5 w-full" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEditing(sprite.id);
                              if (e.key === 'Escape') cancelEditing();
                            }}
                            className="bg-slate-50 border border-indigo-500 rounded px-1.5 py-0.5 text-xs text-slate-800 focus:outline-none w-full font-mono font-medium"
                            autoFocus
                          />
                          <button
                            onClick={(e) => { e.stopPropagation(); saveEditing(sprite.id); }}
                            className="text-emerald-600 hover:text-emerald-700 p-0.5 rounded"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); cancelEditing(); }}
                            className="text-rose-600 hover:text-rose-700 p-0.5 rounded"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 group/title">
                            <span
                              className="text-xs font-mono font-bold text-slate-700 truncate leading-none block cursor-pointer hover:text-indigo-600 transition-colors"
                              onClick={(e) => { e.stopPropagation(); startEditing(sprite.id, sprite.name); }}
                              title="点击重命名"
                            >
                              {sprite.name}
                            </span>
                            <button
                              onClick={(e) => { e.stopPropagation(); startEditing(sprite.id, sprite.name); }}
                              className="opacity-0 group-hover/title:opacity-100 text-slate-400 hover:text-slate-600 transition-opacity p-0.5"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                          </div>
                          
                          {/* Dimensions & Trim Badges */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-mono text-slate-400 font-semibold">
                              {sprite.originalWidth}x{sprite.originalHeight}
                            </span>
                            {sprite.trimmed && (
                              <span
                                className="bg-emerald-50 text-emerald-600 border border-emerald-100/80 text-[9px] px-1 py-0.2 rounded font-sans font-bold flex items-center gap-0.5"
                                title={`裁剪后大小: ${sprite.width}x${sprite.height}, 偏移: X=${sprite.trimOffset.x} Y=${sprite.trimOffset.y}`}
                              >
                                <span>已剪裁</span>
                                <Info className="w-2.5 h-2.5" />
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex-shrink-0 flex items-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); setExpandedId(expandedId === sprite.id ? null : sprite.id); }}
                      className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                        expandedId === sprite.id
                          ? 'bg-indigo-50 text-indigo-600 border-indigo-200'
                          : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border-slate-200 hover:border-indigo-100 bg-slate-50'
                      }`}
                      title="九宫格切图设置 (9-Slice)"
                    >
                      <Grid3X3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(sprite.id); }}
                      className="text-slate-400 hover:text-rose-600 p-1.5 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-100 transition-all cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
                      title="删除该图片"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {expandedSprite && (
        <NineSliceModal
          sprite={expandedSprite}
          onClose={() => setExpandedId(null)}
          onSave={onUpdateNineSlice}
        />
      )}
    </div>
  );
};
