import type { ReactNode } from "react";

type IconProps = { className?: string };

function Svg({ className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 ${className ?? ""}`}
    >
      {children}
    </svg>
  );
}

/* تراجع */
export function UndoIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
    </Svg>
  );
}

/* العودة إلى الأصل */
export function RestoreIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l3 2" />
    </Svg>
  );
}

/* تغيير المجلة */
export function SwapIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M17 3l4 4-4 4" />
      <path d="M21 7H8" />
      <path d="M7 21l-4-4 4-4" />
      <path d="M3 17h13" />
    </Svg>
  );
}

/* Continue */
export function ArrowForwardIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M19 12H5" />
      <path d="M11 6l-6 6 6 6" />
    </Svg>
  );
}

/* عرض البحث */
export function EyeIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </Svg>
  );
}

/* تنزيل ملف Word */
export function DownloadIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M5 21h14" />
    </Svg>
  );
}

/* تنزيل LaTeX */
export function CodeIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M8 7l-5 5 5 5" />
      <path d="M16 7l5 5-5 5" />
    </Svg>
  );
}

/* انتقل إلى النص */
export function LocateIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </Svg>
  );
}

/* عرض المصدر */
export function SourceIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M2 5.5C4.5 4 8 4 12 6c4-2 7.5-2 10-.5V19c-2.5-1.5-6-1.5-10 .5-4-2-7.5-2-10-.5Z" />
      <path d="M12 6v13.5" />
    </Svg>
  );
}