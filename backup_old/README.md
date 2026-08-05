# Game UI Editor (Figma-lite for Games)

## 1. 需求与功能点分析 (Feature Analysis)

本项目旨在实现一个轻量级的、专为游戏 UI 开发定制的 Web 端界面编辑器（Figma-lite）。

### 1.1 图集与资源管理 (Atlas & Asset Management)
- **资源上传**：支持用户上传单张游戏 UI 切图 (PNG/JPG)。
- **九宫格设置 (9-Slice)**：对单张切图设定上、下、左、右的九宫格拉伸参数。
- **图集拼合与导出**：将散图资源自动打包合并为整张大图，并生成对应的描述文件（支持导出 JSON + PNG）。
- **资源库管理**：切图库的增加、删除、修改、预览功能。

### 1.2 核心编辑功能 (Core Editor Features)
- **页面与层级树 (Pages & Layer Tree)**
  - 树状层级面板 (Layer Panel)，支持查看所有节点。
  - 支持拖拽节点调整层级关系，支持建立明确的父子节点嵌套关系 (Parent-Child Hierarchy)。
- **画布基础交互 (Canvas Interactions)**
  - 无限画布的平移与缩放 (Pan & Zoom)。
  - 框选、点选节点，显示选中包围盒与控制柄。
- **节点类型 (Node Types)**
  - 空容器节点 (Container)
  - 图像节点 (Sprite)
  - 九宫格节点 (NineSlice)
- **属性配置 (Property Inspector)**
  - 基础变换：坐标位置 (X, Y)、尺寸 (Width, Height)、旋转 (Rotation)。
  - 布局与对齐：左、中、右、上、下分布与对齐。
  - 视觉样式：透明度 (Opacity/Alpha)、颜色填充/叠加 (Fill/Tint)。
- **快捷操作与历史记录 (Shortcuts & History)**
  - 撤销 (Undo, Ctrl+Z) 与 重做 (Redo, Ctrl+Y)。
  - 复制、粘贴、删除节点。
  - 节点重命名。
  - 节点打组 (Group)、解组 (Ungroup)。
  - 锁定 (Lock) 与 隐藏 (Hide) 节点。

### 1.3 AI协同与多端架构 (AI & Game Engine Integration)
- **AI 结构化解析 (AI Parsing)**：放弃基于截图的图像识别，转而将界面设计导出为标准化的 **UI 树状 JSON Schema**。编辑器提供“分享”功能，生成公开链接（包含后台 API）。AI 通过链接拉取 JSON 数据，即可像读取 Figma API 一样，获得精准的节点名称、层级关系、绝对/相对位置等结构化信息，从而准确生成业务逻辑代码。
- **100% 游戏引擎还原 (PixiJS Reproduction)**：编辑器导出的 JSON 数据结构将与 PixiJS 的显示对象模型（DisplayObject）强对齐。包含具体的 Pivot/Anchor 机制、Transform 矩阵信息和 NineSlicePlane 参数。

---

## 2. 核心问题解答与技术选型 (Architecture & Tech Stack)

### 问题一：为了让 AI 像识别 Figma 一样识别界面，架构怎么调整？
**调整方案**：
1. **数据模型标准化**：整个应用的状态必须是一棵严格定义的 JSON 树。不能只存在于 DOM 中。
2. **云端持久化 (BaaS)**：设计完成后，点击“分享”，将 JSON 树上传至云端数据库（例如 Firebase Firestore 或 Cloud SQL），并生成一个唯一的 UUID 链接。
3. **数据 API 暴露**：系统提供一个公开的 `GET /api/document/:id` 接口。当把链接发给 AI 时，提示 AI 优先请求这个接口获取 JSON 数据。AI 看到标准 JSON 就能完美理解 UI 布局，完全不需要猜测。

