/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { PackSettings, PackingAlgorithm, ExportFormat } from '../types';
import {
  Sliders,
  Crop,
  Layers,
  HelpCircle,
  FileJson,
  Maximize2,
  Paintbrush,
  Image,
  RefreshCw
} from 'lucide-react';

interface SidebarSettingsProps {
  settings: PackSettings;
  onChange: (settings: PackSettings) => void;
  onReset: () => void;
}

const ALGORITHMS: { value: PackingAlgorithm; label: string; desc: string }[] = [
  {
    value: 'growing-binpacker',
    label: '自适应二叉树 (最佳拼合)',
    desc: '自动往右/下生长，动态拼合，最节省空间（推荐）',
  },
  {
    value: 'shelf',
    label: '行列货架算法 (Shelf Row)',
    desc: '按行拼合，非常适合按特定顺序排列的动画帧',
  },
];

const SORT_METHODS: { value: PackSettings['sortMethod']; label: string }[] = [
  { value: 'area-desc', label: '按面积从大到小' },
  { value: 'height-desc', label: '按高度从大到小' },
  { value: 'width-desc', label: '按宽度从大到小' },
  { value: 'max-side-desc', label: '按最大单边长' },
  { value: 'name-asc', label: '按文件名升序' },
];

const PRESET_SIZES = [128, 256, 512, 1024, 2048, 4096, 8192];
const EXPORT_FORMATS: { value: ExportFormat; label: string; desc: string }[] = [
  { value: 'json-hash', label: 'JSON (Hash格式 - PixiJS/Phaser)', desc: '最通用的精灵图映射格式' },
  { value: 'json-array', label: 'JSON (Array格式 - Phaser/Cocos)', desc: '按数组列表存储精灵图帧' },
  { value: 'css', label: 'CSS Sprite (网页样式表)', desc: '生成可以直接用于网页背景定位的 CSS' },
];

