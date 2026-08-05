import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export type DarkSelectOption = { value: string; label: string };

export function DarkSelect({
  value,
  options,
  disabled,
  onChange,
  className = '',
  buttonClassName = '',
  size = 'sm',
}: {
  value: string;
  options: DarkSelectOption[];
  disabled?: boolean;
  onChange: (v: string) => void;
  className?: string;
  buttonClassName?: string;
  size?: 'sm' | 'md';
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((o) => o.value === value) ?? options[0];
  const textSize = size === 'md' ? 'text-xs' : 'text-[11px]';

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative min-w-0 ${className}`}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full min-w-0 items-center gap-1 rounded-md bg-transparent text-left text-white outline-none hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-40 ${textSize} ${buttonClassName}`}
      >
        <span className="min-w-0 flex-1 truncate">{selected?.label ?? value}</span>
        <ChevronDown
          className={`h-3 w-3 shrink-0 text-slate-500 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && !disabled && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 z-50 mt-1 max-h-52 overflow-auto rounded-md border border-slate-700 bg-slate-900 py-1 shadow-xl shadow-black/40"
        >
          {options.map((o) => {
            const active = o.value === value;
            return (
              <li key={o.value} role="option" aria-selected={active}>
                <button
                  type="button"
                  className={`flex w-full px-2.5 py-1.5 text-left ${textSize} ${
                    active
                      ? 'bg-sky-600 text-white'
                      : 'text-slate-200 hover:bg-slate-800'
                  }`}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                >
                  {o.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
