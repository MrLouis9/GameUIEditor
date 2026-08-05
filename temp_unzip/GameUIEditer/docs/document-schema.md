# Document Export Schema (AI / Runtime Contract)

`schemaVersion: 7`

## Handoff package (recommended)

仅导出**当前活动页 Root**。图集按**原图集分别打包**（用到几份导出几份，文件名与图集名一致）；未使用的图集不导出。

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

`btn_` `input_` `tog_` `list_` `item_` `scroll_` `txt_` `img_` `pnl_` `icon_` `bar_` `tab_` `ui_`
