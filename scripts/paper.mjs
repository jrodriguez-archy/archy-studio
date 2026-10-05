// Minimal client for the Paper desktop MCP server (Streamable HTTP, read-only use).
const URL_ = process.env.PAPER_MCP_URL || 'http://127.0.0.1:29979/mcp';

let session = null;
let nextId = 1;

async function rpc(method, params, { notify = false } = {}) {
  const body = { jsonrpc: '2.0', method, params };
  if (!notify) body.id = nextId++;
  const res = await fetch(URL_, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...(session ? { 'mcp-session-id': session } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!session) session = res.headers.get('mcp-session-id');
  if (notify) return null;
  const text = await res.text();
  // SSE: take the last `data:` line carrying our id.
  const datas = text.split('\n').filter((l) => l.startsWith('data:')).map((l) => JSON.parse(l.slice(5)));
  const msg = datas.find((d) => d.id === body.id) ?? (text.trim().startsWith('{') ? JSON.parse(text) : null);
  if (!msg) throw new Error(`No response for ${method}: ${text.slice(0, 300)}`);
  if (msg.error) throw new Error(`${method}: ${JSON.stringify(msg.error)}`);
  return msg.result;
}

export async function connect() {
  if (session) return;
  await rpc('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'archy-templates-sync', version: '0.1.0' },
  });
  await rpc('notifications/initialized', {}, { notify: true });
}

const READ_ONLY = new Set([
  'get_basic_info', 'get_tree_summary', 'get_jsx', 'get_computed_styles', 'get_node_info',
  'get_children', 'get_tokens', 'get_fill_image', 'list_resources',
]);

// Returns the content blocks; the first text block is the file header, the rest is the payload.
export async function call(name, args) {
  if (!READ_ONLY.has(name)) throw new Error(`Refusing non read-only tool: ${name}`);
  await connect();
  const result = await rpc('tools/call', { name, arguments: args });
  if (result.isError) throw new Error(`${name}: ${result.content?.map((c) => c.text).join('\n')}`);
  const texts = result.content.filter((c) => c.type === 'text').map((c) => c.text);
  return texts.slice(1).join('\n');
}

export async function callJSON(name, args) {
  return JSON.parse(await call(name, args));
}
