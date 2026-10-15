// Minimal client for the Paper desktop MCP server (Streamable HTTP, read-only use).
const URL_ = process.env.PAPER_MCP_URL || 'http://127.0.0.1:29979/mcp';

let session = null;
let nextId = 1;
const TIMEOUT = Number(process.env.PAPER_TIMEOUT_MS) || 30_000;

async function post(body) {
  try {
    return await fetch(URL_, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        ...(session ? { 'mcp-session-id': session } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT),
    });
  } catch (e) {
    const code = e.cause?.code ?? e.name;
    if (code === 'ECONNREFUSED') throw Object.assign(new Error(`Paper is not answering at ${URL_}. Open the Paper desktop app (with the template's file) and try again.`), { fatal: true });
    if (code === 'TimeoutError') throw new Error(`Paper did not answer ${body.method} in ${TIMEOUT / 1000} s.`);
    throw e;
  }
}

async function once(method, params, notify) {
  const body = { jsonrpc: '2.0', method, params };
  if (!notify) body.id = nextId++;
  const res = await post(body);
  // A session Paper no longer knows (it restarted): start a new one.
  if ((res.status === 404 || res.status === 400) && session && method !== 'initialize') {
    session = null;
    throw Object.assign(new Error(`Paper dropped the session (${res.status}).`), { reconnect: true });
  }
  if (!res.ok) throw new Error(`${method}: Paper answered ${res.status}`);
  if (!session && method === 'initialize') session = res.headers.get('mcp-session-id');
  if (notify) return null;
  const text = await res.text();
  // SSE: the `data:` line carrying our id (a line that is not JSON is skipped, never fatal).
  const datas = text.split('\n').filter((l) => l.startsWith('data:')).flatMap((l) => { try { return [JSON.parse(l.slice(5))]; } catch { return []; } });
  let msg = datas.find((d) => d.id === body.id);
  if (!msg && text.trim().startsWith('{')) { try { msg = JSON.parse(text); } catch {} }
  if (!msg) throw new Error(`No response for ${method}: ${text.slice(0, 300)}`);
  if (msg.error) throw Object.assign(new Error(`${method}: ${JSON.stringify(msg.error)}`), { fatal: true });
  return msg.result;
}

// Up to 3 tries: a timeout or a dropped session is tried again (reconnecting); Paper closed or a tool
// error is not.
async function rpc(method, params, { notify = false } = {}) {
  for (let attempt = 1; ; attempt++) {
    try {
      if (!session && method !== 'initialize') await connect();
      return await once(method, params, notify);
    } catch (e) {
      if (e.fatal || attempt >= 3) throw e;
      if (e.reconnect) session = null;
      console.warn(`Paper: ${e.message} Trying again (${attempt}/2)…`);
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
}

let connecting = null;
export async function connect() {
  if (session) return;
  connecting ??= (async () => {
    await once('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'archy-templates-sync', version: '0.2.0' },
    });
    await once('notifications/initialized', {}, true);
  })().finally(() => { connecting = null; });
  await connecting;
}

const READ_ONLY = new Set([
  'get_basic_info', 'get_tree_summary', 'get_jsx', 'get_computed_styles', 'get_node_info',
  'get_children', 'get_tokens', 'get_fill_image', 'list_resources',
]);

// Returns the content blocks; the first text block is the file header, the rest is the payload.
export async function call(name, args) {
  if (!READ_ONLY.has(name)) throw new Error(`Refusing non read-only tool: ${name}`);
  const result = await rpc('tools/call', { name, arguments: args });
  if (result.isError) throw new Error(`${name}: ${result.content?.map((c) => c.text).join('\n')}`);
  const texts = result.content.filter((c) => c.type === 'text').map((c) => c.text);
  return texts.slice(1).join('\n');
}

export async function callJSON(name, args) {
  return JSON.parse(await call(name, args));
}

// Explicit, narrow write access for template preparation scripts (layer renames only).
export async function renameNodes(fileId, updates) {
  const result = await rpc('tools/call', { name: 'rename_nodes', arguments: { fileId, updates } });
  if (result.isError) throw new Error(result.content?.map((c) => c.text).join('\n'));
  return result;
}
