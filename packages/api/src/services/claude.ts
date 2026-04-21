import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function generateCheatSheet(transcript: string, lectureTitle: string) {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: `You are an expert study assistant. Generate a structured cheat sheet from a lecture transcript.
Return ONLY valid JSON matching this schema:
{
  "sections": [{ "heading": string, "bullets": string[] }],
  "examTips": string[],
  "formulas": string[]
}
Be concise. Include 3-5 sections, 3-5 exam tips, and any formulas mentioned.`,
    messages: [
      {
        role: "user",
        content: `Lecture: "${lectureTitle}"\n\nTranscript:\n${transcript.slice(0, 12000)}`,
      },
    ],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  const json = text.match(/\{[\s\S]*\}/)?.[0] ?? "{}";
  return JSON.parse(json);
}

export async function generateQuiz(
  transcript: string,
  lectureTitle: string
): Promise<
  {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
    timestampSeconds?: number;
  }[]
> {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: `You are an expert study assistant. Generate 5-10 multiple choice questions from a lecture transcript.
Return ONLY valid JSON as an array matching this schema:
[{
  "question": string,
  "options": string[4],
  "correctIndex": number,
  "explanation": string,
  "timestampSeconds": number | null
}]
Questions should test deep understanding, not just memorization.`,
    messages: [
      {
        role: "user",
        content: `Lecture: "${lectureTitle}"\n\nTranscript:\n${transcript.slice(0, 12000)}`,
      },
    ],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "[]";
  const json = text.match(/\[[\s\S]*\]/)?.[0] ?? "[]";
  return JSON.parse(json);
}
