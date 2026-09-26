/**
 * What the file pickers accept, kept next to nothing else so the three inputs on the
 * record page can't drift apart from each other or from the API.
 *
 * Must stay in step with ATTACHABLE in packages/api/src/routes/lectures.ts and
 * ACCEPTED in routes/photos.ts — a picker that offers a type the server rejects puts
 * the refusal after the upload, which is the worst place for it.
 */
export const ACCEPT_ATTR = [
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain", "text/markdown", "text/csv",
  // Some browsers match the picker on extension rather than reported MIME type.
  ".pdf", ".pptx", ".docx", ".txt", ".md", ".csv",
].join(",");

/**
 * True for a file to show as a document card rather than a thumbnail. Anything the
 * server accepted that isn't an image is a document, so the image test is the whole
 * rule — no extension list to keep in step.
 */
export function isDocumentFile(file: { type: string }): boolean {
  return !file.type.startsWith("image/");
}

/** A short type label for a document card: "PDF", "PPTX", … */
export function fileKindLabel(name: string): string {
  const ext = /\.([A-Za-z0-9]+)$/.exec(name)?.[1] ?? "";
  return ext ? ext.toUpperCase() : "FILE";
}
