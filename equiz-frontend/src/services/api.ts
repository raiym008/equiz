import { env } from '../config/env';

export class ApiError extends Error {
  status: number;
  data?: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export interface RequestOptions {
  headers?: HeadersInit;
  signal?: AbortSignal;
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

function buildUrl(endpoint: string): string {
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${env.API_BASE_URL}${normalizedEndpoint}`;
}

async function parseErrorMessage(res: Response): Promise<{ message: string; data?: unknown }> {
  let message = `Қате: ${res.status}`;
  let data: unknown;

  try {
    data = await res.json();
    if (data && typeof data === 'object' && 'detail' in data) {
      const detail = (data as { detail?: unknown }).detail;
      if (detail) {
        message = typeof detail === 'string' ? detail : JSON.stringify(detail);
      }
    } else if (data && typeof data === 'object' && 'message' in data) {
      const msg = (data as { message?: unknown }).message;
      if (typeof msg === 'string' && msg.trim()) {
        message = msg;
      }
    }
  } catch {
    // JSON емес қате жауабын елемеу
  }

  return { message, data };
}

async function request<T>(
  method: HttpMethod,
  endpoint: string,
  body?: unknown,
  options?: RequestOptions
): Promise<T> {
  const headers = new Headers(options?.headers);
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  let serializedBody: BodyInit | undefined;
  if (body !== undefined) {
    if (isFormData) {
      // multipart/form-data кезінде Content-Type қолмен орнатылмайды —
      // браузер boundary мәнін өзі қалыптастырады.
      headers.delete('Content-Type');
      serializedBody = body;
    } else {
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
      serializedBody = JSON.stringify(body);
    }
  }

  const res = await fetch(buildUrl(endpoint), {
    method,
    headers,
    body: serializedBody,
    signal: options?.signal,
  });

  if (!res.ok) {
    const { message, data } = await parseErrorMessage(res);
    throw new ApiError(message, res.status, data);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}

export const api = {
  get: <T>(endpoint: string, options?: RequestOptions): Promise<T> =>
    request<T>('GET', endpoint, undefined, options),

  post: <T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> =>
    request<T>('POST', endpoint, body, options),

  put: <T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> =>
    request<T>('PUT', endpoint, body, options),

  patch: <T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> =>
    request<T>('PATCH', endpoint, body, options),

  delete: <T = void>(endpoint: string, options?: RequestOptions): Promise<T> =>
    request<T>('DELETE', endpoint, undefined, options),
};
