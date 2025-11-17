/**
 * Request deduplication utility to prevent duplicate API calls
 */

interface PendingRequest<T> {
  promise: Promise<T>;
  timestamp: number;
}

const pendingRequests = new Map<string, PendingRequest<any>>();
const REQUEST_TIMEOUT = 60000; // 1 minute

/**
 * Deduplicate requests - if a request with the same key is already pending, return that promise
 */
export function deduplicateRequest<T>(
  key: string,
  requestFn: () => Promise<T>
): Promise<T> {
  const existing = pendingRequests.get(key);

  // If request exists and is recent, return existing promise
  if (existing && Date.now() - existing.timestamp < REQUEST_TIMEOUT) {
    return existing.promise;
  }

  // Create new request
  const promise = requestFn().finally(() => {
    // Clean up after request completes
    pendingRequests.delete(key);
  });

  pendingRequests.set(key, {
    promise,
    timestamp: Date.now(),
  });

  return promise;
}

/**
 * Clear all pending requests (useful for cleanup)
 */
export function clearPendingRequests(): void {
  pendingRequests.clear();
}

/**
 * Generate a cache key from request parameters
 */
export function generateRequestKey(
  functionName: string,
  params: Record<string, unknown>
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${key}:${JSON.stringify(params[key])}`)
    .join('|');
  return `${functionName}:${sortedParams}`;
}




