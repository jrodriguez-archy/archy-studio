import { describe, expect, it, vi } from 'vitest';

// The MCP's answers, through the route as Claude calls it: a signed-in person, renders "saved" without a
// database (the gallery and Supabase are stubbed).
vi.mock('@/lib/mcp-auth', () => ({
  verifyMcpToken: async (_req: Request, token?: string) => (token ? { token, clientId: 'test', scopes: [], extra: { userId: 'u1', email: 'test@archy.com' } } : undefined),
}));
vi.mock('@/lib/supabase/admin', () => {
  const chain: unknown = new Proxy(() => chain, { get: (_t, k) => (k === 'then' ? (ok: (v: unknown) => void) => ok({ data: [] }) : chain), apply: () => chain });
  return { supabaseConfigured: () => true, supabaseAdmin: () => chain };
});
vi.mock('@/lib/renders', async (orig) => ({
  ...(await orig<typeof import('@/lib/renders')>()),
  saveRender: async () => ({ id: 'r1' }),
  resolveSet: async () => 'set1',
}));

const { POST } = await import('@/app/mcp/route');

async function call(name: string, args: Record<string, unknown>) {
  const res = await POST(new Request('http://localhost/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', Authorization: 'Bearer t' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
  }));
  const body = await res.text();
  const msg = body.split('\n').filter((l) => l.startsWith('data:')).map((l) => JSON.parse(l.slice(5)))[0] ?? JSON.parse(body);
  return msg.result as { isError?: boolean; content: { type: string; text?: string }[] };
}
const texts = (r: Awaited<ReturnType<typeof call>>) => r.content.filter((c) => c.type === 'text').map((c) => c.text!);

describe('MCP answers', () => {
  it('match_templates answers compact JSON', async () => {
    const [t] = texts(await call('match_templates', { facts: ['event-name', 'city', 'date', 'booth'] }));
    expect(JSON.parse(t).eligible.length).toBeGreaterThan(0);
    expect(t).not.toContain('\n');
  });

  it('render explains the links once, says framing it ignored and how to get photos from the chat', async () => {
    const r = await call('render', {
      template: 'ae-spotlight', formats: ['post', 'stories'],
      slots: { 'ae-first-name': 'Sarah.', 'ae-name': 'Sarah Thompson', 'ae-title': 'Account Executive', 'ae-location': 'Austin, TX' },
      framing: { 'ae-name': { focus_x: 30 }, 'image-ae': { zoom: 1.2, fill_around: true } },
    });
    const all = texts(r).join("\n");
    expect(r.isError).toBeFalsy();
    expect(all.match(/Download \(2x PNG\): /g)).toHaveLength(2);
    expect(all.match(/use it to save the PNG/g)).toHaveLength(1);
    expect(all).toContain('framing for ae-name ignored: not a photo slot');
    expect(all).toContain('fill_around for image-ae ignored');
    expect(all).toContain('request_photos');
  });
});
