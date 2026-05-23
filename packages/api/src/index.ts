import "express-async-errors";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

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
import { documentRouter } from "./routes/documents";
import { noteRouter } from "./routes/notes";
import { eventRouter } from "./routes/events";
import { networkRouter } from "./routes/network";
import { errorHandler } from "./middleware/errorHandler";
import { requireAuth } from "./middleware/requireAuth";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(",") || "*" }));

app.post("/webhooks/clerk", express.raw({ type: "application/json" }), webhookRouter);
app.post("/webhooks/stripe", express.raw({ type: "application/json" }), stripeWebhookRouter);

app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api", requireAuth);
app.use("/api/courses", courseRouter);
app.use("/api/lectures", lectureRouter);
app.use("/api/cheatsheets", cheatSheetRouter);
app.use("/api/quizzes", quizRouter);
app.use("/api/calendar", calendarRouter);
app.use("/api/progress", progressRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/documents", documentRouter);
app.use("/api/notes", noteRouter);
app.use("/api/events", eventRouter);
app.use("/api/billing", billingRouter);
app.use("/api/studybook", studyBookRouter);
app.use("/api/network", networkRouter);

app.use(errorHandler);

app.listen(Number(PORT), "0.0.0.0", () => console.log(`API running on http://0.0.0.0:${PORT}`));
