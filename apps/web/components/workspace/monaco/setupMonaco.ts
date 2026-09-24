import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";

let configured = false;

/*
 * Makes @monaco-editor/react use the Monaco bundled with this app
 * instead of loading it from jsDelivr, and serves the editor worker locally.
 * Browser-only: called from a module that is loaded with ssr: false.
 */
export function setupLocalMonaco(): void {
  if (configured || typeof window === "undefined") return;

  self.MonacoEnvironment = {
    // The workspace uses plain text only, so every request gets the core editor worker.
    getWorker() {
      return new Worker(new URL("./editor.worker.ts", import.meta.url));
    },
  };

  loader.config({ monaco });
  configured = true;
}