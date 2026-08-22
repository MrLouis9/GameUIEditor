# Document Export Schema (AI / Runtime Contract)

`schemaVersion: 7`

## Screen Prefab (recommended for other projects)

单界面「Prefab」：布局 + 语义 + 图集引用，**不含**切图像素。图集用编辑器底部「保存图集」另行导出，文件名与 Prefab 内 `atlases[].file/meta` 一致。

```
{root}.prefab.gameui.json   # kind: "gameui.prefab"
{atlasName}.png             # 另存
{atlasName}.json
```

| 字段 | 含义 |
|------|------|
| `kind` | 固定 `"gameui.prefab"`（与完整项目 `.gameui.json` 区分） |
| `page` | 当前 Root 节点树（权威布局） |
| `assets[]` | `id` / `name` / `atlasId` / `frame` / `nineSlice`（无 `dataUrl`） |
| `atlases[]` | `file` = `{name}.png`，`meta` = `{name}.json` |
| `resolve` | 运行时查图规则（勿自创） |

**运行时查图（避免误差）：**

1. 节点 `type: "sprite"` → `assetId`（或 `stateAssets[activeState]`）
2. 在 `assets[]` 找到该 id → 取 `frame`、`atlasId`
3. 打开对应 `atlases[].meta` → `frames[frame]` 取 UV；贴图为 `atlases[].file`

**稳定约定：**

- 不要改 `asset.id` / 节点上的 `assetId` / `assets[].frame` 对应关系
- `frame` 与「保存图集」打出的 JSON 帧名算法一致（同名资源在同一图集内会加 `_2` 后缀）
- 改布局可直接改 Prefab JSON，再在编辑器「导入 Prefab」往返继续改
- 设计尺寸以 Prefab 的 `designSize` + `page.root.transform` 为准

编辑器：交接弹窗 →「导出界面 Prefab」/「导入 Prefab」；工具栏「打开」也能识别 Prefab。

## Handoff package (AI zip)

仅导出**当前活动页 Root**。图集按**原图集分别打包**（用到几份导出几份，文件名与图集名一致）；未使用的图集不导出。适合一次性交给实现方（含图集）。

```
{name}-{root}-ai-handoff/
  README.md
  document.gameui.json
  preview.html
  {atlasName}.png          # 每份用到的原图集
  {atlasName}.json
```

不导出：tokens / interactions 独立文件、naming、ACCEPTANCE、散切图、未使用图集；也不会把多份图集合打成一张。


## Node common

`transform`, `pivot`, `scaleX/Y`, `fill`, `fillOpacity`, `clipContent`, `layout`, `constraints`, optional `children`

### Transform & pivot (v6)

| Field | Meaning for AI / runtime |
|-------|---------------------------|
| `transform.x` / `y` | Top-left of the **unscaled** local box in parent space |
| `transform.width` / `height` | Unscaled layout size (px) |
| `transform.rotation` | Degrees, applied around `pivot` |
| `scaleX` / `scaleY` | Extra scale, applied around `pivot` |
| `pivot` | Normalized `{ x, y }` in **0–1** (default `{ x: 0.5, y: 0.5 }` = center) |

Matrix (same as Pixi / CSS): `T(x+px, y+py) · R · S · T(-px, -py)` where `px = pivot.x * width`, `py = pivot.y * height`.

Toolbar align and constraints operate on the **visual AABB** after pivot/scale/rotation.

### Constraints (v5, Figma-style)

Relative to **parent** size change (artboard when parent is page root):

| horizontal | behavior |
|------------|----------|
| `left` | keep x |
| `right` | keep right margin |
| `center` | keep offset from parent center |
| `left-right` | keep left + right → stretch width |
| `scale` | scale x & width with parent |

| vertical | behavior |
|----------|----------|
| `top` | keep y |
| `bottom` | keep bottom margin |
| `center` | keep offset from parent center |
| `top-bottom` | keep top + bottom → stretch height |
| `scale` | scale y & height with parent |

Toolbar align = edit-time `x/y` nudge. Property panel constraints = follow contract (JSON + editor when parent/design size changes).

Default: `{ horizontal: "left", vertical: "top" }`.

### Semantics

`role`, `componentKey`, `states`, `activeState`, `binding`, `locKey`, `notes`

### Sprite state art (v7) — toggle / tab

On `type: "sprite"`:

| Field | Meaning |
|-------|---------|
| `assetId` | Fallback / default art |
| `stateAssets` | `{ normal?: assetId, selected?: assetId, ... }` per `NodeUiState` |
| `activeState` | Which art is shown; also the logical UI state |

**Toggle (`role: "toggle"`)**  
- `stateAssets.normal` = 关闭图  
- `stateAssets.selected` = 打开图  
- Flip `activeState` between `normal` ↔ `selected`

**Tab (`role: "tab"`)**  
- `stateAssets.normal` = 未选中图  
- `stateAssets.selected` = 选中图  
- Several siblings with `role: "tab"` under the same parent: setting one to `selected` clears others (editor + runtime contract)

Resolved draw asset: `stateAssets[activeState] ?? stateAssets.normal ?? assetId`

### Text shadow (v7)

On `type: "text"`, optional `shadow`:

```json
"shadow": {
  "enabled": true,
  "color": "#000000",
  "alpha": 0.55,
  "blur": 4,
  "offsetX": 2,
  "offsetY": 2
}
```

### AutoLayout

`mode: none | horizontal | vertical | grid`, `gap`, `padding`, `columns`, `rows`, `primaryAlign`, `counterAlign`

## Document

`atlases`, `assets`, `pages`, `interactions[]`

## Naming prefixes

`btn_` `input_` `tog_` `list_` `item_` `scroll_` `txt_` `img_` `pnl_` `icon_` `bar_` `val_` `tab_` `ui_`
