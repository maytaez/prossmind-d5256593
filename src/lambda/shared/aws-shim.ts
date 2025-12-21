
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

// Helper to convert Lambda event to Web Standard Request
function createRequest(event: APIGatewayProxyEvent): Request {
    const headers = new Headers();
    if (event.headers) {
        for (const [key, value] of Object.entries(event.headers)) {
            if (value) headers.set(key, value);
        }
    }

    const method = event.httpMethod || 'GET';
    const body = event.body ? (event.isBase64Encoded ? Buffer.from(event.body, 'base64') : event.body) : null;

    // Construct URL (approximate)
    const url = `https://${event.headers?.Host || 'localhost'}${event.path}`;

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
    return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
        try {
            const req = createRequest(event);
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
            console.error('Error in lambda handler:', err);
            return {
                statusCode: 500,
                body: JSON.stringify({ error: err.message || 'Internal Server Error' }),
            };
        }
    };
}
