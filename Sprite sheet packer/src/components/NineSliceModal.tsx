import React, { useState, useEffect } from 'react';
import { SpriteItem } from '../types';
import { X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface NineSliceModalProps {
  sprite: SpriteItem | null;
  onClose: () => void;
  onSave: (id: string, nineSlice: {top: number, right: number, bottom: number, left: number} | undefined) => void;
}

export const NineSliceModal: React.FC<NineSliceModalProps> = ({
  sprite,
  onClose,
  onSave
}) => {
  const [top, setTop] = useState(0);
  const [right, setRight] = useState(0);
  const [bottom, setBottom] = useState(0);
  const [left, setLeft] = useState(0);

  useEffect(() => {
    if (sprite) {
      if (sprite.nineSlice) {
        setTop(sprite.nineSlice.top);
        setRight(sprite.nineSlice.right);
        setBottom(sprite.nineSlice.bottom);
        setLeft(sprite.nineSlice.left);
      } else {
        setTop(0);
        setRight(0);
        setBottom(0);
        setLeft(0);
      }
    }
  }, [sprite]);

  if (!sprite) return null;

  const handleSave = () => {
    if (top === 0 && right === 0 && bottom === 0 && left === 0) {
      onSave(sprite.id, undefined);
    } else {
      onSave(sprite.id, { top, right, bottom, left });
    }
    onClose();
  };

  const clearAndSave = () => {
    onSave(sprite.id, undefined);
    onClose();
  };

  const imageWidth = sprite.originalWidth;
  const imageHeight = sprite.originalHeight;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col border border-slate-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <span className="text-indigo-600">9-Slice Editor</span>
              <span className="text-xs font-mono font-normal text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">{sprite.name}</span>
            </h3>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Left: Preview Area */}
            <div className="flex-1 bg-slate-900 p-6 flex items-center justify-center relative overflow-hidden checkerboard">
              <div className="relative shadow-2xl" style={{ width: imageWidth, height: imageHeight, maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}>
                <img
                  src={sprite.dataUrl}
                  alt={sprite.name}
                  className="w-full h-full block"
                />
                {/* 9-Slice Guides */}
                <div 
                  className="absolute left-0 right-0 border-t-2 border-emerald-400/80 pointer-events-none" 
                  style={{ top: `${(top / imageHeight) * 100}%`, display: top > 0 ? 'block' : 'none' }}
                >
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[9px] px-1 rounded font-mono font-bold leading-tight">{top}</div>
                </div>
                <div 
                  className="absolute left-0 right-0 border-t-2 border-emerald-400/80 pointer-events-none" 
                  style={{ bottom: `${(bottom / imageHeight) * 100}%`, display: bottom > 0 ? 'block' : 'none' }}
                >
                   <div className="absolute top-1 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[9px] px-1 rounded font-mono font-bold leading-tight">{bottom}</div>
                </div>
                <div 
                  className="absolute top-0 bottom-0 border-l-2 border-emerald-400/80 pointer-events-none" 
                  style={{ left: `${(left / imageWidth) * 100}%`, display: left > 0 ? 'block' : 'none' }}
                >
                   <div className="absolute top-1/2 -left-6 -translate-y-1/2 bg-emerald-500 text-white text-[9px] px-1 rounded font-mono font-bold leading-tight">{left}</div>
                </div>
                <div 
                  className="absolute top-0 bottom-0 border-l-2 border-emerald-400/80 pointer-events-none" 
                  style={{ right: `${(right / imageWidth) * 100}%`, display: right > 0 ? 'block' : 'none' }}
                >
                   <div className="absolute top-1/2 left-1 -translate-y-1/2 bg-emerald-500 text-white text-[9px] px-1 rounded font-mono font-bold leading-tight">{right}</div>
                </div>

                {/* Nodes at intersections */}
                {top > 0 && left > 0 && <div className="absolute w-2 h-2 bg-emerald-400 border border-white rounded-full -translate-x-1/2 -translate-y-1/2" style={{ top: `${(top / imageHeight) * 100}%`, left: `${(left / imageWidth) * 100}%` }} />}
                {top > 0 && right > 0 && <div className="absolute w-2 h-2 bg-emerald-400 border border-white rounded-full translate-x-1/2 -translate-y-1/2" style={{ top: `${(top / imageHeight) * 100}%`, right: `${(right / imageWidth) * 100}%` }} />}
                {bottom > 0 && left > 0 && <div className="absolute w-2 h-2 bg-emerald-400 border border-white rounded-full -translate-x-1/2 translate-y-1/2" style={{ bottom: `${(bottom / imageHeight) * 100}%`, left: `${(left / imageWidth) * 100}%` }} />}
                {bottom > 0 && right > 0 && <div className="absolute w-2 h-2 bg-emerald-400 border border-white rounded-full translate-x-1/2 translate-y-1/2" style={{ bottom: `${(bottom / imageHeight) * 100}%`, right: `${(right / imageWidth) * 100}%` }} />}
              </div>
            </div>

            {/* Right: Settings Sidebar */}
            <div className="w-64 bg-slate-50 p-4 border-l border-slate-200 flex flex-col gap-6">
              <div className="space-y-4">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-slate-800 uppercase">Sprite Info</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-white border border-slate-200 rounded p-2 text-slate-600">
                    <div>W: <span className="font-bold text-slate-800">{imageWidth}</span></div>
                    <div>H: <span className="font-bold text-slate-800">{imageHeight}</span></div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 uppercase">Border (px)</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Left (L)</label>
                      <input 
                        type="number" min="0" max={imageWidth}
                        value={left}
                        onChange={(e) => setLeft(Math.min(imageWidth, Math.max(0, Number(e.target.value))))}
                        className="w-full bg-white border border-slate-200 rounded p-1.5 text-sm font-mono text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" 
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Top (T)</label>
                      <input 
                        type="number" min="0" max={imageHeight}
                        value={top}
                        onChange={(e) => setTop(Math.min(imageHeight, Math.max(0, Number(e.target.value))))}
                        className="w-full bg-white border border-slate-200 rounded p-1.5 text-sm font-mono text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" 
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Right (R)</label>
                      <input 
                        type="number" min="0" max={imageWidth}
                        value={right}
                        onChange={(e) => setRight(Math.min(imageWidth, Math.max(0, Number(e.target.value))))}
                        className="w-full bg-white border border-slate-200 rounded p-1.5 text-sm font-mono text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" 
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Bottom (B)</label>
                      <input 
                        type="number" min="0" max={imageHeight}
                        value={bottom}
                        onChange={(e) => setBottom(Math.min(imageHeight, Math.max(0, Number(e.target.value))))}
                        className="w-full bg-white border border-slate-200 rounded p-1.5 text-sm font-mono text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" 
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-auto space-y-2">
                <button
                  onClick={clearAndSave}
                  className="w-full py-2 px-4 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 font-bold text-sm transition-colors"
                >
                  Clear Slice
                </button>
                <button
                  onClick={handleSave}
                  className="w-full py-2 px-4 rounded-lg border border-transparent bg-indigo-600 text-white hover:bg-indigo-700 font-bold text-sm transition-colors flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" /> Apply
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
