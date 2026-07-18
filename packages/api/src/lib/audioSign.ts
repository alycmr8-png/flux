import crypto from "crypto";

// Media elements (<audio src>) can't send Authorization headers, so lecture
// audio is served through short-lived HMAC-signed URLs minted for the owner.
const SECRET = process.env.CLERK_SECRET_KEY || "dev-secret";

export function audioSig(lectureId: string, userId: string, exp: number): string {
  return crypto.createHmac("sha256", SECRET).update(`${lectureId}|${userId}|${exp}`).digest("hex");
}

export function verifyAudioSig(lectureId: string, userId: string, exp: number, sig: string): boolean {
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = audioSig(lectureId, userId, exp);
  return (
    sig.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  );
}
