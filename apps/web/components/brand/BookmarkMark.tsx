type BookmarkMarkProps = {
  className?: string;
};

/* The bookmark motif from the identity — a decorative accent, not the logo. */
export function BookmarkMark({ className = "h-[60px] w-[18px] text-terracotta" }: BookmarkMarkProps) {
  return (
    <svg viewBox="0 0 18 60" aria-hidden="true" focusable="false" className={className}>
      <path d="M2 2 H16 V58 L9 48 L2 58 Z" fill="currentColor" />
    </svg>
  );
}