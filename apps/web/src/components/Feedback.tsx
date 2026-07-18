"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────
type ToastKind = "success" | "error" | "info";
type Toast = { id: number; kind: ToastKind; message: string; leaving?: boolean };

type ConfirmOpts = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};
type ConfirmState = ConfirmOpts & { id: number; resolve: (ok: boolean) => void };

type FeedbackCtx = {
  toast: (message: string, kind?: ToastKind) => void;
  confirm: (opts: ConfirmOpts) => Promise<boolean>;
};

const Ctx = createContext<FeedbackCtx | null>(null);

const KIND = {
  success: { icon: CheckCircle2, color: "#22c55e", glow: "rgba(34,197,94,0.18)" },
  error:   { icon: AlertCircle,  color: "#ef4444", glow: "rgba(239,68,68,0.18)" },
  info:    { icon: Info,         color: "#6E7FF3", glow: "rgba(110,127,243,0.18)" },
} as const;

// ── Provider ─────────────────────────────────────────────────────────────────
export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dialog, setDialog] = useState<ConfirmState | null>(null);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => {
    // Animate out, then remove — so toasts don't pop off abruptly
    setToasts(t => t.map(x => (x.id === id ? { ...x, leaving: true } : x)));
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 200);
  }, []);

  const toast = useCallback((message: string, kind: ToastKind = "info") => {
    const id = ++seq.current;
    setToasts(t => [...t.slice(-2), { id, kind, message }]); // keep at most 3 stacked
    setTimeout(() => dismiss(id), 4200);
  }, [dismiss]);

  const confirm = useCallback((opts: ConfirmOpts) => {
    return new Promise<boolean>(resolve => {
      setDialog({ ...opts, id: ++seq.current, resolve });
    });
  }, []);

  const closeDialog = useCallback((ok: boolean) => {
    setDialog(d => {
      d?.resolve(ok);
      return null;
    });
  }, []);

  // Esc cancels the dialog — keyboard parity with clicking outside it
  useEffect(() => {
    if (!dialog) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeDialog(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialog, closeDialog]);

  return (
    <Ctx.Provider value={{ toast, confirm }}>
      {children}

      {/* Toast stack — sits above the mobile bottom nav + home indicator */}
      <div
        className="fixed z-[100] flex flex-col gap-2 pointer-events-none"
        style={{
          right: 16,
          left: 16,
          bottom: "calc(env(safe-area-inset-bottom) + 84px)",
          maxWidth: 400,
          marginLeft: "auto",
        }}
      >
        {toasts.map(t => {
          const { icon: Icon, color, glow } = KIND[t.kind];
          return (
            <div
              key={t.id}
              role="status"
              className="pointer-events-auto flex items-start gap-3 rounded-2xl px-4 py-3 shadow-2xl"
              style={{
                background: "rgba(255,255,255,0.97)",
                border: "1px solid rgba(0,0,0,0.05)",
                backdropFilter: "blur(12px)",
                boxShadow: `0 12px 40px rgba(0,0,0,0.12), 0 0 0 1px ${glow}`,
                animation: t.leaving
                  ? "toast-out 0.2s ease forwards"
                  : "toast-in 0.32s cubic-bezier(0.21,1.02,0.73,1)",
              }}
            >
              <Icon size={18} style={{ color, flexShrink: 0, marginTop: 1 }} />
              <span className="flex-1 text-sm leading-snug" style={{ color: "rgba(31,35,40,0.92)" }}>
                {t.message}
              </span>
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
                className="shrink-0 -mr-1 -mt-0.5 rounded-lg p-1 transition-colors hover:bg-black/[0.05]"
                style={{ color: "rgba(31,35,40,0.45)" }}
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Confirm dialog */}
      {dialog && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-4"
          style={{ background: "rgba(15,17,21,0.35)", backdropFilter: "blur(4px)", animation: "overlay-in 0.18s ease" }}
          onClick={e => { if (e.target === e.currentTarget) closeDialog(false); }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            className="w-full max-w-sm rounded-2xl p-6"
            style={{
              background: "#FFFFFF",
              border: "1px solid rgba(0,0,0,0.05)",
              boxShadow: "0 24px 64px rgba(0,0,0,0.16)",
              animation: "dialog-in 0.22s cubic-bezier(0.21,1.02,0.73,1)",
            }}
          >
            <div className="flex items-start gap-3 mb-4">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: dialog.danger ? "rgba(239,68,68,0.12)" : "rgba(110,127,243,0.12)" }}
              >
                {dialog.danger
                  ? <AlertTriangle size={17} style={{ color: "#ef4444" }} />
                  : <Info size={17} style={{ color: "#6E7FF3" }} />}
              </div>
              <div className="flex-1 pt-0.5">
                <div style={{ fontSize: 16, fontWeight: 600, color: "#191918" }}>{dialog.title}</div>
                {dialog.message && (
                  <div className="mt-1.5 text-sm leading-relaxed" style={{ color: "rgba(31,35,40,0.58)" }}>
                    {dialog.message}
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => closeDialog(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium transition-colors hover:bg-black/[0.05]"
                style={{ color: "rgba(31,35,40,0.6)", border: "1px solid rgba(0,0,0,0.08)" }}
              >
                {dialog.cancelLabel ?? "Cancel"}
              </button>
              <button
                autoFocus
                onClick={() => closeDialog(true)}
                className="px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.97]"
                style={{ background: dialog.danger ? "#ef4444" : "#4B5FE8", color: "white" }}
              >
                {dialog.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

// ── Hooks ────────────────────────────────────────────────────────────────────
export function useFeedback() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useFeedback must be used within <FeedbackProvider>");
  return ctx;
}
export function useToast() {
  return useFeedback().toast;
}
export function useConfirm() {
  return useFeedback().confirm;
}
