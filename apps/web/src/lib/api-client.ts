'use client';

// ── Base HTTP client ───────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';

export class AbhayaApiError extends Error {
  readonly name = 'AbhayaApiError';

  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details: Record<string, unknown> = {},
    public readonly requestId?: string,
  ) {
    super(message);
  }

  get isAuth() { return this.status === 401; }
  get isForbidden() { return this.status === 403; }
  get isNotFound() { return this.status === 404; }
  get isRateLimit() { return this.status === 429; }
  get isServerError() { return this.status >= 500; }
}

export class NetworkError extends Error {
  readonly name = 'NetworkError';
  constructor() { super('Unable to connect to the server. Please check your connection.'); }
}

// ── Token storage ──────────────────────────────────────────────────────────────

const TOKEN_KEY = 'abhaya:token';

export const tokenStore = {
  get(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
  },
  set(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  },
  clear(): void {
    localStorage.removeItem(TOKEN_KEY);
  },
};

// ── Core request fn ────────────────────────────────────────────────────────────

interface RequestOptions extends Omit<RequestInit, 'body'> {
  token?: string | null;
  body?: unknown;
  formData?: FormData;
  params?: Record<string, string | number | boolean | null | undefined>;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { token, body, formData, params, ...init } = options;

  // Build URL with query params
  const url = new URL(`${API_BASE}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== null && value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  // Build headers
  const headers = new Headers(init.headers);
  const authToken = token ?? tokenStore.get();
  if (authToken) headers.set('Authorization', `Bearer ${authToken}`);
  if (body && !formData) headers.set('Content-Type', 'application/json');

  const requestInit: RequestInit = {
    ...init,
    headers,
    body: formData ?? (body !== undefined ? JSON.stringify(body) : undefined),
  };

  let response: Response;
  try {
    response = await fetch(url.toString(), requestInit);
  } catch {
    throw new NetworkError();
  }

  // 204 No Content
  if (response.status === 204) return undefined as T;

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    if (!response.ok) {
      throw new AbhayaApiError('PARSE_ERROR', 'Unexpected server response.', response.status);
    }
    return undefined as T;
  }

  if (!response.ok) {
    const err = (json as { error?: Partial<AbhayaApiError> })?.error ?? {};
    throw new AbhayaApiError(
      (err as { code?: string }).code ?? 'UNKNOWN_ERROR',
      (err as { message?: string }).message ?? 'Something went wrong.',
      response.status,
      (err as { details?: Record<string, unknown> }).details ?? {},
      (err as { request_id?: string }).request_id,
    );
  }

  return json as T;
}

// ── Convenience methods ────────────────────────────────────────────────────────

export const http = {
  get: <T>(path: string, opts?: RequestOptions) =>
    request<T>(path, { method: 'GET', ...opts }),

  post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { method: 'POST', body, ...opts }),

  patch: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { method: 'PATCH', body, ...opts }),

  delete: <T = void>(path: string, opts?: RequestOptions) =>
    request<T>(path, { method: 'DELETE', ...opts }),

  upload: <T>(path: string, formData: FormData, opts?: RequestOptions) =>
    request<T>(path, { method: 'POST', formData, ...opts }),
};
