/**
 * API client wrapper with request deduplication and error handling
 * Supports routing to either Supabase Edge Functions or AWS Lambda with automatic fallback
 */

import { supabase } from '@/integrations/supabase/client';
import { deduplicateRequest, generateRequestKey } from './request-deduplication';
import { featureFlags } from '@/config/featureFlags';
import { getLambdaEndpoint, isLambdaConfigured } from '@/config/lambdaConfig';

export interface ApiResponse<T = any> {
  data?: T;
  error?: {
    message: string;
    code?: string;
  };
}

export interface InvocationOptions {
  deduplicate?: boolean;
  timeout?: number;
  fallbackToSupabase?: boolean;
  retryOnFailure?: boolean;
}

export interface InvocationMetrics {
  backend: 'lambda' | 'supabase';
  duration: number;
  success: boolean;
  fallbackUsed: boolean;
  functionName: string;
}

/**
 * Circuit Breaker Pattern Implementation
 * Prevents cascading failures by tracking Lambda errors and automatically
 * switching to Supabase when Lambda is experiencing issues
 */
class CircuitBreaker {
  private failures = new Map<string, number>();
  private lastFailure = new Map<string, number>();
  private readonly threshold = 5; // Open circuit after 5 consecutive failures
  private readonly timeout = 5 * 60 * 1000; // 5 minutes

  /**
   * Check if Lambda should be used for this function
   * Returns false if circuit is open (too many recent failures)
   */
  shouldUseLambda(functionName: string): boolean {
    const failures = this.failures.get(functionName) || 0;
    const lastFail = this.lastFailure.get(functionName) || 0;

    if (failures >= this.threshold) {
      const timeSinceLastFailure = Date.now() - lastFail;
      if (timeSinceLastFailure < this.timeout) {
        console.warn(
          `[Circuit Breaker] Circuit OPEN for ${functionName} (${failures} failures, ${Math.round(timeSinceLastFailure / 1000)}s ago)`
        );
        return false; // Circuit open, don't use Lambda
      }
      // Timeout expired, try Lambda again (half-open state)
      console.log(`[Circuit Breaker] Circuit HALF-OPEN for ${functionName}, attempting Lambda`);
      this.reset(functionName);
    }
    return true;
  }

  /**
   * Record a Lambda failure for this function
   */
  recordFailure(functionName: string): void {
    const currentFailures = (this.failures.get(functionName) || 0) + 1;
    this.failures.set(functionName, currentFailures);
    this.lastFailure.set(functionName, Date.now());

    if (currentFailures >= this.threshold) {
      console.error(
        `[Circuit Breaker] Circuit OPENED for ${functionName} after ${currentFailures} failures`
      );
    }
  }

  /**
   * Record a Lambda success for this function
   * Resets the circuit breaker
   */
  recordSuccess(functionName: string): void {
    const hadFailures = this.failures.has(functionName);
    if (hadFailures) {
      console.log(`[Circuit Breaker] Circuit CLOSED for ${functionName} after successful call`);
    }
    this.reset(functionName);
  }

  /**
   * Reset failure tracking for this function
   */
  private reset(functionName: string): void {
    this.failures.delete(functionName);
    this.lastFailure.delete(functionName);
  }

  /**
   * Get current circuit state for monitoring
   */
  getState(functionName: string): { failures: number; isOpen: boolean } {
    const failures = this.failures.get(functionName) || 0;
    const isOpen = failures >= this.threshold;
    return { failures, isOpen };
  }
}

// Global circuit breaker instance
const circuitBreaker = new CircuitBreaker();

/**
 * Invoke function via AWS Lambda
 */
async function invokeLambdaFunction<T = any>(
  functionName: string,
  body: Record<string, unknown>,
  timeout: number
): Promise<ApiResponse<T>> {
  try {
    const endpoint = getLambdaEndpoint(functionName);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
      return {
        error: {
          message: errorData.message || `Lambda function failed with status ${response.status}`,
          code: response.status.toString(),
        },
      };
    }

    const responseData = await response.json();

    // API Gateway wraps the response in {statusCode, headers, body}
    // The actual data is in the body field as a JSON string
    if (responseData.statusCode && responseData.body) {
      const actualData = JSON.parse(responseData.body);

      // Check if the Lambda returned an error
      if (responseData.statusCode >= 400) {
        return {
          error: {
            message: actualData.error || 'Lambda function error',
            code: responseData.statusCode.toString(),
          },
        };
      }

      return { data: actualData };
    }

    // Direct response (not wrapped by API Gateway)
    return { data: responseData };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return {
        error: {
          message: 'Request timeout',
          code: 'TIMEOUT',
        },
      };
    }
    return {
      error: {
        message: err instanceof Error ? err.message : 'Unknown error',
      },
    };
  }
}

/**
 * Invoke function via Supabase Edge Functions
 */
