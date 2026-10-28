import axios from 'axios';

/** Normalised error thrown by every API call. */
export class ApiError extends Error {
  constructor({ code, message, details = [], requestId, status = 0 }) {
    super(message || 'Request failed');
    this.name = 'ApiError';
    this.code = code || 'ERROR';
    this.details = details || [];
    this.requestId = requestId || null;
    this.status = status;
  }

  /** Message for a specific form field, or undefined. */
  fieldError(field) {
    const hit = this.details.find((d) => d.field === field || d.field?.endsWith(`.${field}`));
    return hit?.issue;
  }
}

let accessToken = null;
let sessionExpiredHandler = null;
let refreshPromise = null;

export const setAccessToken = (token) => {
  accessToken = token || null;
};

export const getAccessToken = () => accessToken;

export const onSessionExpired = (fn) => {
  sessionExpiredHandler = fn;
};

const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/api/v1',
  withCredentials: true,
  timeout: 30000,
});

http.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

function normalise(error) {
  const response = error.response;
  if (!response) {
    return new ApiError({
      code: 'NETWORK_ERROR',
      message: 'Network error. Check your connection and try again.',
      status: 0,
    });
  }
  const envelope = response.data && typeof response.data === 'object' ? response.data.error : null;
  return new ApiError({
    code: envelope?.code || `HTTP_${response.status}`,
    message: envelope?.message || response.statusText || 'Request failed',
    details: envelope?.details || [],
    requestId: envelope?.request_id,
    status: response.status,
  });
}

async function refreshSession() {
  // Deliberately axios (not `http`) so a failing refresh cannot recurse.
  const baseURL = import.meta.env.VITE_API_BASE || '/api/v1';
  const response = await axios.post(`${baseURL}/auth/refresh`, null, {
    withCredentials: true,
    timeout: 20000,
  });
  const data = response.data.data;
  setAccessToken(data.access_token);
  return data;
}

http.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config || {};
    const status = error.response?.status;
    const code = error.response?.data?.error?.code;
    const isAuthCall = String(config.url || '').startsWith('/auth/');

    if (status === 401 && code === 'UNAUTHENTICATED' && !config._retried && !isAuthCall) {
      config._retried = true;
      try {
        refreshPromise = refreshPromise || refreshSession().finally(() => { refreshPromise = null; });
        const data = await refreshPromise;
        config.headers = { ...(config.headers || {}), Authorization: `Bearer ${data.access_token}` };
        return http(config);
      } catch (refreshError) {
        setAccessToken(null);
        sessionExpiredHandler?.();
        throw normalise(refreshError);
      }
    }

    throw normalise(error);
  },
);

/** GET helper returning the full envelope `{data, meta}`. */
export async function get(path, params) {
  const response = await http.get(path, { params });
  return response.data;
}

export async function post(path, body, params) {
  const response = await http.post(path, body, { params });
  return response.data;
}

export async function patch(path, body) {
  const response = await http.patch(path, body);
  return response.data;
}

export async function del(path) {
  const response = await http.delete(path);
  return response.data;
}

/**
 * Walk a paginated list endpoint and return every row. Used by pages that need
 * accurate client-side status counts or cross-referencing (requests -> mentorship).
 */
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

/** Download a CSV report through the authenticated client. */
export async function downloadCsv(path, params, fallbackName = 'report.csv') {
  const response = await http.get(path, { params, responseType: 'blob' });
  const disposition = response.headers['content-disposition'] || '';
  const match = disposition.match(/filename="?([^";]+)"?/i);
  const name = match ? match[1] : fallbackName;
  const url = URL.createObjectURL(response.data);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return name;
}

export default http;
