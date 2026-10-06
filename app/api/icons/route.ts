import { SUGGESTED, iconMarkup, searchIcons } from '@/lib/icons';

export const runtime = 'nodejs';

// Canvas icon picker: Hugeicons matching ?q= (or the ones the templates use), with their drawing.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q')?.trim() ?? '';
  const found = q ? await searchIcons(q) : SUGGESTED.map((name) => ({ name, label: name.slice(0, -4).replace(/([a-z])([A-Z0-9])/g, '$1 $2').toLowerCase() }));
  const icons = await Promise.all(found.map(async (i) => ({ ...i, svg: await iconMarkup(i.name) })));
  return Response.json({ icons: icons.filter((i) => i.svg) }, { headers: { 'Cache-Control': 'private, max-age=3600' } });
}
