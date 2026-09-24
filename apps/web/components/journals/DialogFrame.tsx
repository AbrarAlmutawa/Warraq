"use client";

import { useEffect, useRef, type ReactNode } from "react";

type DialogFrameProps = {
  open: boolean;
  onClose: () => void;
  titleId: string;
  title: string;
  widthClass?: string;
  children: ReactNode;
};

/* Native <dialog>: focus trap, Escape and inert background come from the browser. */
export function DialogFrame({
  open,
  onClose,
  titleId,
  title,
  widthClass = "max-w-[560px]",
  children,
}: DialogFrameProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) dialogRef.current?.close();
      }}
      className={`m-auto w-[calc(100%-2rem)] ${widthClass} border border-ink bg-paper p-0 text-ink backdrop:bg-ink/45`}
    >
      <div className="flex max-h-[85dvh] flex-col">
        <div className="flex items-center justify-between gap-4 border-b border-rule px-6 py-4">
          <h2 id={titleId} className="text-lg font-bold">
            {title}
          </h2>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="h-9 shrink-0 rounded-[3px] border border-rule-strong px-3 text-[13px] hover:border-ink"
          >
            إغلاق
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </dialog>
  );
}