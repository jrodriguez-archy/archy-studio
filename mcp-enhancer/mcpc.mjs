// Minimal MCP client: node mcp-enhancer/mcpc.mjs http://localhost:3011/mcp — edit the calls below to reproduce a diagnostic.
const URL_ = process.argv[2];
let id = 1, session = null;
async function rpc(method, params, notify) {
  const body = { jsonrpc: '2.0', method, params }; if (!notify) body.id = id++;
  const r = await fetch(URL_, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...(session ? { 'mcp-session-id': session } : {}) }, body: JSON.stringify(body) });
  session ??= r.headers.get('mcp-session-id');
  if (notify) return;
  const t = await r.text();
  const line = t.split('\n').filter((l) => l.startsWith('data:')).map((l) => JSON.parse(l.slice(5))).find((d) => d.id === body.id);
  return line ?? JSON.parse(t);
}
const init = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } });
console.log('server:', init.result?.serverInfo, 'instructions:', !!init.result?.instructions);
await rpc('notifications/initialized', {}, true);
const tools = await rpc('tools/list', {});
console.log('tools:', tools.result.tools.map((t) => t.name).join(', '));
const call = async (name, args) => (await rpc('tools/call', { name, arguments: args })).result;
console.log((await call('list_templates', {})).content[0].text.slice(0, 300));
console.log((await call('get_template', { template: 'ae-spotlight' })).content[0].text.slice(0, 600));
console.log((await call('list_assets', {})).content[0].text.slice(0, 200));
let r = await call('render', { template: 'ae-spotlight', slots: { 'ae-first-name': 'Sarah.' } });
console.log('no photo →', r.isError, r.content[0].text.slice(0, 120));
const t0 = Date.now();
r = await call('render', { template: 'ae-spotlight', slots: { 'ae-first-name': 'Sarah.', 'ae-name': 'Sarah Thompson', 'ae-title': 'Account Executive', 'ae-location': 'Austin, TX', ae: 'asset:ae-john-hickmott' } });
console.log('ok render →', r.isError, Date.now() - t0, 'ms', r.content.map((c) => c.type === 'image' ? `[image ${Math.round(c.data.length * 0.75 / 1024)}KB]` : c.text).join('\n'));
r = await call('render', { template: 'ae-spotlight', formats: ['post'], slots: { 'ae-first-name': 'John.', 'ae-name': 'John Hickmott', 'ae-title': 'Sr. Account Executive', 'ae-location': 'SAN FRANCISCO BAY AREA, CA', ae: 'asset:ae-john-hickmott' } });
console.log('too long →', r.isError, r.content.map((c) => c.text ?? '[image]').join('\n'));
