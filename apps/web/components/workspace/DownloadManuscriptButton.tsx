"use client";

import { useState } from "react";
import { downloadManuscript } from "@/lib/api-client";
import { describeError } from "@/lib/api-errors";

type DownloadManuscriptButtonProps = {
  manuscriptId: string;
  className: string;
  label?: string;
};

/* Downloads the current version of the manuscript as a Word file (GET /manuscripts/{id}/download). */
export function DownloadManuscriptButton({
  manuscriptId,
  className,
  label = "تنزيل ملف Word",
}: DownloadManuscriptButtonProps) {
  const [state, setState] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null });

  const download = () => {
    if (state.busy) return;
    setState({ busy: true, error: null });
    downloadManuscript(manuscriptId).then(
      ({ blob, filename }) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        setState({ busy: false, error: null });
      },
      (error: unknown) => setState({ busy: false, error: describeError(error).title }),
    );
  };

  return (
    <span className="inline-flex items-center gap-3">
      <button type="button" onClick={download} disabled={state.busy} className={className}>
        {state.busy ? "نجهّز الملف…" : label}
      </button>
      {state.error && (
        <span role="alert" className="text-[13px] font-semibold text-terracotta-text">
          ✕ {state.error}
        </span>
      )}
    </span>
  );
}
