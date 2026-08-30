import type { Document, SceneNode } from '@game-ui/document';
import {
  getActivePage,
  findNodeInDocument,
  getNodeAncestorIds,
  encodeLayerDragPayload,
  decodeLayerDragPayload,
  LAYER_DRAG_MIME,
} from '@game-ui/document';
import {
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Frame,
  Lock,
  Package,
  Plus,
  Square,
  Trash2,
  Type,
  Unlock,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditorStore } from '../store/editorStore';
import { confirmDialog, toast } from '../ui/feedback';
import { AiHandoffModal } from './AiHandoffModal';

type DropMode = 'before' | 'after' | 'inside' | null;

/** Default: every page / interface root starts collapsed. */
function buildDefaultCollapsedIds(doc: Document): Set<string> {
  return new Set(doc.pages.map((p) => p.root.id));
}

export function LayerPanel() {
  const document = useEditorStore((s) => s.document);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const select = useEditorStore((s) => s.select);
  const selectRange = useEditorStore((s) => s.selectRange);
  const promoteSelection = useEditorStore((s) => s.promoteSelection);
  const renameNode = useEditorStore((s) => s.renameNode);
  const setLocked = useEditorStore((s) => s.setLocked);
  const setVisible = useEditorStore((s) => s.setVisible);
  const moveLayers = useEditorStore((s) => s.moveLayers);
  const addFrame = useEditorStore((s) => s.addFrame);
  const addText = useEditorStore((s) => s.addText);
  const addRect = useEditorStore((s) => s.addRect);
  const addPage = useEditorStore((s) => s.addPage);
  const setActivePage = useEditorStore((s) => s.setActivePage);
  const deletePage = useEditorStore((s) => s.deletePage);
  const persist = useEditorStore((s) => s.persist);

  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dropMode, setDropMode] = useState<DropMode>(null);
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  /** Ids whose children are collapsed. */
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() =>
    buildDefaultCollapsedIds(document)
  );
  const listRef = useRef<HTMLDivElement>(null);
  const pagesSignature = document.pages.map((p) => p.id).join('\0');
  const pagesSignatureRef = useRef(pagesSignature);

  const activePage = getActivePage(document);
  const pages = document.pages;

  // New project / import / page add-remove → collapse all page roots again.
  useEffect(() => {
    if (pagesSignatureRef.current === pagesSignature) return;
    pagesSignatureRef.current = pagesSignature;
    setCollapsedIds(buildDefaultCollapsedIds(document));
  }, [pagesSignature, document]);

  const toggleCollapsed = useCallback((id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Canvas selection → expand ancestors and scroll layer row into view
  const primaryId = selectedIds[0] ?? null;
  useEffect(() => {
    if (!primaryId) return;
    const doc = useEditorStore.getState().document;
    const found = findNodeInDocument(doc, primaryId);
    if (!found) return;

    const active = getActivePage(doc);
    if (found.page.id !== active?.id) {
      setActivePage(found.page.id);
    }

    const ancestors = getNodeAncestorIds(found.page.root, primaryId);
    if (ancestors.length) {
      setCollapsedIds((prev) => {
        let changed = false;
        const next = new Set(prev);
        for (const id of ancestors) {
          if (next.delete(id)) changed = true;
        }
        return changed ? next : prev;
      });
    }

    let cancelled = false;
    const scrollToRow = () => {
      if (cancelled || !listRef.current) return;
      const safe =
        typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
          ? CSS.escape(primaryId)
          : primaryId.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const el = listRef.current.querySelector(`[data-layer-id="${safe}"]`);
      if (el instanceof HTMLElement) {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    };
    // Two frames: wait for expand state commit + child rows to mount
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(scrollToRow);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [primaryId, setActivePage]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-900/80">
      {handoffOpen && (
        <AiHandoffModal onClose={() => setHandoffOpen(false)} />
      )}
      <div className="border-b border-slate-800 px-3 py-2">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400">
          <span>图层</span>
          <div className="flex gap-1 normal-case">
            <TinyBtn title="创建 Frame (F)" onClick={addFrame}>
              <Frame size={12} />
            </TinyBtn>
            <TinyBtn title="创建文本 (T)" onClick={addText}>
              <Type size={12} />
            </TinyBtn>
            <TinyBtn title="创建矩形 (R)" onClick={addRect}>
              <Square size={12} />
            </TinyBtn>
            <TinyBtn title="新建界面 Root" onClick={addPage}>
              <Plus size={12} />
            </TinyBtn>
          </div>
        </div>
        <p className="mt-1 text-[10px] leading-snug text-slate-600">
          + 新建界面 · Ctrl 多选 · Shift 范围 · 拖拽排序/嵌套
        </p>
      </div>
      <div ref={listRef} className="flex-1 overflow-auto p-1 text-sm">
        {pages.map((page) => (
          <LayerRow
            key={page.id}
            node={page.root}
            depth={0}
            selectedIds={selectedIds}
            onSelect={select}
            onSelectRange={selectRange}
            onPromote={promoteSelection}
            isRoot
            isActiveRoot={page.id === activePage?.id}
            editingId={editingId}
            setEditingId={setEditingId}
            onRename={(id, name) => renameNode(id, name)}
            onToggleLock={(id, locked) => {
              select([id]);
              setLocked(locked);
            }}
            onToggleVisible={(id, visible) => {
              select([id]);
              setVisible(visible);
            }}
            dragOverId={dragOverId}
            dropMode={dropMode}
            onDragOverRow={(id, mode) => {
              setDragOverId(id);
              setDropMode(mode);
            }}
            onDragLeaveRow={() => {
              setDragOverId(null);
              setDropMode(null);
            }}
            onDropRow={(_targetId, _mode) => {
              setDragOverId(null);
              setDropMode(null);
            }}
            moveLayers={moveLayers}
            collapsedIds={collapsedIds}
            onToggleCollapsed={toggleCollapsed}
            onActivateRoot={() => {
              if (page.id !== activePage?.id) setActivePage(page.id);
            }}
            onOpenHandoff={
              page.id === activePage?.id
                ? () => {
                    persist();
                    setHandoffOpen(true);
                  }
                : undefined
            }
            onDeletePage={
              pages.length > 1
                ? async () => {
                    const ok = await confirmDialog({
                      title: '删掉此界面',
                      message: `确定删除「${page.root.name || page.name}」？此操作可通过撤销找回。`,
                      confirmLabel: '删除',
                      danger: true,
                    });
                    if (!ok) return;
                    if (deletePage(page.id)) {
                      toast(`已删除界面：${page.root.name || page.name}`, 'success');
                    } else {
                      toast('至少需要保留一个界面', 'warn');
                    }
                  }
                : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}

function LayerRow({
  node,
  depth,
  selectedIds,
  onSelect,
  onSelectRange,
  onPromote,
  isRoot,
  isActiveRoot,
  editingId,
  setEditingId,
  onRename,
  onToggleLock,
  onToggleVisible,
  dragOverId,
  dropMode,
  onDragOverRow,
  onDragLeaveRow,
  onDropRow,
  moveLayers,
  collapsedIds,
  onToggleCollapsed,
  onActivateRoot,
  onOpenHandoff,
  onDeletePage,
}: {
  node: SceneNode;
  depth: number;
  selectedIds: string[];
  onSelect: (ids: string[], additive?: boolean) => void;
  onSelectRange: (targetId: string) => void;
  onPromote: (id: string) => void;
  isRoot?: boolean;
  /** Whether this page Root is the document's active page. */
  isActiveRoot?: boolean;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  onRename: (id: string, name: string) => void;
  onToggleLock: (id: string, locked: boolean) => void;
  onToggleVisible: (id: string, visible: boolean) => void;
  dragOverId: string | null;
  dropMode: DropMode;
  onDragOverRow: (id: string, mode: DropMode) => void;
  onDragLeaveRow: () => void;
  onDropRow: (targetId: string, mode: DropMode) => void;
  moveLayers: (
    nodeIds: string[],
    targetId: string,
    mode: 'before' | 'after' | 'inside'
  ) => void;
  collapsedIds: Set<string>;
  onToggleCollapsed: (id: string) => void;
  onActivateRoot?: () => void;
  onOpenHandoff?: () => void;
  onDeletePage?: () => void | Promise<void>;
}) {
  const open = !collapsedIds.has(node.id);
  const selected = selectedIds.includes(node.id);
  const hasChildren = !!node.children?.length;
  const children = node.children ?? [];
  const isOver = dragOverId === node.id;
  const editing = editingId === node.id;
  const inputRef = useRef<HTMLInputElement>(null);
  const [draftName, setDraftName] = useState(node.name);

  useEffect(() => {
    if (editing) {
      setDraftName(node.name);
      requestAnimationFrame(() => inputRef.current?.select());
    }
  }, [editing, node.name]);

  const commitRename = () => {
    const next = draftName.trim();
    setEditingId(null);
    if (next && next !== node.name) onRename(node.id, next);
  };

  const resolveMode = (e: React.DragEvent): DropMode => {
    if (isRoot) return 'inside';
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = e.clientY - rect.top;
    const ratio = y / rect.height;
    if (ratio < 0.25) return 'before';
    if (ratio > 0.75) return 'after';
    return 'inside';
  };

  const showIcons = !node.visible || node.locked;

  return (
    <div>
      <div
        data-layer-id={node.id}
        draggable={!isRoot && !node.locked && !editing}
        onDragStart={(e) => {
          if (isRoot || editing) return;
          const pageRoot = getActivePage(
            useEditorStore.getState().document
          )?.root.id;
          const ids =
            selectedIds.includes(node.id) && selectedIds.length > 1
              ? selectedIds.filter((id) => id !== pageRoot)
              : [node.id];
          const payload = encodeLayerDragPayload(ids);
          e.dataTransfer.setData(LAYER_DRAG_MIME, payload);
          e.dataTransfer.setData('text/plain', payload);
          e.dataTransfer.effectAllowed = 'move';
          if (!selectedIds.includes(node.id)) {
            onSelect([node.id]);
          } else if (selectedIds[0] !== node.id) {
            onPromote(node.id);
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = 'move';
          onDragOverRow(node.id, resolveMode(e));
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) onDragLeaveRow();
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const raw =
            e.dataTransfer.getData(LAYER_DRAG_MIME) ||
            e.dataTransfer.getData('text/plain');
          const fromIds = decodeLayerDragPayload(raw);
          const mode = resolveMode(e);
          onDragLeaveRow();
          if (!fromIds.length || !mode) return;
          if (fromIds.length === 1 && fromIds[0] === node.id) return;
          if (fromIds.includes(node.id) && mode === 'inside') return;
          moveLayers(fromIds, node.id, mode);
          onDropRow(node.id, mode);
        }}
        className={`group relative flex cursor-pointer items-center gap-1 rounded px-1 py-1 hover:bg-slate-800 ${
          selected ? 'bg-sky-950/60 text-sky-200' : 'text-slate-300'
        } ${
          isRoot && isActiveRoot === false ? 'opacity-70' : ''
        } ${!node.visible ? 'opacity-50' : ''} ${
          isRoot ? '' : 'cursor-grab active:cursor-grabbing'
        }`}
        style={{ paddingLeft: 4 + depth * 12 }}
        onClick={(e) => {
          if (editing) return;
          e.stopPropagation();
          if (isRoot) onActivateRoot?.();
          if (e.shiftKey) {
            onSelectRange(node.id);
            return;
          }
          if (e.ctrlKey || e.metaKey) {
            onSelect([node.id], true);
            return;
          }
          if (selected && selectedIds.length > 1) {
            onPromote(node.id);
            return;
          }
          onSelect([node.id], false);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (isRoot) onActivateRoot?.();
          onSelect([node.id]);
          setEditingId(node.id);
        }}
      >
        {isOver && dropMode === 'before' && (
          <div className="absolute left-1 right-1 top-0 h-0.5 bg-emerald-400" />
        )}
        {isOver && dropMode === 'after' && (
          <div className="absolute bottom-0 left-1 right-1 h-0.5 bg-emerald-400" />
        )}
        {isOver && dropMode === 'inside' && (
          <div className="pointer-events-none absolute inset-0 rounded ring-1 ring-emerald-400/80" />
        )}

        <button
          type="button"
          className="relative z-10 w-4 shrink-0 text-slate-500 hover:text-slate-300"
          aria-expanded={open}
          aria-label={open ? '收起子图层' : '展开子图层'}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (hasChildren) onToggleCollapsed(node.id);
          }}
        >
          {hasChildren ? (
            open ? (
              <ChevronDown size={12} />
            ) : (
              <ChevronRight size={12} />
            )
          ) : (
            <span className="inline-block w-3" />
          )}
        </button>

        {editing ? (
          <input
            ref={inputRef}
            value={draftName}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') {
                setDraftName(node.name);
                setEditingId(null);
              }
            }}
            className="min-w-0 flex-1 rounded bg-slate-950 px-1 text-xs text-white outline-none ring-1 ring-sky-500"
          />
        ) : (
          <span className="min-w-0 flex-1 truncate text-xs">
            <TypeBadge node={node} /> {node.name}
            {isRoot && isActiveRoot === false && (
              <span className="ml-1 text-[10px] text-slate-600">未激活</span>
            )}
          </span>
        )}

        {isRoot && onOpenHandoff && (
          <button
            type="button"
            title="AI 交接包"
            className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] text-sky-400 hover:bg-slate-700"
            onClick={(e) => {
              e.stopPropagation();
              onOpenHandoff();
            }}
          >
            <Package size={11} />
            交接
          </button>
        )}

        {isRoot && onDeletePage && (
          <button
            type="button"
            title="删掉此界面"
            className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] text-rose-400 hover:bg-rose-950/50"
            onClick={(e) => {
              e.stopPropagation();
              void onDeletePage();
            }}
          >
            <Trash2 size={11} />
            删除
          </button>
        )}

        {!isRoot && (
          <span
            className={`flex gap-0.5 ${
              showIcons ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}
          >
            <button
              type="button"
              className={
                node.visible
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-amber-400 hover:text-amber-300'
              }
              title={node.visible ? '隐藏' : '已隐藏 · 点击显示'}
              onClick={(e) => {
                e.stopPropagation();
                onToggleVisible(node.id, !node.visible);
              }}
            >
              {node.visible ? <Eye size={12} /> : <EyeOff size={12} />}
            </button>
            <button
              type="button"
              className={
                node.locked
                  ? 'text-amber-400 hover:text-amber-300'
                  : 'text-slate-400 hover:text-slate-200'
              }
              title={node.locked ? '已锁定 · 点击解锁' : '锁定'}
              onClick={(e) => {
                e.stopPropagation();
                onToggleLock(node.id, !node.locked);
              }}
            >
              {node.locked ? <Lock size={12} /> : <Unlock size={12} />}
            </button>
          </span>
        )}
      </div>
      {open &&
        children.map((child) => (
          <LayerRow
            key={child.id}
            node={child}
            depth={depth + 1}
            selectedIds={selectedIds}
            onSelect={onSelect}
            onSelectRange={onSelectRange}
            onPromote={onPromote}
            editingId={editingId}
            setEditingId={setEditingId}
            onRename={onRename}
            onToggleLock={onToggleLock}
            onToggleVisible={onToggleVisible}
            dragOverId={dragOverId}
            dropMode={dropMode}
            onDragOverRow={onDragOverRow}
            onDragLeaveRow={onDragLeaveRow}
            onDropRow={onDropRow}
            moveLayers={moveLayers}
            collapsedIds={collapsedIds}
            onToggleCollapsed={onToggleCollapsed}
          />
        ))}
    </div>
  );
}

function TypeBadge({ node }: { node: SceneNode }) {
  const mode = node.layout?.mode ?? 'none';
  const title =
    node.type === 'frame' || node.type === 'group'
      ? mode === 'horizontal'
        ? '横向 Auto Layout'
        : mode === 'vertical'
          ? '纵向 Auto Layout'
          : mode === 'grid'
            ? '网格 Auto Layout'
            : node.type === 'frame'
              ? 'Frame'
              : 'Group'
      : node.type;

  return (
    <span
      title={title}
      className="mr-1 inline-flex h-4 w-4 shrink-0 items-center justify-center text-slate-400"
    >
      {node.type === 'text' ? (
        <span className="text-[11px] font-semibold leading-none">T</span>
      ) : node.type === 'sprite' ? (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
          <rect x="1.5" y="2" width="9" height="8" rx="1" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="4.2" cy="4.5" r="0.9" fill="currentColor" />
          <path d="M2.5 9 L5 6.5 L7 8 L9.5 5.5 L10.5 9" stroke="currentColor" strokeWidth="1" />
        </svg>
      ) : node.type === 'rect' ? (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
          <rect x="2" y="2.5" width="8" height="7" rx="1" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      ) : mode === 'horizontal' ? (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
          <rect x="1.5" y="3" width="2.2" height="6" rx="0.5" fill="currentColor" />
          <rect x="4.9" y="3" width="2.2" height="6" rx="0.5" fill="currentColor" />
          <rect x="8.3" y="3" width="2.2" height="6" rx="0.5" fill="currentColor" />
        </svg>
      ) : mode === 'vertical' ? (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
          <rect x="2.5" y="1.5" width="7" height="2.2" rx="0.5" fill="currentColor" />
          <rect x="2.5" y="4.9" width="7" height="2.2" rx="0.5" fill="currentColor" />
          <rect x="2.5" y="8.3" width="7" height="2.2" rx="0.5" fill="currentColor" />
        </svg>
      ) : mode === 'grid' ? (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
          <rect x="1.5" y="1.5" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1" />
          <rect x="6.5" y="1.5" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1" />
          <rect x="1.5" y="6.5" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1" />
          <rect x="6.5" y="6.5" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1" />
        </svg>
      ) : node.type === 'group' ? (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
          <path
            d="M2 3.5h3l1 1H10v5H2V3.5z"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <span className="text-[11px] font-semibold leading-none">#</span>
      )}
    </span>
  );
}

function TinyBtn({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="inline-flex items-center rounded px-1 text-[10px] text-slate-400 hover:bg-slate-800 hover:text-slate-200"
    >
      {children}
    </button>
  );
}
