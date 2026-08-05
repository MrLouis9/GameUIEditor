import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

type ModalSize = 'md' | 'lg' | 'xl';

/** Full-viewport centered dialog (portaled to body). */
export function Modal({
  title,
  children,
  onClose,
  wide,
  size,
  footer,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  /** @deprecated use size="lg" */
  wide?: boolean;
  size?: ModalSize;
  footer?: React.ReactNode;
}) {
  const resolved: ModalSize = size ?? (wide ? 'lg' : 'md');
  const widthClass =
    resolved === 'xl'
      ? 'max-w-6xl max-h-[min(92vh,900px)]'
      : resolved === 'lg'
        ? 'max-w-3xl max-h-[min(90vh,820px)]'
        : 'max-w-md max-h-[min(90vh,820px)]';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/65 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`flex w-full flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl ${widthClass}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
          <button
            type="button"
            title="关闭"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">{children}</div>
        {footer && (
          <div className="shrink-0 border-t border-slate-800 px-4 py-3">{footer}</div>
        )}
      </div>
    </div>,
    document.body
  );
}
