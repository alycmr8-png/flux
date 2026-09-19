import fs from "fs";
import path from "path";

/**
 * Where lecture audio and class photos are written.
 *
 * These files have to outlive the process: a citation in Ask plays the original
 * recording months later, so the audio is the source of truth, not a cache.
 * The default therefore sits next to the API rather than in the OS temp
 * directory — macOS purges /var/folders on reboot and under disk pressure, which
 * silently emptied every recording made before the purge.
 *
 * In production UPLOAD_DIR must point at a mounted volume; a container's own
 * filesystem is replaced on every deploy.
 */
export const uploadDir = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.resolve(__dirname, "../../uploads");

/** Created on boot so the first upload of a fresh checkout doesn't fail. */
export function ensureUploadDir(): string {
  fs.mkdirSync(uploadDir, { recursive: true });
  return uploadDir;
}

/**
 * The readable path for a stored file, or null when it is gone.
 *
 * Older rows hold an absolute path from whatever directory was in use when they
 * were recorded, so fall back to the current upload directory by basename before
 * giving up.
 */
export function resolveStoredPath(stored: string): string | null {
  if (fs.existsSync(stored)) return stored;
  const relocated = path.join(uploadDir, path.basename(stored));
  return fs.existsSync(relocated) ? relocated : null;
}
