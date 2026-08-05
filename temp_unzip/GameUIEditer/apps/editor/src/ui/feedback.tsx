import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

type ToastKind = 'info' | 'success' | 'error' | 'warn';

type ToastItem = {
  id: string;
  message: string;
  kind: ToastKind;
};

type ConfirmState = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  resolve: (ok: boolean) => void;
} | null;

type PromptState = {
  title: string;
  message?: string;
  defaultValue: string;
  resolve: (value: string | null) => void;
} | null;

type FeedbackState = {
  toasts: ToastItem[];
  confirm: ConfirmState;
  prompt: PromptState;
  pushToast: (message: string, kind?: ToastKind) => void;
  dismissToast: (id: string) => void;
  openConfirm: (opts: Omit<NonNullable<ConfirmState>, 'resolve'>) => Promise<boolean>;
  openPrompt: (opts: Omit<NonNullable<PromptState>, 'resolve'>) => Promise<string | null>;
};

let toastSeq = 0;

export const useFeedbackStore = create<FeedbackState>((set, get) => ({
  toasts: [],
  confirm: null,
  prompt: null,
  pushToast: (message, kind = 'info') => {
    const id = `t${++toastSeq}`;
    set((s) => ({ toasts: [...s.toasts, { id, message, kind }] }));
    window.setTimeout(() => get().dismissToast(id), 3200);
  },
  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  openConfirm: (opts) =>
    new Promise<boolean>((resolve) => {
      set({
        confirm: {
          ...opts,
          resolve: (ok) => {
            set({ confirm: null });
            resolve(ok);
          },
        },
      });
    }),
  openPrompt: (opts) =>
    new Promise<string | null>((resolve) => {
      set({
        prompt: {
          ...opts,
          resolve: (value) => {
            set({ prompt: null });
            resolve(value);
          },
        },
      });
    }),
}));

export function toast(message: string, kind: ToastKind = 'info'): void {
  useFeedbackStore.getState().pushToast(message, kind);
}

export function confirmDialog(opts: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}): Promise<boolean> {
  return useFeedbackStore.getState().openConfirm(opts);
}

export function promptDialog(opts: {
  title: string;
  message?: string;
  defaultValue?: string;
}): Promise<string | null> {
  return useFeedbackStore.getState().openPrompt({
    title: opts.title,
    message: opts.message,
    defaultValue: opts.defaultValue ?? '',
  });
}

/** Mount once under App — toasts + confirm/prompt dialogs. */
export function FeedbackHost() {
  const toasts = useFeedbackStore((s) => s.toasts);
  const confirm = useFeedbackStore((s) => s.confirm);
  const prompt = useFeedbackStore((s) => s.prompt);
  const dismissToast = useFeedbackStore((s) => s.dismissToast);

  return createPortal(
    <>
      <div className="pointer-events-none fixed bottom-4 right-4 z-[300] flex w-80 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2 text-[12px] shadow-lg ${
              t.kind === 'error'
                ? 'border-red-800 bg-red-950 text-red-100'
                : t.kind === 'warn'
                  ? 'border-amber-800 bg-amber-950 text-amber-100'
                  : t.kind === 'success'
                    ? 'border-emerald-800 bg-emerald-950 text-emerald-100'
                    : 'border-slate-700 bg-slate-900 text-slate-200'
            }`}
          >
            <span className="min-w-0 flex-1 leading-relaxed">{t.message}</span>
            <button
              type="button"
              className="shrink-0 text-current/60 hover:text-current"
              onClick={() => dismissToast(t.id)}
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>

      {confirm && (
        <DialogShell
          title={confirm.title}
          onClose={() => confirm.resolve(false)}
          footer={
            <>
              <button
                type="button"
                className="rounded border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                onClick={() => confirm.resolve(false)}
              >
                {confirm.cancelLabel ?? '取消'}
              </button>
              <button
                type="button"
                className={`rounded px-3 py-1.5 text-xs font-medium text-white ${
                  confirm.danger
                    ? 'bg-red-600 hover:bg-red-500'
                    : 'bg-sky-600 hover:bg-sky-500'
                }`}
                onClick={() => confirm.resolve(true)}
              >
                {confirm.confirmLabel ?? '确定'}
              </button>
            </>
          }
        >
          <p className="text-[13px] leading-relaxed text-slate-300">{confirm.message}</p>
        </DialogShell>
      )}

      {prompt && (
        <PromptDialog state={prompt} />
      )}
    </>,
    document.body
  );
}

function DialogShell({
  title,
  children,
  footer,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  footer: React.ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[280] flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-800 px-4 py-3 text-sm font-semibold text-slate-100">
          {title}
        </div>
        <div className="px-4 py-3">{children}</div>
        <div className="flex justify-end gap-2 border-t border-slate-800 px-4 py-3">
          {footer}
        </div>
      </div>
    </div>
  );
}

function PromptDialog({ state }: { state: NonNullable<PromptState> }) {
  const [value, setValue] = useState(state.defaultValue);

  return (
    <DialogShell
      title={state.title}
      onClose={() => state.resolve(null)}
      footer={
        <>
          <button
            type="button"
            className="rounded border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
            onClick={() => state.resolve(null)}
          >
            取消
          </button>
          <button
            type="button"
            className="rounded bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-500"
            onClick={() => state.resolve(value.trim() || null)}
          >
            确定
          </button>
        </>
      }
    >
      {state.message && (
        <p className="mb-2 text-[12px] text-slate-400">{state.message}</p>
      )}
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') state.resolve(value.trim() || null);
        }}
        className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-[13px] text-white outline-none focus:ring-1 focus:ring-sky-500/50"
      />
    </DialogShell>
  );
}
