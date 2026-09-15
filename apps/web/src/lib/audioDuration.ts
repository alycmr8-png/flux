// Chrome's MediaRecorder writes WebM files without a duration. The <audio>
// element then reports `Infinity`, so its progress bar can't move or seek.

/**
 * Makes an already-loaded element work out its real duration. Seeking past the
 * end forces the browser to scan the file; once it knows the length we return
 * to where playback was. Resolves immediately when the duration is already known.
 */
export function ensureFiniteDuration(el: HTMLAudioElement): Promise<void> {
  return new Promise((resolve) => {
    if (Number.isFinite(el.duration) && el.duration > 0) return resolve();
    const resumeAt = el.currentTime;
    const done = () => {
      if (!Number.isFinite(el.duration)) return;
      el.removeEventListener("durationchange", done);
      el.removeEventListener("timeupdate", done);
      el.currentTime = resumeAt;
      resolve();
    };
    el.addEventListener("durationchange", done);
    el.addEventListener("timeupdate", done);
    el.currentTime = 1e101;
  });
}
