// Module hooks registered by next-stubs.mjs: next/navigation and next/headers resolve to stand-ins.
const STUB = `
  export const redirect = () => { throw new Error('redirect'); };
  export const notFound = () => { throw new Error('notFound'); };
  export const cookies = async () => ({ get: () => undefined, getAll: () => [], set() {} });
  export const headers = async () => new Headers();
  export default {};`;

export async function resolve(spec, ctx, next) {
  if (/^next\/(navigation|headers)(\.js)?$/.test(spec)) return { url: 'next-stub:request', shortCircuit: true };
  return next(spec, ctx);
}

export async function load(url, ctx, next) {
  if (url === 'next-stub:request') return { format: 'module', shortCircuit: true, source: STUB };
  return next(url, ctx);
}
