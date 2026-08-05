/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, useEffect } from 'react';
import {
  SpriteItem,
  PackSettings,
  PackedSheet,
} from './types';
import { SidebarSettings } from './components/SidebarSettings';
import { SpriteList } from './components/SpriteList';
import { CanvasPreview } from './components/CanvasPreview';
import { packSprites } from './utils/packer';
import {
  loadImage,
  getTrimmedBounds,
  drawPackedSheet,
  generateAtlasJSON,
  generateAtlasCSS,
} from './utils/image';
import {
  Download,
  Image as ImageIcon,
  FileJson,
  Sparkles,
  Loader2,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Trash2,
  FolderHeart,
  Save,
  FolderOpen
} from 'lucide-react';
import JSZip from 'jszip';

const DEFAULT_SETTINGS: PackSettings = {
  padding: 2,
  spacing: 2,
  maxWidth: 2048,
  maxHeight: 2048,
  forcePowerOfTwo: true,
  forceSquare: false,
  trim: true,
  algorithm: 'growing-binpacker',
  backgroundColor: 'transparent',
  format: 'json-hash',
  scale: 1,
  sortMethod: 'area-desc',
};

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export default function App() {
  const [sprites, setSprites] = useState<SpriteItem[]>([]);
  const [settings, setSettings] = useState<PackSettings>(DEFAULT_SETTINGS);
  const [isProcessing, setIsProcessing] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [selectedSpriteId, setSelectedSpriteId] = useState<string | null>(null);

  // Show status toasts
  const showToast = (message: string, type: Toast['type'] = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Convert files into SpriteItems with cached trim values
  const processFile = async (file: File, finalName: string): Promise<SpriteItem> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string;
        try {
          const img = await loadImage(dataUrl);
          const bounds = getTrimmedBounds(img);
          
          resolve({
            id: Math.random().toString(36).substring(2, 9),
            name: finalName,
            file: file,
            width: img.width,
            height: img.height,
            originalWidth: img.width,
            originalHeight: img.height,
            trimmed: false,
            trimOffset: { x: 0, y: 0 },
            dataUrl: dataUrl,
            imgElement: img,
            trimBounds: {
              x: bounds.x,
              y: bounds.y,
              w: bounds.width,
              h: bounds.height
            }
          });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('无法读取图片文件'));
      reader.readAsDataURL(file);
    });
  };

  // Create on-the-fly procedural vectors for instant demo previewing
  const createDemoSprite = async (type: string, name: string): Promise<SpriteItem> => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, 128, 128);

      ctx.save();
      ctx.translate(64, 64);

      if (type === 'gem') {
        // High quality faceted Red Ruby Gem
        ctx.beginPath();
        ctx.moveTo(0, -40);
        ctx.lineTo(35, -15);
        ctx.lineTo(20, 35);
        ctx.lineTo(-20, 35);
        ctx.lineTo(-35, -15);
        ctx.closePath();
        
        const grad = ctx.createRadialGradient(-10, -10, 5, 0, 0, 50);
        grad.addColorStop(0, '#f43f5e'); // rose 500
        grad.addColorStop(1, '#9f1239'); // rose 800
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, -40);
        ctx.lineTo(0, 35);
        ctx.moveTo(-35, -15);
        ctx.lineTo(35, -15);
        ctx.moveTo(-20, 35);
        ctx.lineTo(0, -40);
        ctx.moveTo(20, 35);
        ctx.lineTo(0, -40);
        ctx.stroke();
      } else if (type === 'coin') {
        // Glowing Golden Coin
        ctx.beginPath();
        ctx.arc(0, 0, 42, 0, Math.PI * 2);
        const grad = ctx.createRadialGradient(-6, -6, 12, 0, 0, 42);
        grad.addColorStop(0, '#fbbf24'); // amber-400
        grad.addColorStop(1, '#b45309'); // amber-700
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, 0, 28, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#78350f';
        ctx.font = 'bold 24px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', 0, 1);
      } else if (type === 'star') {
        // Magical Sky Blue Star
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const angle = (i * Math.PI) / 5 - Math.PI / 2;
          const r = i % 2 === 0 ? 45 : 20;
          ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
        }
        ctx.closePath();
        const grad = ctx.createLinearGradient(-30, -30, 30, 30);
        grad.addColorStop(0, '#38bdf8'); // sky-400
        grad.addColorStop(1, '#0369a1'); // sky-700
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 3;
        ctx.stroke();
      } else if (type === 'heart') {
        // Hot Pink Love Heart
        ctx.beginPath();
        ctx.moveTo(0, 15);
        ctx.bezierCurveTo(-35, -20, -35, -48, 0, -25);
        ctx.bezierCurveTo(35, -48, 35, -20, 0, 15);
        ctx.closePath();
        const grad = ctx.createRadialGradient(-5, -12, 6, 0, 0, 40);
        grad.addColorStop(0, '#ec4899'); // pink-500
        grad.addColorStop(1, '#9d174d'); // pink-800
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = '#831843';
        ctx.lineWidth = 3;
        ctx.stroke();
      } else if (type === 'fire') {
        // Orange & Red Flame Burst
        ctx.beginPath();
        ctx.moveTo(0, 42);
        ctx.bezierCurveTo(-25, 42, -35, 18, -15, -12);
        ctx.bezierCurveTo(-28, -2, -18, -42, 0, -42);
        ctx.bezierCurveTo(18, -42, 28, -2, 15, -12);
        ctx.bezierCurveTo(35, 18, 25, 42, 0, 42);
        ctx.closePath();
        const grad = ctx.createLinearGradient(0, 42, 0, -42);
        grad.addColorStop(0, '#ea580c'); // orange-600
        grad.addColorStop(0.5, '#dc2626'); // red-600
        grad.addColorStop(1, '#fbbf24'); // amber-400
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = '#991b1b';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      } else if (type === 'shield') {
        // Purple Mage Shield
        ctx.beginPath();
        ctx.moveTo(-35, -40);
        ctx.lineTo(35, -40);
        ctx.quadraticCurveTo(35, 10, 0, 44);
        ctx.quadraticCurveTo(-35, 10, -35, -40);
        ctx.closePath();
        const grad = ctx.createLinearGradient(-35, -40, 35, 44);
        grad.addColorStop(0, '#a855f7'); // purple-500
        grad.addColorStop(1, '#581c87'); // purple-900
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = '#4a044e';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-15, -10);
        ctx.lineTo(15, -10);
        ctx.moveTo(0, -25);
        ctx.lineTo(0, 15);
        ctx.stroke();
      }

      ctx.restore();
    }

    const dataUrl = canvas.toDataURL('image/png');
    
    // Create File object to model normal file upload
    const byteString = atob(dataUrl.split(',')[1]);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: 'image/png' });
    const file = new File([blob], name, { type: 'image/png' });

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const bounds = getTrimmedBounds(img);
        resolve({
          id: Math.random().toString(36).substring(2, 9),
          name,
          file,
          width: img.width,
          height: img.height,
          originalWidth: img.width,
          originalHeight: img.height,
          trimmed: false,
          trimOffset: { x: 0, y: 0 },
          dataUrl,
          imgElement: img,
          trimBounds: {
            x: bounds.x,
            y: bounds.y,
            w: bounds.width,
            h: bounds.height
          }
        });
      };
      img.src = dataUrl;
    });
  };

  const handleLoadDemo = async () => {
    setIsProcessing(true);
    try {
      const demoItems = [
        await createDemoSprite('gem', 'sprite_ruby_gem.png'),
        await createDemoSprite('coin', 'sprite_gold_coin.png'),
        await createDemoSprite('star', 'sprite_electric_star.png'),
        await createDemoSprite('heart', 'sprite_love_heart.png'),
        await createDemoSprite('fire', 'sprite_flame_burst.png'),
        await createDemoSprite('shield', 'sprite_magic_shield.png'),
      ];
      setSprites((prev) => {
        // Remove existing items with duplicate names to prevent cluttering
        const filteredPrev = prev.filter((s) => !demoItems.some((d) => d.name === s.name));
        return [...filteredPrev, ...demoItems];
      });
      showToast('成功加载 6 个高清矢量演示精灵！', 'success');
    } catch (err) {
      console.error(err);
      showToast('加载演示素材失败，请重试！', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpload = async (files: FileList | File[]) => {
    setIsProcessing(true);
    const newSprites: SpriteItem[] = [];
    const errors: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Ensure it is indeed an image
      if (!file.type.startsWith('image/')) {
        errors.push(`文件 ${file.name} 不是支持的图片格式`);
        continue;
      }

      // No renaming, just use the original file name. Later we filter out old ones with the same name.
      const finalName = file.name;

      try {
        const sprite = await processFile(file, finalName);
        // If there are duplicates within the same batch, keep the latest one
        const existingIdx = newSprites.findIndex(s => s.name === finalName);
        if (existingIdx !== -1) {
          newSprites[existingIdx] = sprite;
        } else {
          newSprites.push(sprite);
        }
      } catch (err) {
        console.error(err);
        errors.push(`文件 ${file.name} 读取失败`);
      }
    }

    if (newSprites.length > 0) {
      setSprites((prev) => {
        const filteredPrev = prev.filter(s => !newSprites.some(ns => ns.name === s.name));
        return [...filteredPrev, ...newSprites];
      });
      showToast(`成功导入 ${newSprites.length} 张图片！${sprites.some(s => newSprites.some(ns => ns.name === s.name)) ? '已覆盖同名图片。' : ''}`, 'success');
    }

    if (errors.length > 0) {
      showToast(errors.join(', '), 'error');
    }
    
    setIsProcessing(false);
  };

  const handleDeleteSprite = (id: string) => {
    setSprites((prev) => prev.filter((s) => s.id !== id));
    if (selectedSpriteId === id) setSelectedSpriteId(null);
    showToast('精灵已从切图素材库中移除', 'info');
  };

  const handleDeleteAll = () => {
    setSprites([]);
    setSelectedSpriteId(null);
    showToast('素材库已全部清空', 'info');
  };

  const handleRenameSprite = (id: string, newName: string) => {
    setSprites((prev) =>
      prev.map((s) => {
        if (s.id === id) {
          // Keep file extension if omitted
          let nameWithExt = newName;
          const origExt = s.file.name.split('.').pop();
          if (origExt && !newName.endsWith(`.${origExt}`)) {
            nameWithExt = `${newName}.${origExt}`;
          }
          return { ...s, name: nameWithExt };
        }
        return s;
      })
    );
    showToast('重命名精灵成功！', 'success');
  };

  const handleUpdateNineSlice = (id: string, nineSlice: {top: number, right: number, bottom: number, left: number} | undefined) => {
    setSprites((prev) =>
      prev.map((s) => (s.id === id ? { ...s, nineSlice } : s))
    );
  };

  // Dynamically apply Trim margins depending on Settings toggle
  const adjustedSprites = useMemo(() => {
    return sprites.map((sprite) => {
      if (settings.trim && sprite.trimBounds) {
        const hasTrimOffset =
          sprite.trimBounds.w < sprite.originalWidth ||
          sprite.trimBounds.h < sprite.originalHeight ||
          sprite.trimBounds.x > 0 ||
          sprite.trimBounds.y > 0;

        return {
          ...sprite,
          width: sprite.trimBounds.w,
          height: sprite.trimBounds.h,
          trimmed: hasTrimOffset,
          trimOffset: { x: sprite.trimBounds.x, y: sprite.trimBounds.y },
        };
      } else {
        return {
          ...sprite,
          width: sprite.originalWidth,
          height: sprite.originalHeight,
          trimmed: false,
          trimOffset: { x: 0, y: 0 },
        };
      }
    });
  }, [sprites, settings.trim]);

  // Pack coordinates of adjusted sprites instantly
  const packedSheet = useMemo(() => {
    return packSprites(adjustedSprites, settings);
  }, [adjustedSprites, settings]);

  // General single-file download triggers
  const downloadFile = (content: string | Blob, filename: string, mimeType: string) => {
    const blob = typeof content === 'string' ? new Blob([content], { type: mimeType }) : content;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSaveProject = () => {
    if (sprites.length === 0) {
      showToast('没有任何切图素材可以保存。', 'error');
      return;
    }
    const projectData = {
      settings,
      sprites: sprites.map(s => ({
        id: s.id,
        name: s.name,
        width: s.width,
        height: s.height,
        originalWidth: s.originalWidth,
        originalHeight: s.originalHeight,
        trimmed: s.trimmed,
        trimOffset: s.trimOffset,
        dataUrl: s.dataUrl,
        trimBounds: s.trimBounds,
        nineSlice: s.nineSlice,
      }))
    };
    downloadFile(JSON.stringify(projectData), 'sprite-project.json', 'application/json');
    showToast('项目保存成功！', 'success');
  };

  const handleLoadProject = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement;
      if (target.files && target.files.length > 0) {
        const file = target.files[0];
        const reader = new FileReader();
        reader.onload = async (re) => {
          try {
            const projectData = JSON.parse(re.target?.result as string);
            if (projectData.settings) {
              setSettings(projectData.settings);
            }
            if (projectData.sprites && Array.isArray(projectData.sprites)) {
              setIsProcessing(true);
              const restoredSprites: SpriteItem[] = [];
              for (const s of projectData.sprites) {
                const img = await loadImage(s.dataUrl);
                restoredSprites.push({
                  ...s,
                  imgElement: img,
                });
              }
              setSprites(restoredSprites);
              showToast('项目加载成功！', 'success');
            }
          } catch (err) {
            console.error(err);
            showToast('无法解析项目文件。', 'error');
          } finally {
            setIsProcessing(false);
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  // Export Combined PNG Image
  const handleExportPng = () => {
    if (sprites.length === 0 || packedSheet.packedItems.filter((i) => i.fit).length === 0) {
      showToast('没有精灵图可以导出，请先上传切图素材！', 'error');
      return;
    }
    
    setIsProcessing(true);
    const canvas = drawPackedSheet(packedSheet, settings.backgroundColor, settings.scale);
    canvas.toBlob((blob) => {
      if (blob) {
        downloadFile(blob, 'spritesheet.png', 'image/png');
        showToast('图集大图 (PNG) 导出成功！', 'success');
      } else {
        showToast('图集图片生成失败，请稍后重试！', 'error');
      }
      setIsProcessing(false);
    }, 'image/png');
  };

  // Export JSON/CSS Mapping
  const handleExportConfig = () => {
    if (sprites.length === 0 || packedSheet.packedItems.filter((i) => i.fit).length === 0) {
      showToast('没有图集配置可以导出，请先上传切图素材！', 'error');
      return;
    }

    let content = '';
    let filename = '';
    let mimeType = '';

    if (settings.format === 'css') {
      content = generateAtlasCSS(packedSheet, 'spritesheet.png', settings.scale);
      filename = 'spritesheet.css';
      mimeType = 'text/css';
    } else {
      content = generateAtlasJSON(packedSheet, 'spritesheet.png', settings.format, settings.scale);
      filename = 'spritesheet.json';
      mimeType = 'application/json';
    }

    downloadFile(content, filename, mimeType);
    showToast(`映射文件 (${filename.toUpperCase()}) 导出成功！`, 'success');
  };

  // Export Single Packed ZIP containing BOTH files
  const handleExportZip = async () => {
    if (sprites.length === 0 || packedSheet.packedItems.filter((i) => i.fit).length === 0) {
      showToast('精美图集无可导出项，请先载入切图！', 'error');
      return;
    }

    setIsProcessing(true);
    try {
      const zip = new JSZip();

      // 1. Draw Canvas and generate Blob
      const canvas = drawPackedSheet(packedSheet, settings.backgroundColor, settings.scale);
      const pngBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!pngBlob) {
        throw new Error('Canvas render failed');
      }
      zip.file('spritesheet.png', pngBlob);

      // 2. Format corresponding metadata map
      let configContent = '';
      let configFilename = '';

      if (settings.format === 'css') {
        configContent = generateAtlasCSS(packedSheet, 'spritesheet.png', settings.scale);
        configFilename = 'spritesheet.css';
      } else {
        configContent = generateAtlasJSON(packedSheet, 'spritesheet.png', settings.format, settings.scale);
        configFilename = 'spritesheet.json';
      }
      
      zip.file(configFilename, configContent);

      // 3. Assemble and build ZIP
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      downloadFile(zipBlob, 'spritesheet_atlas.zip', 'application/zip');
      showToast('大图与 JSON/CSS 映射配置文件成功打包导出 ZIP！', 'success');
    } catch (err) {
      console.error(err);
      showToast('打包 ZIP 导出失败，请重试！', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div id="main-app" className="flex flex-col h-screen w-screen bg-[#F8FAFC] font-sans text-slate-700 overflow-hidden select-none">
      
      {/* Toast Alert Notifications */}
      <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none max-w-md w-full px-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center justify-between gap-3 p-3.5 rounded-xl border shadow-xl backdrop-blur-md animate-fade-in ${
              toast.type === 'success'
                ? 'bg-white/95 text-slate-800 border-emerald-100 shadow-emerald-50'
                : toast.type === 'error'
                ? 'bg-white/95 text-slate-800 border-rose-100 shadow-rose-50'
                : 'bg-white/95 text-slate-800 border-indigo-100 shadow-indigo-50'
            }`}
          >
            <div className="flex items-center gap-2">
              {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />}
              {toast.type === 'error' && <XCircle className="w-5 h-5 text-rose-500 flex-shrink-0" />}
              {toast.type === 'info' && <Sparkles className="w-5 h-5 text-indigo-500 flex-shrink-0" />}
              <span className="text-xs font-semibold leading-relaxed text-slate-700">{toast.message}</span>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <XCircle className="w-4 h-4 opacity-70 hover:opacity-100" />
            </button>
          </div>
        ))}
      </div>

      {/* Global Processing Loader Overlay */}
      {isProcessing && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-40 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
          <p className="text-sm font-semibold text-slate-700">正在打包并重排精灵图集...</p>
        </div>
      )}

      {/* Header Top Bar */}
      <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 z-20 flex-shrink-0 shadow-sm shadow-slate-100/50">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-xl shadow-md shadow-indigo-100">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-sans font-bold text-base tracking-tight text-slate-800 flex items-center gap-2">
              SpriteForge
              <span className="text-[10px] bg-indigo-50 text-indigo-600 font-semibold px-2 py-0.5 rounded-full border border-indigo-100 uppercase">
                在线精灵大图打包器
              </span>
            </h1>
            <p className="text-[10px] text-slate-400 font-medium">超紧凑像素级自动图集拼接与 JSON 导出工具</p>
          </div>
        </div>

        {/* Global actions bar */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleLoadProject}
            className="px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-600 text-xs font-semibold rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-sm"
            title="导入以前保存的项目文件 (.json)"
          >
            <FolderOpen className="w-4 h-4 text-orange-500" />
            导入项目
          </button>
          
          {sprites.length === 0 && (
            <button
              onClick={handleLoadDemo}
              className="px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-600 text-xs font-semibold rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-sm"
            >
              <FolderHeart className="w-4 h-4 text-pink-500 animate-pulse" />
              加载演示素材
            </button>
          )}

          {sprites.length > 0 && (
            <>
              <button
                onClick={handleSaveProject}
                className="px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-600 text-xs font-semibold rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-sm"
                title="保存当前编辑进度 (.json)"
              >
                <Save className="w-4 h-4 text-blue-500" />
                保存项目
              </button>
              
              <div className="w-px h-6 bg-slate-200 mx-1"></div>

              <button
                onClick={handleExportPng}
                className="px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-600 text-xs font-semibold rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-sm"
                title="单独导出大图图片 (PNG)"
              >
                <ImageIcon className="w-4 h-4 text-indigo-500" />
                导出图集 (PNG)
              </button>

              <button
                onClick={handleExportConfig}
                className="px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-600 text-xs font-semibold rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-sm"
                title="单独导出配置文件 (JSON / CSS)"
              >
                <FileJson className="w-4 h-4 text-emerald-500" />
                导出配置 ({settings.format === 'css' ? 'CSS' : 'JSON'})
              </button>

              <button
                onClick={handleExportZip}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-indigo-100 cursor-pointer border border-indigo-600"
                title="一键打包导出图片 + 配置文件 ZIP 压缩包"
              >
                <Download className="w-4 h-4" />
                一键打包 (ZIP)
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main Split Interface */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        {/* Left Settings Sidebar */}
        <SidebarSettings
          settings={settings}
          onChange={setSettings}
          onReset={() => setSettings(DEFAULT_SETTINGS)}
        />

        {/* Middle Canvas Workspace */}
        <CanvasPreview
          sheet={packedSheet}
          settings={settings}
          selectedSpriteId={selectedSpriteId}
          onSelectSprite={setSelectedSpriteId}
        />

        {/* Right Sprite Library list */}
        <SpriteList
          sprites={sprites}
          onUpload={handleUpload}
          onDelete={handleDeleteSprite}
          onDeleteAll={handleDeleteAll}
          onRename={handleRenameSprite}
          onUpdateNineSlice={handleUpdateNineSlice}
          selectedSpriteId={selectedSpriteId}
          onSelectSprite={setSelectedSpriteId}
        />
      </main>
    </div>
  );
}
