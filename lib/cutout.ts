import 'server-only';

// The person (or object) alone on a transparent PNG, the same size as the photo: BiRefNet on fal.ai,
// high quality at hair and edges. Used by "Remove background" and by "Pixel background" (as its mask).
export async function removeBackground(imageUrl: string): Promise<Buffer> {
  if (!process.env.FAL_KEY) throw new Error('Remove background is not set up yet (FAL_KEY).');
  const res = await fetch('https://fal.run/fal-ai/birefnet/v2', {
    method: 'POST',
    headers: { Authorization: `Key ${process.env.FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_url: imageUrl, model: 'General Use (Heavy)', operating_resolution: '2048x2048', output_format: 'png', refine_foreground: true }),
  });
  const out = await res.json().catch(() => null);
  if (!res.ok || !out?.image?.url) throw new Error(out?.detail?.[0]?.msg ?? (typeof out?.detail === 'string' ? out.detail : 'The background could not be removed. Try again.'));
  return Buffer.from(await (await fetch(out.image.url)).arrayBuffer());
}
