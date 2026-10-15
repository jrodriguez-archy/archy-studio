// Next's request helpers, for code imported in tests (never called there).
export const redirect = () => { throw new Error('redirect'); };
export const notFound = () => { throw new Error('notFound'); };
export const cookies = async () => ({ get: () => undefined, getAll: () => [], set() {} });
export const headers = async () => new Headers();
