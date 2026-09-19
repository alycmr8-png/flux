/**
 * The lecture being recorded right now, shared across the app. The class screen
 * that owns the recording publishes its state here; the tab bar shows a floating
 * bar from it on every other screen, and uses it to pause, resume or jump back.
 */
import { useSyncExternalStore } from "react";

export type RecordingSession = {
  course: { id: string; name: string; color?: string | null };
  status: "recording" | "paused" | "saved";
  seconds: number;
  /** That class's Record tab is what's on screen — no floating bar needed. */
  onScreen: boolean;
} | null;

let session: RecordingSession = null;
const listeners = new Set<() => void>();
let controls: { pause?: () => void; resume?: () => void } = {};
const openListeners = new Set<(courseId: string) => void>();

export const recordingSession = {
  get: () => session,
  set(next: RecordingSession) {
    session = next;
    listeners.forEach(l => l());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
  setControls(next: typeof controls) { controls = next; },
  pause: () => controls.pause?.(),
  resume: () => controls.resume?.(),
  /** Bring the recording's class back on screen, on its Record tab. */
  requestOpen(courseId: string) { openListeners.forEach(l => l(courseId)); },
  onOpen(listener: (courseId: string) => void) {
    openListeners.add(listener);
    return () => { openListeners.delete(listener); };
  },
};

export function useRecordingSession() {
  return useSyncExternalStore(recordingSession.subscribe, recordingSession.get, recordingSession.get);
}
