import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
export function ActionDialog({
  title,
  children,
  onClose,
  busy = false,
  alert = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
  alert?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    titleId = useId();
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return createPortal(
    <dialog
      ref={ref}
      className="action-dialog"
      aria-labelledby={titleId}
      aria-modal="true"
      role={alert ? "alertdialog" : "dialog"}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <h2 id={titleId}>{title}</h2>
      {children}
    </dialog>,
    document.body,
  );
}
