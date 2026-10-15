// What the Canvas stage loads into its iframes: the page scripts, each template's page (without its sample
// photos), and the turns formats take to draw.

const scripts: Record<string, Promise<string>> = {};
// This deploy's copy (a new deploy, a new address: never an old engine from the browser cache).
const BUILD = process.env.NEXT_PUBLIC_BUILD ?? 'dev';
export const script = (name: string) => (scripts[name] ??= fetch(`/api/template-files/scripts/${name}?v=${BUILD}`).then((r) => r.text()));
// The page is written into a same-origin iframe: only Canvas's own scripts (with this nonce) run in it, never
// a handler or a javascript: link that came in with a design's HTML.
export const guarded = (t: string, nonce: string) => {
  const meta = `<meta http-equiv="Content-Security-Policy" content="script-src 'nonce-${nonce}'; object-src 'none'; base-uri 'self'; form-action 'none'">`;
  return /<head[^>]*>/i.test(t) ? t.replace(/<head([^>]*)>/i, `<head$1>${meta}`) : meta + t;
};

// Formats not being edited draw their first time two at a time (the one being edited never waits),
// so opening a set shows the active format first instead of every format at once on one thread.
let busy = 0;
const waiting: (() => void)[] = [];
export const turn = () => new Promise<() => void>((done) => {
  const go = () => { busy++; let out = false; done(() => { if (out) return; out = true; busy--; waiting.shift()?.(); }); };
  if (busy < 2) go(); else waiting.push(go);
});

// A template page, fetched once per tab: each redraw writes it into the iframe (no network), and its
// fonts and images resolve against the template's folder and come from the browser cache.
const pages: Record<string, Promise<string>> = {};
export const templatePage = (html: string) => (pages[html] ??= fetch(`/api/template-files/${html}?v=${BUILD}`)
  .then((r) => { if (!r.ok) throw new Error(`Template page ${r.status}`); return r.text(); })
  .then((t) => t.replace(/<head([^>]*)>/i, `<head$1><base href="${location.origin}/api/template-files/${html}">`))
  .catch((e) => { delete pages[html]; throw e; })); // a failed fetch is tried again next time

// The template's sample photo in an image slot the fill is about to set (or remove): taken out of the page
// before it is written, so the iframe's load does not wait for a multi-MB PNG that is thrown away.
export const withoutSamples = (t: string, values: Record<string, string | null>) => t.replace(/<[^>]*data-slot-type="image"[^>]*>/g, (tag) => {
  const role = tag.match(/data-slot="([^"]+)"/)?.[1];
  return role && role in values ? tag.replace(/background-image:\s*url\([^)]*\);?\s*/g, '') : tag;
});
