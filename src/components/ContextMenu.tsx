// ============================================================================
// Owlivion Mail - Context Menu (Right-Click)
// ============================================================================

import { useState, useEffect, useRef, useCallback } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  danger?: boolean;
  divider?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  items: ContextMenuItem[];
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useContextMenu() {
  const [menu, setMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0, items: [] });

  const show = useCallback((e: React.MouseEvent, items: ContextMenuItem[]) => {
    e.preventDefault();
    e.stopPropagation();

    // Position: keep menu within viewport
    const x = Math.min(e.clientX, window.innerWidth - 220);
    const y = Math.min(e.clientY, window.innerHeight - items.length * 36 - 16);

    setMenu({ visible: true, x, y, items });
  }, []);

  const hide = useCallback(() => {
    setMenu(prev => ({ ...prev, visible: false }));
  }, []);

  return { menu, show, hide };
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ContextMenu({ menu, onClose }: { menu: ContextMenuState; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside or Escape
  useEffect(() => {
    if (!menu.visible) return;

    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleScroll = () => onClose();

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [menu.visible, onClose]);

  if (!menu.visible) return null;

  return (
    <div
      ref={ref}
      className="fixed z-[999] min-w-[200px] py-1.5 bg-owl-surface border border-owl-border/60 rounded-xl shadow-2xl backdrop-blur-sm"
      style={{ left: menu.x, top: menu.y }}
    >
      {menu.items.map((item, i) => {
        if (item.divider) {
          return <div key={`div-${i}`} className="my-1 border-t border-owl-border/40" />;
        }
        return (
          <button
            key={item.id}
            onClick={() => { item.onClick(); onClose(); }}
            disabled={item.disabled}
            className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-[13px] transition-colors ${
              item.disabled
                ? 'text-owl-text-secondary/30 cursor-not-allowed'
                : item.danger
                ? 'text-owl-text hover:bg-red-500/10 hover:text-red-400'
                : 'text-owl-text hover:bg-owl-accent/10 hover:text-owl-accent'
            }`}
          >
            {item.icon && <span className="w-4 h-4 flex items-center justify-center opacity-60">{item.icon}</span>}
            <span className="flex-1 text-left">{item.label}</span>
            {item.shortcut && (
              <span className="text-[11px] text-owl-text-secondary/40 ml-4">{item.shortcut}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
