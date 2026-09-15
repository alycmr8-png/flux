import { isBareLatex, latexToReadable, mathToPlainText } from "@sano/shared";
import { google } from "googleapis";
import { prisma } from "../lib/prisma";

export function getGoogleCalendarClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  return { oauth2Client };
}

async function getAuthClient(user: any) {
  const token = await prisma.googleToken.findUnique({ where: { userId: user.id } });
  if (!token) return null;
  const { oauth2Client } = getGoogleCalendarClient();
  oauth2Client.setCredentials({
    access_token: token.accessToken,
    refresh_token: token.refreshToken,
    expiry_date: token.expiresAt.getTime(),
  });
  return oauth2Client;
}

export async function syncToDrive(user: any, content: any, title: string): Promise<string | null> {
  const auth = await getAuthClient(user);
  if (!auth) return null;

  const drive = google.drive({ version: "v3", auth });
  const body = formatCheatSheetText(content, title);

  const file = await drive.files.create({
    requestBody: { name: `${title} — Cheat Sheet`, mimeType: "application/vnd.google-apps.document" },
    media: { mimeType: "text/plain", body },
    fields: "id,webViewLink",
  });

  return file.data.webViewLink ?? null;
}

export async function createCalendarEvent(
  user: any,
  summary: string,
  description: string,
  startTime: Date,
  durationMinutes = 30
): Promise<string | null> {
  const auth = await getAuthClient(user);
  if (!auth) return null;

  const calendar = google.calendar({ version: "v3", auth });
  const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

  const event = await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary,
      description,
      start: { dateTime: startTime.toISOString() },
      end: { dateTime: endTime.toISOString() },
    },
  });

  return event.data.id ?? null;
}

// Google Docs can't typeset LaTeX, so maths is written out in readable symbols
// (∫₀¹ x² dx) rather than exported as raw source.
function formatCheatSheetText(content: any, title: string): string {
  const plain = (s: unknown) => mathToPlainText(String(s ?? "")).replace(/\n+/g, " ").trim();
  let text = `${title} — Cheat Sheet\n${"=".repeat(40)}\n\n`;
  for (const section of content.sections ?? []) {
    const heading = plain(section.heading);
    text += `${heading}\n${"-".repeat(heading.length)}\n`;
    for (const bullet of section.bullets ?? []) text += `• ${plain(bullet)}\n`;
    text += "\n";
  }
  if (content.formulas?.length) {
    text += `Formulas\n--------\n`;
    for (const f of content.formulas) text += `• ${isBareLatex(f) ? latexToReadable(f) : plain(f)}\n`;
    text += "\n";
  }
  if (content.examTips?.length) {
    text += `Exam Tips\n---------\n`;
    for (const tip of content.examTips) text += `• ${plain(tip)}\n`;
  }
  return text;
}
