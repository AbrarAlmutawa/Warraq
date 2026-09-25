type WorkspaceToastProps = {
  text: string;
  detail?: string;
  onUndo: () => void;
  onClose: () => void;
};

/* Visual toast; announcements go through the shell's persistent aria-live region. */
export function WorkspaceToast({ text, detail, onUndo, onClose }: WorkspaceToastProps) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-30 flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-4 rounded-[4px] bg-ink px-5 py-3 text-paper">
        <span aria-hidden="true" className="font-bold text-terracotta">
          ✓
        </span>
        <div className="flex flex-col">
          <span className="text-[13.5px] font-semibold">{text}</span>
          {detail && <span className="text-xs text-stone">{detail}</span>}
        </div>
        <button
          type="button"
          onClick={onUndo}
          className="h-8 rounded-[3px] border border-stone/60 px-3 text-[13px] hover:border-paper"
        >
          تراجع
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="إغلاق الإشعار"
          className="size-8 text-lg text-stone hover:text-paper"
        >
          ×
        </button>
      </div>
    </div>
  );
}