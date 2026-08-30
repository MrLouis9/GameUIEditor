---
name: game-ui-editor
description: Develops the GameUIEditer monorepo (PixiJS canvas, document JSON, atlas packing, Figma-like UI editing). Use when working on GameUIEditer, sprite atlas, document schema, Pixi editor canvas, share/export JSON, or AI Studio UI pipelines.
---

# GameUIEditer Development

## Product intent

Artists compose game UI like Figma. The deliverable is **document JSON** (plus atlas), analogous to:

`Document → Export API JSON → AI analysis → React/Vue/HTML or Pixi scene`

Not HTML scraping. Preview pages are optional; JSON is authoritative.

## Stack reminder

- Canvas: **PixiJS v8**
- Shell: React + Zustand
- Atlas: `packages/atlas`
- Document: `packages/document`

## Design sizes

| Preset | Size |
|--------|------|
| Landscape default | 1280×720 |
| Portrait | 720×1280 |
| Ultra-wide adaptive | width up to 21:9 on 720 height → 1680×720 |
| Portrait tall adaptive | height up to 21:9 on 720 width → 720×1560 |

## When adding features

1. Extend document schema + commands first
2. Sync Pixi renderer
3. Wire React panels
4. Cover undo/redo
5. Keep export JSON fields stable

## Atlases

- Document has `atlases[]` + `activeAtlasId`; each `Asset` has `atlasId`
- Resource panel: create / rename / switch / delete atlases; edit asset name, image, nine-slice, move atlas
- Drag asset onto canvas via `ASSET_DRAG_MIME` → place sprite at drop point
- Atlas pack panel packs **active atlas only**

## Phase map

- **P0**: atlas package extract, document schema, monorepo ✅
- **P1**: Pixi editor — layers, transform, nine-slice, undo, copy/paste, group/lock, local export ✅
- **P2**: share / preview + AI handoff package (JSON/assets/tokens/interactions/naming) ✅; intranet share API still open; multi-page polish open
- **P3**: public deploy / auth ❌
- **P4**: *(roadmap)* runtime SDK — partial: handoff tokens/naming/interactions for AI codegen ✅
## Key paths

- `packages/atlas` — packer, nine-slice meta, atlas JSON
- `packages/document` — types, factory, commands, history, serialize
- `apps/editor` — UI + Pixi stage
- `docs/document-schema.md` — AI/export contract

## Anti-patterns

- Mutating document nodes inside React event handlers without commands
- Duplicating packer logic outside `packages/atlas`
- Baking camera zoom into node `transform`
