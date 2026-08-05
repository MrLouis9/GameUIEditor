import { MaxRectsPacker } from 'maxrects-packer';
import { useEditorStore } from '../store/useEditorStore';

export const exportAtlas = async () => {
  const { assets } = useEditorStore.getState();
  const assetList = Object.values(assets);
  
  if (assetList.length === 0) {
    alert("No assets to pack!");
    return;
  }

  // 1. Pack rects
  const packer = new MaxRectsPacker(2048, 2048, 2, { smart: true, pot: false });
  const rects = assetList.map(asset => ({
    width: asset.width,
    height: asset.height,
    data: asset,
  }));
  
  packer.addArray(rects);
  
  const bin = packer.bins[0];
  if (!bin) {
    alert("Failed to pack assets.");
    return;
  }

  // 2. Draw to canvas
  const canvas = document.createElement('canvas');
  canvas.width = bin.width;
  canvas.height = bin.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const atlasJson: any = {
    frames: {},
    meta: {
      image: "atlas.png",
      size: { w: bin.width, h: bin.height },
      scale: 1,
    }
  };

  // 3. Load images and draw them onto the atlas canvas
  const drawPromises = bin.rects.map((rect: any) => {
    return new Promise<void>((resolve) => {
      const asset = rect.data;
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, rect.x, rect.y, rect.width, rect.height);
        
        // Add to JSON
        atlasJson.frames[asset.name] = {
          frame: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
          rotated: false,
          trimmed: false,
          spriteSourceSize: { x: 0, y: 0, w: rect.width, h: rect.height },
          sourceSize: { w: rect.width, h: rect.height }
        };
        resolve();
      };
      img.src = asset.url;
    });
  });

  await Promise.all(drawPromises);

  // 4. Download files
  const dataUrl = canvas.toDataURL('image/png');
  downloadFile(dataUrl, 'atlas.png');
  
  const jsonStr = JSON.stringify(atlasJson, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  downloadFile(URL.createObjectURL(blob), 'atlas.json');
};

export const shareScene = async () => {
  const { nodes, rootNodes } = useEditorStore.getState();
  
  const buildTree = (nodeId: string): any => {
    const node = nodes[nodeId];
    return {
      ...node,
      children: node.children.map(buildTree)
    };
  };

  const sceneTree = rootNodes.map(buildTree);

  try {
    const response = await fetch('/api/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sceneTree)
    });
    
    if (response.ok) {
      const data = await response.json();
      const shareUrl = `${window.location.origin}${data.url}`;
      alert(`Shared successfully! URL: ${shareUrl}\n\nThis provides a standard GET API for AI to read structured UI data.`);
    } else {
      alert("Failed to share.");
    }
  } catch (error) {
    console.error("Share error:", error);
    alert("Failed to share scene.");
  }
};
export const exportSceneJson = () => {
  const { nodes, rootNodes } = useEditorStore.getState();
  
  // Transform to a neat tree for the game engine
  const buildTree = (nodeId: string): any => {
    const node = nodes[nodeId];
    return {
      ...node,
      children: node.children.map(buildTree)
    };
  };

  const sceneTree = rootNodes.map(buildTree);
  const jsonStr = JSON.stringify(sceneTree, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  downloadFile(URL.createObjectURL(blob), 'scene.json');
};

const downloadFile = (url: string, filename: string) => {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};
