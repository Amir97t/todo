import { useEffect, useRef } from "react";

const FOCUSABLE = [
  "button:not([disabled])",
  "input:not([disabled])",
  "textarea:not([disabled])",
  "select:not([disabled])",
  "a[href]",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

function focusableIn(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll(FOCUSABLE));
}

/**
 * Focus management for modal surfaces: move focus in on open, keep Tab inside,
 * close on Escape and hand focus back to whatever opened it.
 *
 * The opener is captured from the DOM rather than passed in, and is only
 * restored while it is still attached — the element that opened a dialog can
 * disappear before the dialog closes.
 */
export default function useDialogFocus({
  open,
  dialogRef,
  initialFocusRef,
  onEscape,
  trapFocus = true,
  lockScroll = false,
}) {
  // Held in a ref so a fresh inline arrow each render never re-runs the
  // effect, which would steal focus back to the start of the dialog.
  const escapeRef = useRef(onEscape);

  useEffect(() => {
    escapeRef.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    if (!open) return undefined;

    const opener = document.activeElement;
    const previousOverflow = document.body.style.overflow;

    if (lockScroll) {
      document.body.style.overflow = "hidden";
    }

    // Focus after commit, never during render. Refs are attached before
    // effects run, so the synchronous pass usually wins; the frame covers
    // surfaces that animate their contents into place afterwards.
    const focusInto = () => {
      const target =
        initialFocusRef?.current ?? focusableIn(dialogRef.current)[0];
      if (target) target.focus();
    };

    focusInto();
    const frame = requestAnimationFrame(focusInto);

    return () => {
      cancelAnimationFrame(frame);

      if (lockScroll) {
        document.body.style.overflow = previousOverflow;
      }

      if (opener instanceof HTMLElement && document.contains(opener)) {
        opener.focus();
      }
    };
    // The refs are stable objects; only `open` should re-run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lockScroll]);

  function handleKeyDown(event) {
    if (event.key === "Escape") {
      if (event.defaultPrevented) return;

      const close = escapeRef.current;
      if (!close) return;

      event.preventDefault();
      close();
      return;
    }

    if (event.key !== "Tab" || !trapFocus) return;

    const focusable = focusableIn(dialogRef.current);
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return { handleKeyDown };
}
