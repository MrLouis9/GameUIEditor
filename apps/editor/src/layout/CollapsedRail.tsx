import { ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react';

type Props = {
  side: 'left' | 'right' | 'bottom';
  label: string;
  onExpand: () => void;
};

/** Thin strip shown when a panel is collapsed; click to restore. */
export function CollapsedRail({ side, label, onExpand }: Props) {
  if (side === 'bottom') {
    return (
      <button
        type="button"
        onClick={onExpand}
        title={`展开${label}`}
        className="flex h-9 w-full shrink-0 items-center justify-center gap-1.5 border-t border-slate-800 bg-slate-900/95 text-[11px] text-slate-400 hover:bg-slate-800 hover:text-sky-300"
      >
        <ChevronUp size={14} />
        {label}
      </button>
    );
  }

  const Icon = side === 'left' ? ChevronRight : ChevronLeft;
  return (
    <button
      type="button"
      onClick={onExpand}
      title={`展开${label}`}
      className={`flex w-7 shrink-0 flex-col items-center justify-center gap-2 border-slate-800 bg-slate-900/95 py-3 text-[10px] text-slate-500 hover:bg-slate-800 hover:text-sky-300 ${
        side === 'left' ? 'border-r' : 'border-l'
      }`}
    >
      <Icon size={14} />
      <span
        className="select-none tracking-wider"
        style={{ writingMode: 'vertical-rl' }}
      >
        {label}
      </span>
    </button>
  );
}
