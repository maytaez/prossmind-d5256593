/**
 * AWS Lambda Configuration
 * Maps Supabase Edge Function names to Lambda API Gateway endpoints
 */

// Get Lambda API base URL from environment variable
const LAMBDA_API_URL = import.meta.env.VITE_LAMBDA_API_URL || '';

// Function name mapping: Supabase Edge Function name -> Lambda API path
export const LAMBDA_FUNCTION_PATHS: Record<string, string> = {
    // BPMN Generation Functions
    'generate-bpmn': '/generate-bpmn',
    'generate-bpmn-combined': '/generate-bpmn-combined',
    'refine-bpmn': '/refine-bpmn',
    'process-bpmn-job': '/process-bpmn-job',

    // Document Analysis Functions
    'analyze-document-to-bpmn': '/analyze-document-to-bpmn',
    'vision-to-bpmn': '/vision-to-bpmn',
    'screen-recording-to-bpmn': '/screen-recording-to-bpmn',
    'speech-to-text': '/speech-to-text',

    // DMN Functions
    'generate-dmn': '/generate-dmn',
    'refine-dmn': '/refine-dmn',

    // Dashboard & Analytics Functions
    'bpmn-dashboard-api': '/bpmn-dashboard-api',
    'bottleneck-metrics': '/bottleneck-metrics',

    // Chatbot Function
    'chatbot': '/chatbot',

    // Tracking Function
    'track-visitor': '/track-visitor',
};

/**
 * Get the full Lambda endpoint URL for a given function name
 */
export function getLambdaEndpoint(functionName: string): string {
    const path = LAMBDA_FUNCTION_PATHS[functionName];
    if (!path) {
        throw new Error(`No Lambda endpoint configured for function: ${functionName}`);
    }

    if (!LAMBDA_API_URL) {
        throw new Error('VITE_LAMBDA_API_URL environment variable is not set. Please configure Lambda API Gateway URL.');
    }

    // Remove trailing slash from base URL if present
    const baseUrl = LAMBDA_API_URL.replace(/\/$/, '');

    // AWS HTTP API Gateway URL structure: https://xxx.execute-api.region.amazonaws.com/function-name
    // HTTP APIs do not use stage prefixes in the URL path
    return `${baseUrl}/prod${path}`;
}

/**
 * Check if Lambda configuration is valid
 */
export function isLambdaConfigured(): boolean {
    return !!LAMBDA_API_URL && LAMBDA_API_URL.trim().length > 0;
}

/**
 * Get Lambda API base URL
 */
export function getLambdaApiUrl(): string {
    return LAMBDA_API_URL;
}
