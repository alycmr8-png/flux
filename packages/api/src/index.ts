import "express-async-errors";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

import { webhookRouter } from "./routes/webhooks";
import { lectureRouter } from "./routes/lectures";
import { courseRouter } from "./routes/courses";
import { cheatSheetRouter } from "./routes/cheatsheets";
import { quizRouter } from "./routes/quizzes";
import { calendarRouter } from "./routes/calendar";
import { progressRouter } from "./routes/progress";
import { errorHandler } from "./middleware/errorHandler";
import { requireAuth } from "./middleware/requireAuth";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(",") || "*" }));

app.post("/webhooks/clerk", express.raw({ type: "application/json" }), webhookRouter);

app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api", requireAuth);
app.use("/api/courses", courseRouter);
app.use("/api/lectures", lectureRouter);
app.use("/api/cheatsheets", cheatSheetRouter);
app.use("/api/quizzes", quizRouter);
app.use("/api/calendar", calendarRouter);
app.use("/api/progress", progressRouter);

app.use(errorHandler);

app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
