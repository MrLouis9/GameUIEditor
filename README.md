# GameUIEditer

Figma-like 游戏 UI 编辑器。画布使用 **PixiJS**（与 AI Studio 游戏一致），导出 **Document JSON** 供 AI / 运行时消费。

## 结构

```
apps/editor          主编辑器 (React + PixiJS)
packages/atlas       图集拼合 / 九宫 / 导出（自 Sprite sheet packer）
packages/document    文档模型、命令、历史、序列化
docs/                导出契约说明
Sprite sheet packer/ 原独立图集工具（保留参考）
```

## 快速开始

本机若未安装 Node，可用仓库内便携版（安装后）：

```bash
# PowerShell
$env:Path = "d:\项目\GameUIEditer\.tools\node-v22.17.0-win-x64;$env:Path"
cd apps/editor
npm install
npm run dev
```

或系统已有 Node 时在仓库根目录：

```bash
npm run dev
```

打开 http://localhost:5173

> 说明：Windows 下未使用 npm workspaces 软链，`@game-ui/*` 通过 Vite / tsconfig paths 直引 `packages/*` 源码。

## P0–P1 已具备

- 设计稿多分辨率预设（1280×720 / 1680×720 / 720×1280 / 720×1560）
- 资源上传、**资源编辑**（改名/换图/九宫/迁移图集）、添加到画布（Pixi NineSliceSprite）
- **多图集**：创建/命名/切换/删除（如：图标、活动、其他界面）；拼合仅针对当前图集
- **拖拽**：从资源库把精灵拖到画布落点放置
- 图层树、父子、打组、锁定、显示隐藏、重命名
- 选择 / 拖拽移动 / **八角缩放手柄**、属性面板（位置大小旋转透明度）
- **对齐**（相对画板或选区）与水平/垂直分布
- **图集拼合面板**（算法/间距、预览、导出 PNG + JSON/CSS）
- Ctrl+Z / Y 撤销重做，复制粘贴再制
- 本地自动保存 + 导入导出 JSON（AI 契约见 `docs/document-schema.md`）

## AI 消费路径

```
Document JSON  →  AI 分析  →  React / Vue / HTML / Pixi
```

类比 Figma File → REST API → JSON。
