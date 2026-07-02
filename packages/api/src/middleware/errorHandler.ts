import { Request, Response, NextFunction } from "express";

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  console.error(err);

  // Multer "file too large" — return a clear, actionable message
  if ((err as any)?.code === "LIMIT_FILE_SIZE") {
    const maxMb = Number(process.env.MAX_UPLOAD_MB) || 100;
    return res.status(413).json({
      error: `That file is too large. Please keep uploads under ${maxMb} MB — compress it, or export the slides as a PDF and upload that.`,
    });
  }

  res.status(500).json({ error: err.message || "Internal server error" });
}
