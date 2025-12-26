import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

// Cache for API key to avoid multiple Secrets Manager calls
let cachedGoogleApiKey: string | null = null;

/**
 * Fetch Google API Key from AWS Secrets Manager
 * Results are cached to avoid repeated calls
 */
export async function getGoogleApiKey(): Promise<string> {
    // Return cached value if available
    if (cachedGoogleApiKey) {
        return cachedGoogleApiKey;
    }

    const secretName = process.env.GOOGLE_API_KEY_SECRET_NAME || 'prossmind/google-api-key';
    const region = process.env.AWS_REGION || 'eu-central-2';

    const client = new SecretsManagerClient({ region });

    try {
        const response = await client.send(
            new GetSecretValueCommand({
                SecretId: secretName,
            })
        );

        if (!response.SecretString) {
            throw new Error('Secret value is empty');
        }

        // Parse the secret - it could be a plain string or JSON
        let apiKey: string;
        try {
            const parsed = JSON.parse(response.SecretString);
            // If it's JSON, assume the key is stored under 'apiKey' or 'GOOGLE_API_KEY'
            apiKey = parsed.apiKey || parsed.GOOGLE_API_KEY || parsed.google_api_key;
            if (!apiKey) {
                throw new Error('API key not found in secret JSON');
            }
        } catch {
            // If not JSON, treat as plain string
            apiKey = response.SecretString;
        }

        // Cache the value
        cachedGoogleApiKey = apiKey;
        console.log('[Secrets Manager] Successfully fetched Google API Key');

        return apiKey;
    } catch (error) {
        console.error('[Secrets Manager] Failed to fetch Google API Key:', error);
        throw new Error(`Failed to fetch Google API Key from Secrets Manager: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
