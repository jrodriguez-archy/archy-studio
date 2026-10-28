import { describe, expect, it, vi } from 'vitest';

// DOC only exists for the people who have it: the MCP everyone else connects to never names it, in its
// instructions, its tools or its answers. The token says who calls ("doc" has DOC, "plain" does not).
vi.mock('@/lib/mcp-auth', () => ({
  verifyMcpToken: async (_req: Request, token?: string) => (token ? { token, clientId: 'test', scopes: [], extra: { userId: 'u1', email: `${token}@archy.com` } } : undefined),
}));
vi.mock('@/lib/team', () => ({ hasDocAccess: async (email: string) => email.startsWith('doc') }));
vi.mock('@/lib/supabase/admin', () => {
  const chain: unknown = new Proxy(() => chain, { get: (_t, k) => (k === 'then' ? (ok: (v: unknown) => void) => ok({ data: [] }) : chain), apply: () => chain });
  return { supabaseConfigured: () => true, supabaseAdmin: () => chain };
});

const { POST } = await import('@/app/mcp/route');

async function rpc(who: string, method: string, params: Record<string, unknown>) {
  const res = await POST(new Request('http://localhost/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', Authorization: `Bearer ${who}` },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  }));
  const body = await res.text();
  const msg = body.split('\n').filter((l) => l.startsWith('data:')).map((l) => JSON.parse(l.slice(5)))[0] ?? JSON.parse(body);
  return msg.result;
}
const instructionsOf = async (who: string) => (await rpc(who, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } })).instructions as string;
const toolsOf = async (who: string) => JSON.stringify((await rpc(who, 'tools/list', {})).tools);
const answer = async (who: string, name: string, args: Record<string, unknown>) =>
  ((await rpc(who, 'tools/call', { name, arguments: args })).content as { type: string; text?: string }[]).map((c) => c.text ?? '').join('\n');
const DOC = /\bdoc\b|Dental Ownership/i;

describe('MCP without DOC', () => {
  it('never names DOC in its instructions or tools', async () => {
    expect(await instructionsOf('plain')).not.toMatch(DOC);
    expect(await toolsOf('plain')).not.toMatch(DOC);
  });

  it('answers a DOC template like one that is not there', async () => {
    const doc = await answer('plain', 'get_template', { template: 'doc-bar' });
    expect(doc).toMatch(/^No template "doc-bar"\. Templates: /);
    expect(doc.replace('"doc-bar"', '')).not.toMatch(/\bdoc-/);
    expect(await answer('plain', 'get_template', { template: 'nope' })).toBe(doc.replace('doc-bar', 'nope'));
  });

  it('lists only Archy templates, even when asked for DOC', async () => {
    const list = await answer('plain', 'list_templates', { brand: 'doc' });
    expect(list).toContain('ae-spotlight');
    expect(list).not.toMatch(/"doc-/);
  });
});

describe('MCP with DOC', () => {
  it('keeps both brands, as before', async () => {
    expect(await instructionsOf('doc')).toContain('Dental Ownership Collective');
    expect(await toolsOf('doc')).toContain('"doc"');
    expect(await answer('doc', 'list_templates', { brand: 'doc' })).toContain('"doc-bar"');
  });
});
