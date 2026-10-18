import { VOICE_PROMPT, runAi } from '../../../../lib/ai';
import { badRequest, withAuth } from '../../../../lib/route';

export const POST = withAuth(async (req) => {
  const b = await req.json();
  const transcript = String(b.transcript ?? b.text ?? '').trim();
  if (!transcript) return badRequest('transcript is required');
  if (transcript.length > 1000) return badRequest('transcript too long');
  return runAi(VOICE_PROMPT, transcript);
});