### 问题二：游戏项目用 PixiJS，编辑器需要对标一样的技术架构吗？
**结论：渲染引擎无需强制一致，但“数据格式”与“数学模型”必须 100% 对齐 PixiJS。**
1. **统一渲染引擎 (Unified Rendering)**：既然目标游戏采用 PixiJS，为了达到 **100% 的所见即所得 (WYSIWYG)** 和像素级还原，编辑器前端的画布**必须直接使用 PixiJS**。
2. **数据的同构映射 (Isomorphic Mapping) 与 渲染**：
   - 弃用 Konva。因为 Konva 没有原生的九宫格 (9-Slice) 支持，且 Anchor/Pivot 坐标系与 PixiJS 有细微差异，强行转换会导致极高的维护成本和潜在的 1px 像素偏移。
   - 使用 `@pixi/react` 将 PixiJS 融入 React 生态。
   - 我们的 JSON 树状态将直接映射为 `<Container>`, `<Sprite>`, `<NineSlicePlane>` 等 PixiJS 节点。
   - **最终方案**：游戏项目端只需写一个轻量 Parser 读取 JSON 即可完美还原，因为编辑器本身就是用同款引擎渲染的。

### 3. 开发技术选型 (Tech Stack)
- **基础框架**：React 18 + Vite + TypeScript (单页应用 SPA)
- **状态管理**：Zustand (管理嵌套的节点树和撤销重做栈，轻量高效)
- **视图与画布**：
  - **外围 UI**：Tailwind CSS (构建侧边栏、属性面板、树状层级)
  - **核心画布**：PixiJS + @pixi/react (原生支持九宫格，100% 还原游戏引擎渲染，自定义实现 Transformer 选中框)
- **唯一标识**：`uuid` (为每一个节点和分享链接生成唯一 ID)
- **图集打包**：引入前端的 MaxRects 或自定义拼图算法进行 Texture Packing。
- **后端支持 (后续)**：需要保存分享链接时，可接入 Firebase Firestore 来做无服务器数据存储。

## 4. 开发任务规划 (Development Phases)

### P0: 核心基础设施与数据状态 (Core Infrastructure & State) - â 当前进行中
- [x] 定义 JSON 树核心数据结构 (`src/types.ts`：节点、Sprite、NineSlice)。
- [x] 搭建 Zustand 状态管理 (`store.ts`：增删改查节点、选中状态)。
- [x] 构建基础 UI 框架 (Header、左侧层级树、右侧属性面板、中间工作区)。
- [x] 接入 `@pixi/react` 初始化主画布 (Stage & Canvas)，打通 Zustand 数据到渲染引擎的单向数据流。

### P1: 画布交互与变换控制 (Canvas Interactivity & Transform) - â 当前进行中
- [x] 实现画布的平移 (Pan) 和缩放 (Zoom)。
- [x] 实现画布上的节点点选、框选逻辑。 (已实现点选)
- [x] 实现 PixiJS 环境下的自定义 Transformer (选中框：支持拖拽位移、控制柄缩放、旋转)。 (已实现拖拽与单向缩放)
- [x] 右侧属性面板双向绑定 (修改数字直接更新画布，画布拖拽实时更新数字)。

### P2: 资源管理、九宫格与图集打包 (Assets, 9-Slice & Atlas) - â 当前进行中
- [x] 实现本地图片上传与资源库 (Asset Library) 管理。
- [x] 从资源库拖拽/点击生成 Sprite 节点。
- [x] 九宫格 (NineSlicePlane) 支持：可视化调节 `left, right, top, bottom` 边距。
- [x] 集成 MaxRects/自定义 算法，实现图集 (Atlas) 的打包计算。
- [x] 导出功能：一键生成 `JSON` 描述文件 + 拼接好的大图 `PNG`。

### P3: 高级功能与 AI 协同 (Advanced & AI Integration) - ✅ 已完成
- [x] 撤销与重做 (Undo / Redo 历史记录栈)。
- [x] 左侧树状面板支持拖拽排序与父子节点嵌套。
- [x] 生成公开分享链接，提供标准的 GET 接口供 AI 读取结构化 UI 数据。
- [x] 快捷键支持与右键菜单。(已支持 Ctrl+Z, Ctrl+Y, Delete, Ctrl+C, Ctrl+V)
