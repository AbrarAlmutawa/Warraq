"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { describeError } from "@/lib/api-errors";
import { loadDemoManuscriptFile } from "@/lib/demo-manuscript";
import { startManuscriptUpload } from "@/lib/manuscript-upload";

/*
 * "Try a demo paper": uploads the real demo DOCX through the same POST /manuscripts/upload
 * pipeline as any file, marked isDemoManuscript so every later screen can label it.
 */
export function DemoManuscriptButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const file = await loadDemoManuscriptFile();
      startManuscriptUpload(file, { isDemoManuscript: true });
      router.push("/analysis");
    } catch (caught) {
      setError(describeError(caught).title);
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={start}
        disabled={busy}
        aria-busy={busy}
        className="font-bold underline underline-offset-4 hover:text-terracotta-text disabled:cursor-wait disabled:opacity-60"
      >
        {busy ? "نجهّز البحث التجريبي…" : "جرّب ببحث تجريبي"}
      </button>
      {error && (
        <span role="alert" className="ms-2 text-[13px] font-semibold text-terracotta-text">
          ✕ {error}
        </span>
      )}
    </>
  );
}