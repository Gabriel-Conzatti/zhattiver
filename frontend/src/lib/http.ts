import type { ApiError } from './types';

const CSRF_COOKIE = 'lynk_csrf';

function readCookie(name: string): string | null {
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split('=')[1]) : null;
}

export class ApiRequestError extends Error {
  status: number;
  code: string;
  details?: Record<string, unknown>;
  requestId?: string;

  constructor(status: number, err: ApiError) {
    super(err.message);
    this.status = status;
    this.code = err.code;
    this.details = err.details;
    this.requestId = err.requestId;
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

export async function api<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, method = 'GET', ...rest } = options;
  const finalHeaders = new Headers(headers ?? {});
  finalHeaders.set('Accept', 'application/json');

  if (body !== undefined) {
    finalHeaders.set('Content-Type', 'application/json');
  }

  if (!/^(GET|HEAD|OPTIONS)$/i.test(method)) {
    const csrf = readCookie(CSRF_COOKIE);
    if (csrf) finalHeaders.set('X-CSRF-Token', csrf);
  }

  const response = await fetch(`/api/v1${path}`, {
    method,
    credentials: 'include',
    headers: finalHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
    ...rest,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const err: ApiError = data?.error ?? {
      code: 'unknown_error',
      message: response.statusText || 'Erro desconhecido',
    };
    throw new ApiRequestError(response.status, err);
  }

  return data as T;
}
