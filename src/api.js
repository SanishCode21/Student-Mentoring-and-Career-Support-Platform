import { demoRequest } from './demo/service.js';
export { ApiError } from './demo/errors.js';

/** Stable screen-facing boundary: this standalone entry has no HTTP transport. */
let sessionExpiredHandler;
// Compatibility hooks for auth.jsx. Demo mode has no access tokens at all.
export const setAccessToken = () => {};
export const getAccessToken = () => null;
export const onSessionExpired = (handler) => { sessionExpiredHandler = handler; };

async function call(method, path, body, params) {
  try { return await demoRequest(method, path, body, params); }
  catch (error) {
    if (error.code === 'UNAUTHENTICATED' && !path.startsWith('/auth/')) sessionExpiredHandler?.();
    throw error;
  }
}

export const get = (path, params) => call('GET', path, undefined, params);
export const post = (path, body, params) => call('POST', path, body, params);
export const patch = (path, body) => call('PATCH', path, body);
export const del = (path) => call('DELETE', path);

/** Follow local pagination with the same interface used by the existing pages. */
export async function getAll(path, params = {}, { pageSize = 50, maxPages = 20 } = {}) {
  const rows = [];
  let page = 1;
  let pages = 1;
  do {
    const envelope = await get(path, { ...params, page, page_size: pageSize });
    rows.push(...(envelope.data || []));
    pages = envelope.meta?.total_pages ?? 1;
    page += 1;
  } while (page <= pages && page <= maxPages);
  return rows;
}

/** Build/download a CSV locally. Object URLs never contact a server. */
export async function downloadCsv(path, params, fallbackName = 'demo-report.csv') {
  const { data } = await get(path, params);
  const name = data.filename || fallbackName;
  const url = URL.createObjectURL(new Blob([data.content], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return name;
}

// Retained for compatibility with consumers that used the default Axios facade.
export default {
  get: async (path, options) => ({ data: await get(path, options?.params) }),
  post: async (path, body, options) => ({ data: await post(path, body, options?.params) }),
  patch: async (path, body) => ({ data: await patch(path, body) }),
  delete: async (path) => ({ data: await del(path) }),
};
