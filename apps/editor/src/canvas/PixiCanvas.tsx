import { useEffect, useRef, useState } from 'react';
import {
  ASSET_DRAG_MIME,
  decodeAssetDragPayload,
  findNodeInDocument,
} from '@game-ui/document';
import {
  getTransformDraft,
  setTransformDraftListener,
  useEditorStore,
} from '../store/editorStore';
import { EditorStage } from './EditorStage';
import { toast } from '../ui/feedback';

export function PixiCanvas() {
  const hostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<EditorStage | null>(null);
  const document = useEditorStore((s) => s.document);
  const camera = useEditorStore((s) => s.camera);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const [dragOver, setDragOver] = useState(false);

  const placeOrReplaceAsset = (
    assetId: string,
    artboardPos: { x: number; y: number },
    hitSpriteId: string | null,
    hitIconHostId: string | null = null
  ) => {
    const state = useEditorStore.getState();
    const asset = state.document.assets.find((a) => a.id === assetId);
    if (!asset) return;

    // Drop onto an existing sprite → replace art for current preview state
    if (hitSpriteId) {
      const found = findNodeInDocument(state.document, hitSpriteId);
      if (found?.node.type === 'sprite' && !found.node.locked) {
        const preview = found.node.activeState || 'normal';
        state.setSpriteAsset(hitSpriteId, assetId);
        state.select([hitSpriteId]);
        toast(
          preview !== 'normal'
            ? `已替换「${preview}」贴图：${asset.name}`
            : `已替换精灵：${asset.name}`,
          'success'
        );
        return;
      }
    }

    // Drop onto frame / rect / group → set icon background
    if (hitIconHostId) {
      const found = findNodeInDocument(state.document, hitIconHostId);
      if (
        found &&
        !found.node.locked &&
        (found.node.type === 'frame' ||
          found.node.type === 'group' ||
          found.node.type === 'rect')
      ) {
        state.setNodeIconAsset(hitIconHostId, assetId);
        state.select([hitIconHostId]);
        toast(`已设置图标精灵：${asset.name}`, 'success');
        return;
      }
    }

    // Drop onto empty / non-sprite → create new sprite
    const design = state.document.designSize;
    let x = Math.round(artboardPos.x - asset.width / 2);
    let y = Math.round(artboardPos.y - asset.height / 2);
    x = Math.max(-asset.width + 8, Math.min(design.width - 8, x));
    y = Math.max(-asset.height + 8, Math.min(design.height - 8, y));
    state.addSprite(assetId, { x, y });
  };

  const getDocumentForRender = () =>
    getTransformDraft() ?? useEditorStore.getState().document;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const stage = new EditorStage({
      onSelect: (ids, additive) => useEditorStore.getState().select(ids, additive),
      onSelectRange: (id) => useEditorStore.getState().selectRange(id),
      onPromoteSelection: (id) => useEditorStore.getState().promoteSelection(id),
      onTransformLive: (id, transform) =>
        useEditorStore.getState().setTransform(id, transform, false),
      onTransformsLive: (patches) =>
        useEditorStore.getState().setTransformsLive(patches),
      onTransformEnd: () => useEditorStore.getState().flushTransform(),
      getTool: () => useEditorStore.getState().tool,
      getSelectedIds: () => useEditorStore.getState().selectedIds,
      getDocument: () => useEditorStore.getState().document,
      getDocumentForRender,
      onAssetDrop: (assetId, pos, hitSpriteId, hitIconHostId) =>
        placeOrReplaceAsset(assetId, pos, hitSpriteId, hitIconHostId ?? null),
      onCameraChange: (cam) => useEditorStore.getState().setCamera(cam),
    });
    stageRef.current = stage;

    setTransformDraftListener((patches) => {
      stage.patchNodeTransforms(patches);
      stage.scheduleSelectionRedraw();
    });

    let cancelled = false;
    (async () => {
      await stage.mount(host);
      if (cancelled) {
        stage.destroy();
        return;
      }
      stage.setCamera(useEditorStore.getState().camera);
      await stage.syncDocument(useEditorStore.getState().document);
    })();

    return () => {
      cancelled = true;
      setTransformDraftListener(null);
      stage.destroy();
      stageRef.current = null;
    };
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.setCamera(camera);
  }, [camera]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    void stage.syncDocument(document);
  }, [document]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.scheduleSelectionRedraw();
  }, [selectedIds]);

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragOver(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget === e.target) setDragOver(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const raw =
      e.dataTransfer.getData(ASSET_DRAG_MIME) ||
      e.dataTransfer.getData('text/plain') ||
      e.dataTransfer.getData('text');
    const assetId =
      decodeAssetDragPayload(raw) ?? (raw?.startsWith('asset_') ? raw : null);
    if (!assetId) return;

    const stage = stageRef.current;
    if (stage?.dropAssetAtClient(assetId, e.clientX, e.clientY)) return;
    placeOrReplaceAsset(assetId, { x: 40, y: 40 }, null);
  };

  return (
    <div
      ref={hostRef}
      className={`relative h-full w-full overflow-hidden bg-[#0b0e14] ${
        dragOver ? 'ring-2 ring-inset ring-sky-500/80' : ''
      }`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    />
  );
}
