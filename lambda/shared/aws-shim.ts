import { APIGatewayProxyEvent, APIGatewayProxyResult, APIGatewayProxyEventV2 } from 'aws-lambda';

// Type guard to check if event is v2 format
function isV2Event(event: any): event is APIGatewayProxyEventV2 {
    return 'version' in event && event.version === '2.0';
}

// Helper to convert Lambda event to Web Standard Request
function createRequest(event: APIGatewayProxyEvent | APIGatewayProxyEventV2): Request {
    const headers = new Headers();

    // Handle both v1 and v2 event formats
    const eventHeaders = isV2Event(event) ? event.headers : event.headers;
    if (eventHeaders) {
        for (const [key, value] of Object.entries(eventHeaders)) {
            if (value) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
        }
    }

    const method = isV2Event(event)
        ? event.requestContext.http.method
        : (event.httpMethod || 'GET');

    // Handle body - could be base64 encoded or plain text
    let body: string | null = null;
    if (event.body) {
        if (event.isBase64Encoded) {
            body = Buffer.from(event.body, 'base64').toString('utf-8');
        } else {
            body = event.body;
        }
    }

    // Construct URL
    const host = isV2Event(event)
        ? event.requestContext.domainName
        : (event.headers?.Host || event.headers?.host || 'localhost');
    const path = isV2Event(event)
        ? event.rawPath
        : event.path;
    const url = `https://${host}${path}`;

    const init: RequestInit = {
        method,
        headers,
        body: (method === 'GET' || method === 'HEAD') ? null : body
    };

    return new Request(url, init);
}

// The serve function compatible with the existing Deno code style, 
// but returning an AWS Lambda handler
export function serve(handler: (req: Request) => Promise<Response>) {
    return async (event: any): Promise<APIGatewayProxyResult> => {
        try {
            // Log the COMPLETE raw event for debugging
            console.log('[AWS Shim] COMPLETE Raw event:', JSON.stringify(event, null, 2));

            // Check if this is a direct Lambda invocation (Function URL or direct invoke)
            // vs an API Gateway proxy event
            const isDirectInvoke = !('httpMethod' in event) && !('requestContext' in event);

            let req: Request;

            if (isDirectInvoke) {
                // Direct Lambda invocation - event IS the body
                console.log('[AWS Shim] Detected direct Lambda invocation (Function URL)');

                // Create a synthetic Request object
                const bodyString = typeof event === 'string' ? event : JSON.stringify(event);
                req = new Request('https://lambda-function-url/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: bodyString,
                });
            } else {
                // API Gateway proxy event
                console.log('[AWS Shim] Detected API Gateway proxy event');
                req = createRequest(event);
            }

            const res = await handler(req);

            const responseHeaders: Record<string, string> = {};
            res.headers.forEach((value, key) => {
                responseHeaders[key] = value;
            });

            return {
                statusCode: res.status,
                headers: responseHeaders,
                body: await res.text(),
            };
        } catch (err: any) {
            console.error('[AWS Shim] Error in lambda handler:', err);
            console.error('[AWS Shim] Error stack:', err.stack);
            return {
                statusCode: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({ error: err.message || 'Internal Server Error' }),
            };
        }
    };
}