async function invokeSupabaseFunction<T = any>(
  functionName: string,
  body: Record<string, unknown>,
  timeout: number
): Promise<ApiResponse<T>> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const { data, error } = await supabase.functions.invoke(functionName, {
      body,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (error) {
      return {
        error: {
          message: error.message || 'Unknown error',
          code: error.status?.toString(),
        },
      };
    }

    return { data };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return {
        error: {
          message: 'Request timeout',
          code: 'TIMEOUT',
        },
      };
    }
    return {
      error: {
        message: err instanceof Error ? err.message : 'Unknown error',
      },
    };
  }
}

/**
 * Invoke function with automatic routing to Lambda or Supabase based on feature flag
 * Includes circuit breaker protection and automatic fallback on Lambda failures
 */
export async function invokeFunction<T = any>(
  functionName: string,
  body: Record<string, unknown>,
  options?: InvocationOptions
): Promise<ApiResponse<T>> {
  const {
    deduplicate = true,
    timeout = 60000,
    fallbackToSupabase = true,
    // retryOnFailure reserved for future retry logic implementation
  } = options || {};

  const startTime = Date.now();

  const requestFn = async (): Promise<ApiResponse<T>> => {
    let useLambda: boolean = featureFlags.USE_LAMBDA;
    let fallbackUsed = false;

    // Circuit breaker check - prevent using Lambda if it's experiencing issues
    if (useLambda && !circuitBreaker.shouldUseLambda(functionName)) {
      console.warn(`[Circuit Breaker] Skipping Lambda for ${functionName}, using Supabase`);
      useLambda = false;
      fallbackUsed = true;
    }

    // Try Lambda first (if enabled and circuit is closed)
    if (useLambda) {
      // Verify Lambda is configured
      if (!isLambdaConfigured()) {
        console.warn(
          `[Lambda] USE_LAMBDA enabled but not configured. Falling back to Supabase for ${functionName}`
        );
        return invokeSupabaseFunction<T>(functionName, body, timeout);
      }

      console.log(`[Lambda] Routing ${functionName} to Lambda`);
      const lambdaResult = await invokeLambdaFunction<T>(functionName, body, timeout);

      // Lambda call failed
      if (lambdaResult.error) {
        console.error(`[Lambda] Error for ${functionName}:`, lambdaResult.error.message);
        circuitBreaker.recordFailure(functionName);

        // Attempt fallback to Supabase if enabled
        if (fallbackToSupabase) {
          console.warn(`[Fallback] Lambda failed for ${functionName}, attempting Supabase fallback`);
          const fallbackResult = await invokeSupabaseFunction<T>(functionName, body, timeout);

          if (!fallbackResult.error) {
            console.log(`[Fallback] ✓ Supabase succeeded for ${functionName}`);
            fallbackUsed = true;

            // Log metrics
            logInvocationMetrics({
              backend: 'supabase',
              duration: Date.now() - startTime,
              success: true,
              fallbackUsed: true,
              functionName,
            });

            return fallbackResult;
          } else {
            console.error(`[Fallback] ✗ Supabase also failed for ${functionName}:`, fallbackResult.error.message);
          }
        }

        // Return Lambda error if fallback disabled or also failed
        logInvocationMetrics({
          backend: 'lambda',
          duration: Date.now() - startTime,
          success: false,
          fallbackUsed: false,
          functionName,
        });

        return lambdaResult;
      }

      // Lambda call succeeded
      console.log(`[Lambda] ✓ Success for ${functionName}`);
      circuitBreaker.recordSuccess(functionName);

      logInvocationMetrics({
        backend: 'lambda',
        duration: Date.now() - startTime,
        success: true,
        fallbackUsed: false,
        functionName,
      });

      return lambdaResult;
    }

    // Use Supabase Edge Functions (either by choice or fallback)
    console.log(`[Supabase] Routing ${functionName} to Supabase Edge Functions`);
    const supabaseResult = await invokeSupabaseFunction<T>(functionName, body, timeout);

    logInvocationMetrics({
      backend: 'supabase',
      duration: Date.now() - startTime,
      success: !supabaseResult.error,
      fallbackUsed,
      functionName,
    });

    return supabaseResult;
  };

  if (deduplicate) {
    const key = generateRequestKey(functionName, body);
    return deduplicateRequest(key, requestFn);
  }

  return requestFn();
}

/**
 * Log invocation metrics for observability
 * Can be extended to send to analytics service
 */
function logInvocationMetrics(metrics: InvocationMetrics): void {
  const logLevel = metrics.success ? 'log' : 'error';
  console[logLevel]('[Metrics]', {
    function: metrics.functionName,
    backend: metrics.backend,
    duration: `${metrics.duration}ms`,
    success: metrics.success,
    fallback: metrics.fallbackUsed,
  });

  // TODO: Send to analytics service (e.g., CloudWatch, DataDog, etc.)
  // Example: sendToAnalytics(metrics);
}

/**
 * Get circuit breaker state for a function (for debugging/monitoring)
 */
export function getCircuitBreakerState(functionName: string): { failures: number; isOpen: boolean } {
  return circuitBreaker.getState(functionName);
}


