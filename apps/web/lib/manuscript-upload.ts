import { uploadManuscript, type ApiManuscriptUploadResponse } from "@/lib/api-client";
import { clearSession, startSession } from "@/lib/session";

/*
 * Hands a manuscript upload from the upload screen to /analysis.
 *
 * The request starts as soon as the researcher confirms the file, and the in-flight promise
 * is kept here (in memory, for this browser tab) so that:
 *  - /analysis shows the real request while it runs, then its real result;
 *  - React's development StrictMode (effects run twice) never uploads the file twice;
 *  - the same File can be retried if the request fails.
 *
 * Starting an upload starts a new journey: the previous session in this tab is cleared
 * immediately, so a reload during or after a failed upload can never resume a different
 * manuscript than the one just chosen. On success this is the only place that starts the
 * new session.
 *
 * A full page reload clears this module: /analysis then recovers from the session
 * (GET /manuscripts/{id}) or shows the recovery path. It never invents a result.
 */

export class SessionUnavailableError extends Error {
  constructor() {
    super("The browser did not allow Warraq to store the session (sessionStorage).");
    this.name = "SessionUnavailableError";
  }
}

export type ActiveUpload = {
  id: number;
  file: File;
  isDemoManuscript: boolean;
  promise: Promise<ApiManuscriptUploadResponse>;
};

let active: ActiveUpload | null = null;
let nextId = 1;

async function runUpload(file: File, isDemoManuscript: boolean): Promise<ApiManuscriptUploadResponse> {
  const response = await uploadManuscript(file);
  const session = startSession({
    manuscriptId: response.manuscript_id,
    file: { name: file.name, sizeBytes: file.size },
    isDemoManuscript,
  });
  if (!session) throw new SessionUnavailableError();
  return response;
}

/* Starts a new upload and makes it the active one (replacing any earlier upload in this tab). */
export function startManuscriptUpload(file: File, options: { isDemoManuscript: boolean }): ActiveUpload {
  // A new upload is a new journey: never let a reload fall back to the previous manuscript.
  clearSession();
  const promise = runUpload(file, options.isDemoManuscript);
  // Failures are handled by whoever reads the active upload; this only prevents an
  // "unhandled rejection" warning if nobody is listening at that exact moment.
  promise.catch(() => undefined);
  active = { id: nextId++, file, isDemoManuscript: options.isDemoManuscript, promise };
  return active;
}

export function getActiveUpload(): ActiveUpload | null {
  return active;
}

/* Uploads the same File again (after a failure). Returns null when there is nothing to retry. */
export function retryActiveUpload(): ActiveUpload | null {
  if (!active) return null;
  return startManuscriptUpload(active.file, { isDemoManuscript: active.isDemoManuscript });
}

export function clearActiveUpload(): void {
  active = null;
}