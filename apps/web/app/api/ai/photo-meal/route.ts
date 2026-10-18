import { PHOTO_PROMPT, runAi } from '../../../../lib/ai';
import { badRequest, withAuth } from '../../../../lib/route';

export const POST = withAuth(async (req) => {
  const { image } = await req.json();
  if (typeof image !== 'string' || !image) return badRequest('image (base64 JPEG) is required');
  if (image.length > 8_000_000) return badRequest('image too large');
  return runAi(PHOTO_PROMPT, 'Identify and estimate the nutrition of this meal.', image);
});
