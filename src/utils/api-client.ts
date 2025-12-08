/**
 * API client wrapper with request deduplication and error handling
 */

import { supabase } from '@/integrations/supabase/client';
import { deduplicateRequest, generateRequestKey } from './request-deduplication';

export interface ApiResponse<T = any> {
  data?: T;
  error?: {
    message: string;
    code?: string;
  };
}

/**
 * Invoke Supabase function with deduplication
 */
export async function invokeFunction<T = any>(
  functionName: string,
  body: Record<string, unknown>,
  options?: {
    deduplicate?: boolean;
    timeout?: number;
  }
): Promise<ApiResponse<T>> {
  const { deduplicate = true, timeout = 60000 } = options || {};

  const requestFn = async (): Promise<ApiResponse<T>> => {
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
  };

  if (deduplicate) {
    const key = generateRequestKey(functionName, body);
    return deduplicateRequest(key, requestFn);
  }

  return requestFn();
}





