/*
 * The labelled "try a demo paper" action.
 *
 * The demo paper is a byte-identical copy of apps/api/tests/fixtures/warraq_demo_manuscript.docx,
 * served as a static file. It is uploaded through exactly the same POST /manuscripts/upload
 * pipeline as any researcher's file: nothing here injects parsed or mock data.
 */

export const DEMO_MANUSCRIPT_URL = "/demo/warraq-demo-manuscript.docx";
export const DEMO_MANUSCRIPT_FILE_NAME = "warraq_demo_manuscript.docx";

const DOCX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export class DemoManuscriptUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DemoManuscriptUnavailableError";
  }
}

/* Loads the demo DOCX from this app's static files as a File, ready for the normal upload. */
export async function loadDemoManuscriptFile(): Promise<File> {
  let response: Response;
  try {
    response = await fetch(DEMO_MANUSCRIPT_URL, { cache: "no-store" });
  } catch {
    throw new DemoManuscriptUnavailableError(`Could not load ${DEMO_MANUSCRIPT_URL}.`);
  }
  if (!response.ok) {
    throw new DemoManuscriptUnavailableError(`${DEMO_MANUSCRIPT_URL} returned HTTP ${response.status}.`);
  }
  const blob = await response.blob();
  if (blob.size === 0) {
    throw new DemoManuscriptUnavailableError(`${DEMO_MANUSCRIPT_URL} is empty.`);
  }
  return new File([blob], DEMO_MANUSCRIPT_FILE_NAME, { type: DOCX_MIME_TYPE });
}