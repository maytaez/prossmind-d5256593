/**
 * Performance metrics logging utility
 */

// Supabase interactions removed as per requirement: Lambdas should not call Supabase directly.

export interface PerformanceMetric {
  function_name: string;
  cache_type: 'exact_hash' | 'semantic' | 'none';
  model_used?: string;
  prompt_length?: number;
  complexity_score?: number;
  response_time_ms: number;
  token_usage?: number;
  cache_hit: boolean;
  similarity_score?: number;
  error_occurred: boolean;
  error_message?: string;
}

/**
 * Log performance metrics to database
 */
export async function logPerformanceMetric(metric: PerformanceMetric): Promise<void> {
  console.log('[METRICS] Performance metric (local-only):', {
    function_name: metric.function_name,
    cache_hit: metric.cache_hit,
    response_time_ms: metric.response_time_ms
  });
}

/**
 * Measure execution time of an async function
 */
export async function measureExecutionTime<T>(
  fn: () => Promise<T>,
  _functionName: string
): Promise<{ result: T; durationMs: number }> {
  const startTime = Date.now();
  try {
    const result = await fn();
    const durationMs = Date.now() - startTime;
    return { result, durationMs };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    throw { error, durationMs, functionName: _functionName };
  }
}
