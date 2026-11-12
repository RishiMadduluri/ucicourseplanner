import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Accessible modal / drawer.
 *
 * Traps focus, restores it on close, closes on Escape, and labels itself so
 * keyboard-only use is complete (05 — Accessibility).
 *
 * Rendered through a portal into `document.body`, deliberately. The Scenarios,
 * External credit, Settings, and Export/Import dialogs are all opened from
 * components that live inside `<header class="topbar">`, and the top bar sets
 * `color: #fff` plus translucent-white `button`/`select` styling for its own
 * controls. Rendered in place, a dialog inherited all of that and drew white
 * text and near-invisible buttons on its white surface. The top bar also sets
 * `overflow-x: auto`, which made every open dialog widen the header's scroll
 * area. A modal is not part of the toolbar, so it should not be a descendant of
 * one — portalling fixes the whole class of problem rather than patching the
 * four selectors that happen to leak today.
 */

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  variant?: 'modal' | 'drawer';
  labelledBy?: string;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), details, summary, [tabindex]:not([tabindex="-1"])';

export function Dialog({ open, onClose, title, children, footer, variant = 'modal' }: DialogProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const titleId = `dialog-title-${title.replace(/\W+/g, '-').toLowerCase()}`;

  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;

    const node = containerRef.current;
    const first = node?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !node) return;

      const focusable = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (focusable.length === 0) return;

      const firstEl = focusable[0]!;
      const lastEl = focusable[focusable.length - 1]!;

      if (event.shiftKey && document.activeElement === firstEl) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && document.activeElement === lastEl) {
        event.preventDefault();
        firstEl.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      restoreFocusRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className={variant === 'drawer' ? 'drawer-backdrop' : 'modal-backdrop'}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={variant === 'drawer' ? 'drawer' : 'modal'}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={containerRef}
      >
        <header>
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="subtle icon" onClick={onClose} aria-label={`Close ${title}`}>
            ✕
          </button>
        </header>
        <div className={variant === 'drawer' ? 'drawer-body' : 'modal-body'}>{children}</div>
        {footer ? <footer>{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}
