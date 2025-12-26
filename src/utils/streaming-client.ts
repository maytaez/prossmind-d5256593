/**
 * Streaming Client
 * Handles Server-Sent Events (SSE) streaming with automatic routing
 * to Lambda or Supabase based on feature flag
 */

import { featureFlags } from '@/config/featureFlags';
import { getLambdaEndpoint, isLambdaConfigured } from '@/config/lambdaConfig';

/**
 * Streaming options
 */
export interface StreamingOptions {
    onChunk: (chunk: string) => void;
    onComplete?: () => void;
    onError?: (error: Error) => void;
    headers?: Record<string, string>;
}

/**
 * Invoke streaming function with automatic routing to Lambda or Supabase
 * Handles Server-Sent Events (SSE) format
 * 
 * @param functionName - Name of the function to invoke
 * @param body - Request body
 * @param options - Streaming callbacks and options
 * 
 * @example
 * ```typescript
 * await invokeStreamingFunction('chatbot', 
 *   { messages: [...] },
 *   {
 *     onChunk: (chunk) => console.log('Received:', chunk),
 *     onComplete: () => console.log('Stream complete'),
 *     onError: (err) => console.error('Stream error:', err),
 *   }
 * );
 * ```
 */
export async function invokeStreamingFunction(
    functionName: string,
    body: any,
    options: StreamingOptions
): Promise<void> {
    const { onChunk, onComplete, onError, headers = {} } = options;

    try {
        // Determine endpoint URL based on feature flag
        let url: string;
        let requestHeaders: Record<string, string>;

        if (featureFlags.USE_LAMBDA && isLambdaConfigured()) {
            // Lambda streaming endpoint
            url = getLambdaEndpoint(functionName);
            requestHeaders = {
                'Content-Type': 'application/json',
                ...headers,
            };
            console.log(`[Streaming] Routing ${functionName} to Lambda`);
        } else {
            // Supabase streaming endpoint
            url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`;
            requestHeaders = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                ...headers,
            };
            console.log(`[Streaming] Routing ${functionName} to Supabase Edge Functions`);
        }

        // Make streaming request
        const response = await fetch(url, {
            method: 'POST',
            headers: requestHeaders,
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            throw new Error(`Streaming failed (${response.status}): ${errorText}`);
        }

        if (!response.body) {
            throw new Error('No response body available for streaming');
        }

        // Process SSE stream
        await processSSEStream(response.body, onChunk, onComplete);

    } catch (error) {
        console.error(`[Streaming] Error for ${functionName}:`, error);
        if (onError) {
            onError(error instanceof Error ? error : new Error('Unknown streaming error'));
        } else {
            throw error;
        }
    }
}

/**
 * Process Server-Sent Events (SSE) stream
 * Handles the SSE format: "data: {json}\n\n"
 */
async function processSSEStream(
    body: ReadableStream<Uint8Array>,
    onChunk: (chunk: string) => void,
    onComplete?: () => void
): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
        while (true) {
            const { done, value } = await reader.read();

            if (done) {
                console.log('[Streaming] Stream ended');
                break;
            }

            // Decode chunk and add to buffer
            buffer += decoder.decode(value, { stream: true });

            // Process complete lines in buffer
            let newlineIndex: number;
            while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
                const line = buffer.slice(0, newlineIndex);
                buffer = buffer.slice(newlineIndex + 1);

                // Remove carriage return if present
                const cleanLine = line.endsWith('\r') ? line.slice(0, -1) : line;

                // Skip empty lines and comments
                if (cleanLine.trim() === '' || cleanLine.startsWith(':')) {
                    continue;
                }

                // Parse SSE data line
                if (cleanLine.startsWith('data: ')) {
                    const data = cleanLine.slice(6).trim();

                    // Check for stream end marker
                    if (data === '[DONE]') {
                        console.log('[Streaming] Received [DONE] marker');
                        if (onComplete) {
                            onComplete();
                        }
                        return;
                    }

                    // Parse JSON data
                    try {
                        const parsed = JSON.parse(data);

                        // Extract content from OpenAI-style streaming format
                        const content = parsed.choices?.[0]?.delta?.content;

                        if (content) {
                            onChunk(content);
                        } else if (typeof parsed === 'string') {
                            // Direct string content
                            onChunk(parsed);
                        } else if (parsed.content) {
                            // Alternative format
                            onChunk(parsed.content);
                        }
                    } catch (parseError) {
                        // If JSON parsing fails, treat as raw text
                        console.warn('[Streaming] Failed to parse JSON, treating as raw text:', data);
                        onChunk(data);
                    }
                }
            }
        }

        // Stream completed naturally
        if (onComplete) {
            onComplete();
        }

    } catch (error) {
        console.error('[Streaming] Stream processing error:', error);
        throw error;
    } finally {
        reader.releaseLock();
    }
}

/**
 * Invoke streaming function with automatic fallback
 * If Lambda fails, automatically falls back to Supabase
 * 
 * @param functionName - Name of the function to invoke
 * @param body - Request body
 * @param options - Streaming callbacks and options
 */
export async function invokeStreamingFunctionWithFallback(
    functionName: string,
    body: any,
    options: StreamingOptions
): Promise<void> {
    const { onError, ...restOptions } = options;

    // Try Lambda first if enabled
    if (featureFlags.USE_LAMBDA && isLambdaConfigured()) {
        try {
            await invokeStreamingFunction(functionName, body, {
                ...restOptions,
                onError: undefined, // Don't call user's onError yet
            });
            return; // Success!
        } catch (lambdaError) {
            console.warn(`[Streaming Fallback] Lambda failed for ${functionName}, trying Supabase`);
            console.error('[Streaming Fallback] Lambda error:', lambdaError);

            // Temporarily disable Lambda for fallback
            const originalFlag = featureFlags.USE_LAMBDA;
            (featureFlags as any).USE_LAMBDA = false;

            try {
                await invokeStreamingFunction(functionName, body, {
                    ...restOptions,
                    onError,
                });
                console.log(`[Streaming Fallback] ✓ Supabase succeeded for ${functionName}`);
                return;
            } catch (supabaseError) {
                console.error(`[Streaming Fallback] ✗ Supabase also failed for ${functionName}`);
                if (onError) {
                    onError(lambdaError instanceof Error ? lambdaError : new Error('Streaming failed'));
                }
            } finally {
                // Restore original flag
                (featureFlags as any).USE_LAMBDA = originalFlag;
            }
        }
    } else {
        // Use Supabase directly
        await invokeStreamingFunction(functionName, body, options);
    }
}
