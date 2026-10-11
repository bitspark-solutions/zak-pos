/**
 * Network utilities for handling offline state and retry logic
 */

export function isOnline(): boolean {
  if (typeof window === 'undefined') return true;
  return navigator.onLine;
}

interface NetworkError {
  code?: string;
  message?: string;
}

export function detectNetworkError(error: unknown): boolean {
  const err = error as NetworkError;
  return (
    err.code === 'ECONNABORTED' ||
    err.code === 'ENOTFOUND' ||
    err.code === 'ECONNREFUSED' ||
    err.message?.includes('Network Error') ||
    !isOnline()
  );
}

export async function retryRequest<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: unknown;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry if it's not a network error
      if (!detectNetworkError(error)) {
        throw error;
      }

      // Wait before retrying
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    }
  }

  throw lastError;
}

