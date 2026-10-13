/**
 * Authenticated API client for the mobile app.
 *
 * - Base URL comes from lib/api/config.ts (EXPO_PUBLIC_API_URL /
 *   EXPO_PUBLIC_API_HOST + EXPO_PUBLIC_API_PORT, default port 39847,
 *   base = host + '/api/v1').
 * - Every request injects `Authorization: Bearer <access_token>`; the token
 *   is read from the same secure store the AuthContext writes on login
 *   (server returns `access_token`, not `accessToken`).
 * - The server's Nest controllers return RAW payloads (no `.data` envelope),
 *   errors are Nest HttpException JSON ({ statusCode, message, error }).
 *
 * Shared by POS screens (G1b) and the scan-to-add-product flow (G1c).
 */
import { API_CONFIG, getApiUrl, fetchWithTimeout } from './config';
import { AuthStorage } from '../storage/auth-storage';

export class ApiError extends Error {
  readonly status: number;
  readonly data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** JSON body — automatically stringified */
  body?: unknown;
  headers?: Record<string, string>;
  /** Override the token (defaults to the stored login token) */
  token?: string;
  timeoutMs?: number;
}

async function resolveToken(explicit?: string): Promise<string> {
  if (explicit) return explicit;
  const stored = await AuthStorage.getToken();
  if (!stored) {
    throw new ApiError('Not authenticated', 401);
  }
  return stored;
}

/**
 * Build the message for a Nest-style error body. `message` can be a string
 * or an array of strings (class-validator multiple failures).
 */
function extractMessage(status: number, data: unknown): string {
  if (data && typeof data === 'object') {
    const d = data as { message?: unknown };
    if (Array.isArray(d.message)) return d.message.join(', ');
    if (typeof d.message === 'string' && d.message) return d.message;
  }
  return `Request failed (${status})`;
}

/**
 * Perform an authenticated JSON request. Returns the parsed JSON body, or
 * `undefined` for 204/empty responses. Throws ApiError on non-2xx.
 */
export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const token = await resolveToken(options.token);
  const url = getApiUrl(path);

  const response = await fetchWithTimeout(url, {
    method: options.method ?? 'GET',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  }, options.timeoutMs ?? API_CONFIG.timeout);

  if (!response.ok) {
    const data = await response.json().catch(() => undefined);
    throw new ApiError(extractMessage(response.status, data), response.status, data);
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  if (!text || text === 'null') return undefined as T;
  return JSON.parse(text) as T;
}

/**
 * Perform an authenticated request that returns the raw Response — used for
 * binary payloads like the sale receipt PDF (GET /sales/:id/receipt).
 * Does NOT throw on 404 so callers can degrade gracefully.
 */
export async function apiRequestRaw(
  path: string,
  options: ApiRequestOptions = {}
): Promise<Response> {
  const token = await resolveToken(options.token);
  return fetchWithTimeout(
    getApiUrl(path),
    {
      method: options.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    },
    options.timeoutMs ?? API_CONFIG.timeout
  );
}
