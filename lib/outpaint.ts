import 'server-only';

export type Expand = { top: number; right: number; bottom: number; left: number };

// "Generate content around": the photo kept as it is and the scene painted on past its edges, by the
// pixels asked for on each side. FLUX.2 [pro] Outpaint on fal.ai (no prompt: it reads the photo).
export async function outpaint(imageUrl: string, expand: Expand): Promise<Buffer> {
  if (!process.env.FAL_KEY) throw new Error('Generate content around is not set up yet (FAL_KEY).');
  const res = await fetch('https://fal.run/fal-ai/flux-2-pro/outpaint', {
    method: 'POST',
    headers: { Authorization: `Key ${process.env.FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_url: imageUrl, expand_top: expand.top, expand_right: expand.right, expand_bottom: expand.bottom, expand_left: expand.left,
      mode: 'high', output_format: 'png',
    }),
  });
  const out = await res.json().catch(() => null);
  const url = out?.images?.[0]?.url;
  if (!res.ok || !url) throw new Error(out?.detail?.[0]?.msg ?? (typeof out?.detail === 'string' ? out.detail : 'The photo could not be extended. Try again.'));
  return Buffer.from(await (await fetch(url)).arrayBuffer());
}
