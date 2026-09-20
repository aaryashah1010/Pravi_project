// Thin fetch wrapper: adds the bearer token, unwraps the `{ data }` envelope and throws ApiError on failures.

const BASE = '/api/v1';
const TOKEN_KEY = 'infraflow.token';

export const UNAUTHENTICATED_EVENT = 'infraflow:unauthenticated';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage may be blocked; the in-memory session still works until reload */
  }
}

export interface FieldError {
  field: string;
  message: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId: string | null;
  readonly fieldErrors: FieldError[];

  constructor(status: number, code: string, message: string, requestId: string | null, fieldErrors: FieldError[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.fieldErrors = fieldErrors;
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  formData?: FormData;
  /** Login must surface 401 as a normal error instead of triggering the global sign-out. */
  skipAuthRedirect?: boolean;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = `${BASE}${path}`;
  if (!query) return url;
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '') continue;
    sp.set(k, String(v));
  }
  const qs = sp.toString();
  return qs ? `${url}?${qs}` : url;
}

async function parseError(res: Response): Promise<ApiError> {
  let payload: { error?: { code?: string; message?: string; requestId?: string; fieldErrors?: FieldError[] } } | null = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }
  const e = payload?.error;
  return new ApiError(
    res.status,
    e?.code ?? (res.status === 401 ? 'UNAUTHENTICATED' : 'INTERNAL_ERROR'),
    e?.message ?? `Request failed (${res.status})`,
    e?.requestId ?? null,
    e?.fieldErrors ?? [],
  );
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let body: BodyInit | undefined;
  if (opts.formData) {
    body = opts.formData;
  } else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }

  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), { method: opts.method ?? 'GET', headers, body, signal: opts.signal });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the InfraFlow API. Check that the API server is running.', null);
  }

  if (!res.ok) {
    const err = await parseError(res);
    if (err.status === 401 && !opts.skipAuthRedirect) {
      setToken(null);
      window.dispatchEvent(new Event(UNAUTHENTICATED_EVENT));
    }
    throw err;
  }
  if (res.status === 204) return undefined as T;
  const json = (await res.json()) as { data: T };
  return json.data;
}

/** Downloads need the bearer header, so they go through fetch + a temporary object URL. */
/** Fetches a protected binary (evidence photo etc.) with the bearer token; callers own revoking the object URL. */
export async function fetchBlobUrl(path: string, signal?: AbortSignal): Promise<string> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, signal });
  if (!res.ok) throw await parseError(res);
  return URL.createObjectURL(await res.blob());
}

export async function downloadFile(path: string, fallbackName: string): Promise<void> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw await parseError(res);
  const disposition = res.headers.get('content-disposition') ?? '';
  const match = /filename="([^"]+)"/.exec(disposition);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = match?.[1] ?? fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Something went wrong.';
}
