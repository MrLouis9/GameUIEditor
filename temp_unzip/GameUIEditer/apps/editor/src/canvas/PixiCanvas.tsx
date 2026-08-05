import { useEffect, useRef, useState } from 'react';
import {
  ASSET_DRAG_MIME,
  decodeAssetDragPayload,
} from '@game-ui/document';
import { useEditorStore } from '../store/editorStore';
import { EditorStage } from './EditorStage';

export function PixiCanvas() {
  const hostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<EditorStage | null>(null);
  const document = useEditorStore((s) => s.document);
  const camera = useEditorStore((s) => s.camera);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const [dragOver, setDragOver] = useState(false);

  const placeAsset = (assetId: string, artboardPos: { x: number; y: number }) => {
    const asset = useEditorStore
      .getState()
      .document.assets.find((a) => a.id === assetId);
    if (!asset) return;

    const design = useEditorStore.getState().document.designSize;
    let x = Math.round(artboardPos.x - asset.width / 2);
    let y = Math.round(artboardPos.y - asset.height / 2);
    // Keep mostly on artboard so it is visible after drop
    x = Math.max(-asset.width + 8, Math.min(design.width - 8, x));
    y = Math.max(-asset.height + 8, Math.min(design.height - 8, y));

    useEditorStore.getState().addSprite(assetId, { x, y });
  };

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
      onAssetDrop: (assetId, pos) => placeAsset(assetId, pos),
      onCameraChange: (cam) => useEditorStore.getState().setCamera(cam),
    });
    stageRef.current = stage;

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
    stage.drawSelection(document);
  }, [selectedIds, document]);

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
    const assetId = decodeAssetDragPayload(raw) ?? (raw?.startsWith('asset_') ? raw : null);
    if (!assetId) return;

    const stage = stageRef.current;
    const pos = stage?.clientToArtboard(e.clientX, e.clientY) ?? { x: 40, y: 40 };
    placeAsset(assetId, pos);
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
