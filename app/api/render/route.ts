import { render } from '@/lib/renderer';

export const runtime = 'nodejs';
export const maxDuration = 60;

// POST { template, format, slots, scale? }  → image/png (or JSON with ?json=1)
// GET  /api/render?template=ae-spotlight&format=post&slot.ae-first-name=Sarah.  → image/png
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.template || !body?.format) return Response.json({ error: 'template and format are required' }, { status: 400 });
  return respond({ template: body.template, format: body.format, slots: body.slots ?? {}, scale: body.scale }, new URL(req.url));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const template = url.searchParams.get('template');
  const format = url.searchParams.get('format');
  if (!template || !format) return Response.json({ error: 'template and format are required' }, { status: 400 });
  const slots: Record<string, string | null> = {};
  for (const [k, v] of url.searchParams) if (k.startsWith('slot.')) slots[k.slice(5)] = v === '' ? null : v;
  return respond({ template, format, slots, scale: Number(url.searchParams.get('scale') ?? 1) }, url);
}

async function respond(input: Parameters<typeof render>[0], url: URL) {
  const started = Date.now();
  try {
    const { png, report } = await render(input);
    const ms = Date.now() - started;
    if (url.searchParams.get('json')) {
      return Response.json({ ok: report.ok, report, ms, image: `data:image/png;base64,${png.toString('base64')}` }, { status: report.ok ? 200 : 422 });
    }
    return new Response(new Uint8Array(png), {
      status: report.ok ? 200 : 422,
      headers: {
        'Content-Type': 'image/png',
        'X-Render-Ok': String(report.ok),
        'X-Render-Ms': String(ms),
        'X-Render-Report': Buffer.from(JSON.stringify(report)).toString('base64'),
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
