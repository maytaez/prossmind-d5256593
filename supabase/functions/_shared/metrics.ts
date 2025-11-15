/**
 * Performance metrics logging utility
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.0';

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
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('[METRICS] Supabase credentials not configured:', {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseKey,
        availableEnvVars: Object.keys(Deno.env.toObject()).filter(k => k.includes('SUPABASE'))
      });
      return;
    }

    console.log('[METRICS] Logging performance metric:', {
      function_name: metric.function_name,
      cache_type: metric.cache_type,
      cache_hit: metric.cache_hit,
      response_time_ms: metric.response_time_ms
    });

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from('performance_metrics')
      .insert({
        function_name: metric.function_name,
        cache_type: metric.cache_type,
        model_used: metric.model_used,
        prompt_length: metric.prompt_length,
        complexity_score: metric.complexity_score,
        response_time_ms: metric.response_time_ms,
        token_usage: metric.token_usage,
        cache_hit: metric.cache_hit,
        similarity_score: metric.similarity_score,
        error_occurred: metric.error_occurred,
        error_message: metric.error_message,
      })
      .select();

    if (error) {
      console.error('[METRICS] Failed to log performance metric:', {
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        metric: {
          function_name: metric.function_name,
          cache_type: metric.cache_type
        }
      });
    } else {
      console.log('[METRICS] Successfully logged performance metric:', data?.[0]?.id);
    }
  } catch (error) {
    // Don't throw - metrics logging should not break the main flow
    console.error('[METRICS] Exception logging performance metric:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      metric: {
        function_name: metric.function_name,
        cache_type: metric.cache_type
      }
    });
  }
}

/**
 * Measure execution time of an async function
 */
export async function measureExecutionTime<T>(
  fn: () => Promise<T>,
  functionName: string
): Promise<{ result: T; durationMs: number }> {
  const startTime = Date.now();
  try {
    const result = await fn();
    const durationMs = Date.now() - startTime;
    return { result, durationMs };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    throw { error, durationMs, functionName };
  }
}

