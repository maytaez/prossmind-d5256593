/**
 * Dashboard API Client
 * Centralized wrapper for dashboard/analytics API calls with automatic routing
 * to Lambda or Supabase based on feature flag
 */

import { supabase } from '@/integrations/supabase/client';
import { featureFlags } from '@/config/featureFlags';
import { getLambdaEndpoint, isLambdaConfigured } from '@/config/lambdaConfig';

/**
 * Dashboard API response type
 */
export interface DashboardApiResponse<T = any> {
    data?: T;
    error?: {
        message: string;
        code?: string;
    };
}

/**
 * Invoke dashboard API endpoint with automatic routing to Lambda or Supabase
 * 
 * @param endpoint - API endpoint path (e.g., '/metrics/overview', '/analytics/daily')
 * @param options - Optional fetch options
 * @returns Promise with typed response data
 * 
 * @example
 * ```typescript
 * const metrics = await invokeDashboardApi<MetricsData>('/metrics/overview');
 * if (metrics.error) {
 *   console.error('Failed to fetch metrics:', metrics.error.message);
 * } else {
 *   console.log('Metrics:', metrics.data);
 * }
 * ```
 */
export async function invokeDashboardApi<T = any>(
    endpoint: string,
    options?: RequestInit
): Promise<DashboardApiResponse<T>> {
    try {
        // Get authentication session
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            return {
                error: {
                    message: 'Not authenticated',
                    code: 'AUTH_REQUIRED',
                },
            };
        }

        // Determine endpoint URL based on feature flag
        let url: string;

        if (featureFlags.USE_LAMBDA && isLambdaConfigured()) {
            // Lambda endpoint
            const lambdaBase = getLambdaEndpoint('bpmn-dashboard-api');
            url = `${lambdaBase}${endpoint}`;
            console.log(`[Dashboard API] Routing to Lambda: ${endpoint}`);
        } else {
            // Supabase endpoint
            url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bpmn-dashboard-api${endpoint}`;
            console.log(`[Dashboard API] Routing to Supabase: ${endpoint}`);
        }

        // Make request with authentication
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options?.headers,
                'Authorization': `Bearer ${session.access_token}`,
            },
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            let errorMessage: string;

            try {
                const errorJson = JSON.parse(errorText);
                errorMessage = errorJson.message || errorJson.error || errorText;
            } catch {
                errorMessage = errorText || `Dashboard API error: ${response.statusText}`;
            }

            return {
                error: {
                    message: errorMessage,
                    code: response.status.toString(),
                },
            };
        }

        const data = await response.json();
        return { data };

    } catch (err) {
        return {
            error: {
                message: err instanceof Error ? err.message : 'Unknown error occurred',
                code: 'NETWORK_ERROR',
            },
        };
    }
}

/**
 * Export dashboard data as CSV
 * 
 * @param filters - Optional filters for the export
 * @returns Promise with blob data for download
 */
export async function exportDashboardData(filters?: {
    startDate?: string;
    endDate?: string;
    status?: string;
    diagramType?: string;
}): Promise<Blob | null> {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            throw new Error('Not authenticated');
        }

        let url: string;

        if (featureFlags.USE_LAMBDA && isLambdaConfigured()) {
            url = `${getLambdaEndpoint('bpmn-dashboard-api')}/export`;
        } else {
            url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bpmn-dashboard-api/export`;
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify(filters || {}),
        });

        if (!response.ok) {
            throw new Error(`Export failed: ${response.statusText}`);
        }

        return await response.blob();
    } catch (err) {
        console.error('Dashboard export error:', err);
        return null;
    }
}
