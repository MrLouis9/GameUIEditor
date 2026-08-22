export type PanelLayoutState = {
  leftWidth: number;
  rightWidth: number;
  bottomHeight: number;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  bottomCollapsed: boolean;
};

const STORAGE_KEY = 'game-ui-editer:panel-layout:v1';

export const PANEL_DEFAULTS: PanelLayoutState = {
  leftWidth: 240,
  rightWidth: 280,
  bottomHeight: 176,
  leftCollapsed: false,
  rightCollapsed: false,
  bottomCollapsed: false,
};

/** Below this while dragging → collapse */
export const PANEL_COLLAPSE = {
  left: 108,
  right: 120,
  bottom: 64,
} as const;

export const PANEL_MIN = {
  left: 160,
  right: 200,
  bottom: 100,
} as const;

export const PANEL_MAX = {
  left: 480,
  right: 520,
  bottom: 420,
} as const;

/** Collapsed rail / dock header strip */
export const PANEL_COLLAPSED_SIZE = {
  left: 28,
  right: 28,
  bottom: 36,
} as const;

export function loadPanelLayout(): PanelLayoutState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...PANEL_DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<PanelLayoutState>;
    return {
      leftWidth: clamp(
        Number(parsed.leftWidth) || PANEL_DEFAULTS.leftWidth,
        PANEL_MIN.left,
        PANEL_MAX.left
      ),
      rightWidth: clamp(
        Number(parsed.rightWidth) || PANEL_DEFAULTS.rightWidth,
        PANEL_MIN.right,
        PANEL_MAX.right
      ),
      bottomHeight: clamp(
        Number(parsed.bottomHeight) || PANEL_DEFAULTS.bottomHeight,
        PANEL_MIN.bottom,
        PANEL_MAX.bottom
      ),
      leftCollapsed: !!parsed.leftCollapsed,
      rightCollapsed: !!parsed.rightCollapsed,
      bottomCollapsed: !!parsed.bottomCollapsed,
    };
  } catch {
    return { ...PANEL_DEFAULTS };
  }
}

export function savePanelLayout(state: PanelLayoutState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota */
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function clampLeftWidth(w: number): number {
  return clamp(w, PANEL_MIN.left, PANEL_MAX.left);
}

export function clampRightWidth(w: number): number {
  return clamp(w, PANEL_MIN.right, PANEL_MAX.right);
}

export function clampBottomHeight(h: number): number {
  return clamp(h, PANEL_MIN.bottom, PANEL_MAX.bottom);
}
