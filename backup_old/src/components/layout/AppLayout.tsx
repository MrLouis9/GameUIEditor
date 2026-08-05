import React, { useEffect } from 'react';
import LeftSidebar from './LeftSidebar';
import RightSidebar from './RightSidebar';
import EditorCanvas from '../canvas/EditorCanvas';
import { exportAtlas, exportSceneJson, shareScene } from '../../utils/exportUtils';
import { useEditorStore } from '../../store/useEditorStore';

const AppLayout: React.FC = () => {
  const { undo, redo, removeNode, selectedNodeIds } = useEditorStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Focus within input fields should not trigger canvas shortcuts
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        const state = useEditorStore.getState();
        if (state.selectedNodeIds.length > 0) {
          const toCopy = state.nodes[state.selectedNodeIds[0]];
          if (toCopy) {
            localStorage.setItem('editor_clipboard', JSON.stringify(toCopy));
          }
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        const clipboard = localStorage.getItem('editor_clipboard');
        if (clipboard) {
          try {
            const parsed = JSON.parse(clipboard);
            const { id, parentId, children, ...rest } = parsed;
            // offset slightly
            rest.x += 10;
            rest.y += 10;
            rest.name = rest.name + " (Copy)";
            useEditorStore.getState().addNode(rest, parentId);
          } catch (e) {
            console.error(e);
          }
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        e.preventDefault();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        redo();
        e.preventDefault();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        const selected = useEditorStore.getState().selectedNodeIds;
        selected.forEach(id => removeNode(id));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex flex-col h-screen w-full bg-gray-900 text-gray-100 overflow-hidden font-sans">
      {/* Header */}
      <header className="h-12 border-b border-gray-800 bg-gray-950 flex items-center px-4 shrink-0">
        <h1 className="text-sm font-semibold tracking-wide">Game UI Editor</h1>
        <div className="ml-auto flex gap-2">
          <button 
            className="text-xs bg-gray-800 hover:bg-gray-700 text-white px-3 py-1 rounded border border-gray-700 transition-colors"
            onClick={exportAtlas}
          >
            Export Atlas (PNG+JSON)
          </button>
          <button 
            className="text-xs bg-gray-800 hover:bg-gray-700 text-white px-3 py-1 rounded border border-gray-700 transition-colors"
            onClick={exportSceneJson}
          >
            Export JSON
          </button>
          <button 
            className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded transition-colors shadow-sm"
            onClick={shareScene}
          >
            Share/Export UI Tree (API)
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Sidebar (Layers & Assets) */}
        <LeftSidebar />

        {/* Center Canvas */}
        <section className="flex-1 bg-gray-950 relative overflow-hidden flex flex-col">
          <div className="absolute top-2 left-2 z-10 flex gap-2">
             <div className="bg-gray-800 rounded px-2 py-1 text-xs text-gray-400 border border-gray-700 shadow-sm pointer-events-none">Canvas</div>
          </div>
          <EditorCanvas />
        </section>

        {/* Right Sidebar (Properties/Inspector) */}
        <RightSidebar />
      </main>
    </div>
  );
};

export default AppLayout;
