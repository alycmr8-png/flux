import "express-async-errors";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { webhookRouter } from "./routes/webhooks";
import { stripeWebhookRouter } from "./routes/stripe-webhook";
import { billingRouter } from "./routes/billing";
import { studyBookRouter } from "./routes/studybook";
import { lectureRouter } from "./routes/lectures";
import { courseRouter } from "./routes/courses";
import { cheatSheetRouter } from "./routes/cheatsheets";
import { quizRouter } from "./routes/quizzes";
import { calendarRouter } from "./routes/calendar";
import { progressRouter } from "./routes/progress";
import { settingsRouter } from "./routes/settings";
import { noteRouter } from "./routes/notes";
import { eventRouter } from "./routes/events";
import { networkRouter } from "./routes/network";
import { askRouter } from "./routes/ask";
import { examPrepRouter } from "./routes/examprep";
import { canvasRouter } from "./routes/canvas";
import { photoRouter } from "./routes/photos";
import { accountRouter } from "./routes/account";
import { usageSummary, quotasDisabled } from "./services/usage";
import { errorHandler } from "./middleware/errorHandler";
import { attachLiveTranscribe } from "./lib/liveTranscribe";
import { requireAuth } from "./middleware/requireAuth";
import { waitlistRouter } from "./routes/waitlist";

const app = express();
const PORT = process.env.PORT || 3001;

/**
 * Origins allowed to call the API, from a comma-separated ALLOWED_ORIGINS.
 *
 * Trimmed, and trailing slashes removed, because this value is typed by hand into a
 * dashboard: "a.com, b.com" would otherwise register " b.com", and "a.com/" would
 * register a string no browser ever sends as an Origin. Either way the request is
 * refused with no clue as to why, and CORS failures surface in the browser rather
 * than in any log you would think to check.
 */
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim().replace(/\/+$/, ""))
  .filter(Boolean);

if (allowedOrigins.length) console.log(`[cors] allowing: ${allowedOrigins.join(" ")}`);
else console.warn("[cors] ALLOWED_ORIGINS is not set — allowing every origin");

app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : "*" }));

// app.use, not app.post: mounting a Router with app.post leaves the mount path on
// req.url, so the routers' own `post("/")` never matches and every delivery 404s.
// Both must stay above express.json() — signature verification needs the raw body.
app.use("/webhooks/clerk", express.raw({ type: "application/json" }), webhookRouter);
app.use("/webhooks/stripe", express.raw({ type: "application/json" }), stripeWebhookRouter);

app.use(express.json());

// Reports which build is answering, not just that something is. A plain {ok:true}
// is identical before and after a deploy, so it can't tell you whether the fix you
// just pushed is actually live — which is the only question anyone asks it.
// Railway sets RAILWAY_GIT_COMMIT_SHA; empty elsewhere, and that's fine.
const COMMIT = (process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.COMMIT_SHA ?? "").slice(0, 7);
const CLERK_KEY = process.env.CLERK_SECRET_KEY ?? "";
const CLERK_MODE = CLERK_KEY.startsWith("sk_live")
  ? "live"
  : CLERK_KEY.startsWith("sk_test")
    ? "test"
    : CLERK_KEY
      ? "unrecognised"
      : "unset";
const BOOTED_AT = new Date().toISOString();

app.get("/health", (_req, res) =>
  // `quotas` is reported so enforcement can be confirmed from outside, without
  // trusting a dashboard or a memory of what was set. In production it is always
  // "enforced" — see quotasDisabled in services/usage.ts.
  res.json({
    ok: true,
    commit: COMMIT || null,
    bootedAt: BOOTED_AT,
    quotas: quotasDisabled ? "DISABLED" : "enforced",
    // Which Clerk instance this server validates tokens against — the prefix only,
    // never the key. A pk_live frontend against an sk_test backend lets sign-in
    // succeed and then fails every authenticated request, which looks like a broken
    // app rather than a mismatched pair of keys. One request now answers it.
    clerk: CLERK_MODE,
  }),
);

app.use("/public/waitlist", waitlistRouter);
app.use("/api", requireAuth);
app.use("/api/courses", courseRouter);
app.use("/api/lectures", lectureRouter);
app.use("/api/cheatsheets", cheatSheetRouter);
app.use("/api/quizzes", quizRouter);
app.use("/api/calendar", calendarRouter);
app.use("/api/progress", progressRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/notes", noteRouter);
app.use("/api/events", eventRouter);
app.use("/api/billing", billingRouter);
app.use("/api/studybook", studyBookRouter);
app.use("/api/network", networkRouter);
app.use("/api/ask", askRouter);
app.use("/api/examprep", examPrepRouter);
app.use("/api/canvas", canvasRouter);
app.use("/api/photos", photoRouter);
app.use("/api/account", accountRouter);
app.get("/api/usage", async (req, res) => {
  const user = (req as any).user;
  res.json({ data: await usageSummary(user.id) });
});

app.use(errorHandler);

const server = app.listen(Number(PORT), "0.0.0.0", () => console.log(`API running on http://0.0.0.0:${PORT}`));
attachLiveTranscribe(server);
