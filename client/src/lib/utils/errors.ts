import { ApiError } from '@/types/api';

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

interface ErrorWithResponse {
  response?: {
    data?: ApiError;
    status?: number;
  };
  message?: string;
  code?: string;
}

export function transformApiError(error: unknown): string {
  const err = error as ErrorWithResponse;
  if (err.response?.data) {
    const apiError = err.response.data as ApiError;
    return apiError.message || apiError.error || 'An error occurred';
  }

  if (err.message) {
    return err.message;
  }

  return 'An unexpected error occurred';
}

export function isNetworkError(error: unknown): boolean {
  const err = error as ErrorWithResponse;
  return (
    err.code === 'ECONNABORTED' ||
    err.code === 'ENOTFOUND' ||
    err.code === 'ECONNREFUSED' ||
    (typeof navigator !== 'undefined' && !navigator.onLine)
  );
}

export function isAuthenticationError(error: unknown): boolean {
  const err = error as ErrorWithResponse;
  return err.response?.status === 401;
}

export function isAuthorizationError(error: unknown): boolean {
  const err = error as ErrorWithResponse;
  return err.response?.status === 403;
}

export function isConflictError(error: unknown): boolean {
  const err = error as ErrorWithResponse;
  return err.response?.status === 409;
}