export const SidebarSettings: React.FC<SidebarSettingsProps> = ({
  settings,
  onChange,
  onReset,
}) => {
  const updateSetting = <K extends keyof PackSettings>(key: K, value: PackSettings[K]) => {
    onChange({
      ...settings,
      [key]: value,
    });
  };

  return (
    <div id="sidebar-container" className="w-full lg:w-96 bg-white border-r border-slate-200 text-slate-600 flex flex-col h-full overflow-y-auto custom-scrollbar">
      {/* Sidebar Header */}
      <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Sliders className="w-5 h-5 text-indigo-600" />
          <h2 className="font-sans font-bold text-base text-slate-800 tracking-tight">排版与导出设置</h2>
        </div>
        <button
          onClick={onReset}
          className="text-slate-500 hover:text-slate-800 hover:bg-slate-100 p-1.5 rounded-lg transition-colors flex items-center gap-1 text-xs font-mono border border-slate-200 hover:border-slate-300"
          title="重置为默认值"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          重置
        </button>
      </div>

      <div className="p-5 space-y-6 flex-1">
        {/* Packing Algorithm */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-600" />
            排版算法
          </label>
          <div className="grid grid-cols-1 gap-2">
            {ALGORITHMS.map((algo) => (
              <button
                key={algo.value}
                onClick={() => updateSetting('algorithm', algo.value)}
                className={`text-left p-3 rounded-xl border text-sm transition-all flex flex-col gap-1 ${
                  settings.algorithm === algo.value
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-950 shadow-sm shadow-indigo-100/50'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-800 hover:bg-slate-100/50'
                }`}
              >
                <span className="font-bold">{algo.label}</span>
                <span className="text-xs text-slate-400 leading-normal font-medium">{algo.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Sorting Methods */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              图片排序顺序
            </label>
            <div className="group relative">
              <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 cursor-pointer" />
              <div className="absolute right-0 bottom-full mb-2 w-56 p-2 bg-white border border-slate-200 text-xs text-slate-500 rounded-lg shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 leading-relaxed">
                不同的排序方式对最终排版的利用率（Efficiency）有显著影响。通常“按面积”或“按单边最大”能获得最佳利用率。
              </div>
            </div>
          </div>
          <select
            value={settings.sortMethod}
            onChange={(e) => updateSetting('sortMethod', e.target.value as PackSettings['sortMethod'])}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 cursor-pointer"
          >
            {SORT_METHODS.map((method) => (
              <option key={method.value} value={method.value}>
                {method.label}
              </option>
            ))}
          </select>
        </div>

        {/* Layout Dimensions & Limits */}
        <div className="space-y-4 pt-2 border-t border-slate-100">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Maximize2 className="w-3.5 h-3.5 text-indigo-600" />
            画布尺寸限制
          </label>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <span className="text-xs text-slate-400">最大宽度 (Width)</span>
              <select
                value={settings.maxWidth}
                onChange={(e) => updateSetting('maxWidth', Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 cursor-pointer"
              >
                {PRESET_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size} px
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <span className="text-xs text-slate-400">最大高度 (Height)</span>
              <select
                value={settings.maxHeight}
                onChange={(e) => updateSetting('maxHeight', Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 cursor-pointer"
              >
                {PRESET_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size} px
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-3 pt-1">
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={settings.forcePowerOfTwo}
                onChange={(e) => updateSetting('forcePowerOfTwo', e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 bg-slate-50 focus:ring-indigo-500 focus:ring-offset-white focus:ring-2"
              />
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-slate-700 group-hover:text-slate-900 transition-colors">
                  强制 2 的幂次方尺寸 (POT)
                </span>
                <span className="text-xs text-slate-400 leading-normal">
                  例如 256x512，对游戏引擎（WebGL）渲染最友好。
                </span>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={settings.forceSquare}
                onChange={(e) => updateSetting('forceSquare', e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 bg-slate-50 focus:ring-indigo-500 focus:ring-offset-white focus:ring-2"
              />
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-slate-700 group-hover:text-slate-900 transition-colors">
                  强制正方形 (Square)
                </span>
                <span className="text-xs text-slate-400 leading-normal">
                  宽度必须等于高度（例如 1024x1024）。
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Spacing & Padding Controls */}
        <div className="space-y-4 pt-2 border-t border-slate-100">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Crop className="w-3.5 h-3.5 text-indigo-600" />
            间距与边缘剪裁
          </label>

          <label className="flex items-center gap-3 cursor-pointer group pb-1">
            <input
              type="checkbox"
              checked={settings.trim}
              onChange={(e) => updateSetting('trim', e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-indigo-600 bg-slate-50 focus:ring-indigo-500 focus:ring-offset-white focus:ring-2"
            />
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-slate-700 group-hover:text-slate-900 transition-colors">
                自动裁剪透明像素 (Trim)
              </span>
              <span className="text-xs text-slate-400 leading-normal">
                自动剔除图片四周的完全透明区域，大幅节省排版体积。原尺寸信息会保存在 JSON 中。
              </span>
            </div>
          </label>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-slate-500">内部元素间距 (Spacing / Extrude)</span>
                <span className="font-mono text-indigo-600 font-bold">{settings.spacing} px</span>
              </div>
              <input
                type="range"
                min="0"
                max="32"
                step="1"
                value={settings.spacing}
                onChange={(e) => updateSetting('spacing', Number(e.target.value))}
                className="w-full accent-indigo-600 bg-slate-100 h-1.5 rounded-lg appearance-none cursor-pointer border border-slate-200"
              />
              <span className="text-[10px] text-slate-400 leading-normal block font-medium">
                图片之间的像素间距，防止多张图邻近像素在游戏渲染时由于插值发生粘连/采样溢出（Bleeding）。
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-slate-500">画布外边缘边距 (Padding)</span>
                <span className="font-mono text-indigo-600 font-bold">{settings.padding} px</span>
              </div>
              <input
                type="range"
                min="0"
                max="64"
                step="1"
                value={settings.padding}
                onChange={(e) => updateSetting('padding', Number(e.target.value))}
                className="w-full accent-indigo-600 bg-slate-100 h-1.5 rounded-lg appearance-none cursor-pointer border border-slate-200"
              />
              <span className="text-[10px] text-slate-400 leading-normal block font-medium">
                图集最外层和边缘的像素间距。
              </span>
            </div>
          </div>
        </div>

        {/* Export configurations */}
        <div className="space-y-4 pt-2 border-t border-slate-100 pb-2">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <FileJson className="w-3.5 h-3.5 text-indigo-600" />
            导出与格式配置
          </label>

          {/* Export format */}
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-slate-500">配置文件格式</span>
            <select
              value={settings.format}
              onChange={(e) => updateSetting('format', e.target.value as ExportFormat)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 cursor-pointer"
            >
              {EXPORT_FORMATS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-slate-400 font-medium leading-normal">
              {EXPORT_FORMATS.find((f) => f.value === settings.format)?.desc}
            </p>
          </div>

          {/* Scale selection */}
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-slate-500">导出缩放比例 (Scale)</span>
            <select
              value={settings.scale}
              onChange={(e) => updateSetting('scale', Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 cursor-pointer"
            >
              <option value="0.25">0.25x (压缩体积)</option>
              <option value="0.5">0.5x (半尺寸)</option>
              <option value="1">1.0x (原始分辨率)</option>
              <option value="2">2.0x (高清放大 / 2x Retinas)</option>
              <option value="3">3.0x</option>
              <option value="4">4.0x (像素风格放大)</option>
            </select>
          </div>

          {/* Background settings */}
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
              <Paintbrush className="w-3.5 h-3.5 text-indigo-600" />
              导出图集背景色
            </span>
            <div className="flex gap-2.5 items-center">
              <button
                onClick={() => updateSetting('backgroundColor', 'transparent')}
                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                  settings.backgroundColor === 'transparent'
                    ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
                }`}
              >
                透明背景
              </button>
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg p-1">
                <input
                  type="color"
                  value={settings.backgroundColor === 'transparent' ? '#ffffff' : settings.backgroundColor}
                  onChange={(e) => updateSetting('backgroundColor', e.target.value)}
                  className="w-6 h-6 rounded border-0 cursor-pointer p-0 bg-transparent"
                  disabled={false}
                />
                <input
                  type="text"
                  value={settings.backgroundColor === 'transparent' ? '' : settings.backgroundColor}
                  onChange={(e) => updateSetting('backgroundColor', e.target.value)}
                  placeholder="自定义颜色代码"
                  className="w-24 bg-transparent border-0 text-xs text-slate-700 focus:outline-none p-1 font-mono uppercase"
                  onClick={() => {
                    if (settings.backgroundColor === 'transparent') {
                      updateSetting('backgroundColor', '#ffffff');
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
