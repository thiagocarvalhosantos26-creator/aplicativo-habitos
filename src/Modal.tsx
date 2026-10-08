import { useLayoutEffect, useRef, type ReactNode } from "react";

export function Modal({
  titleId,
  onClose,
  children,
}: {
  titleId: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const dialog = ref.current!;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    dialog.showModal();
    dialog.querySelector<HTMLElement>("[data-initial-focus]")?.focus();
    return () => {
      dialog.close();
      // React may remove the trigger in the same commit (ending a session).
      // Restore after that commit, without stealing focus from a new dialog.
      queueMicrotask(() => {
        if (document.querySelector("dialog[open]")) return;
        const target =
          previous?.isConnected &&
          previous !== document.body &&
          previous !== document.documentElement
            ? previous
            : document.querySelector<HTMLElement>("[data-focus-fallback]");
        target?.focus();
      });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="card modal"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onKeyDown={(e) => {
        if (e.key !== "Tab") return;
        const controls = [
          ...e.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),[tabindex="0"]',
          ),
        ];
        const first = controls[0],
          last = controls.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }}
    >
      {children}
    </dialog>
  );
}
