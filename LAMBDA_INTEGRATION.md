# Lambda Integration Feature Flag

This document explains how to use the `USE_LAMBDA` feature flag to route all API calls to AWS Lambda instead of Supabase Edge Functions.

## Overview

The `USE_LAMBDA` feature flag allows you to seamlessly switch between Supabase Edge Functions and AWS Lambda for all backend API calls. This is useful for:

- Testing Lambda integration
- Performance comparison between Supabase and Lambda
- Gradual migration from Supabase to Lambda
- A/B testing different backend implementations

## Configuration

### 1. Enable the Feature Flag

The feature flag is located in `src/config/featureFlags.ts`:

```typescript
export const featureFlags = {
  // ... other flags
  USE_LAMBDA: true,  // Set to true to use Lambda, false for Supabase
} as const;
```

### 2. Set Lambda API Gateway URL

Add your Lambda API Gateway endpoint URL to your `.env` file:

```bash
VITE_LAMBDA_API_URL=https://your-api-id.execute-api.us-east-1.amazonaws.com/Prod
```

You can find this URL in:
- AWS CloudFormation Outputs after deploying your Lambda stack
- AWS API Gateway console
- The output of `sam deploy` command

### 3. Deploy Lambda Functions

Make sure all Lambda functions are deployed using AWS SAM:

```bash
# Build and deploy all Lambda functions
sam build
sam deploy --guided
```

## How It Works

### Centralized API Client

All API calls go through the centralized `invokeFunction` in `src/utils/api-client.ts`:

```typescript
import { invokeFunction } from '@/utils/api-client';

// This will automatically route to Lambda or Supabase based on the feature flag
const { data, error } = await invokeFunction('generate-bpmn', {
  prompt: 'Create a customer onboarding process',
  diagramType: 'bpmn'
});
```

### Automatic Routing

When `USE_LAMBDA = true`:
1. The API client checks if Lambda is configured (VITE_LAMBDA_API_URL is set)
2. If configured, it routes the call to Lambda API Gateway
3. If not configured, it falls back to Supabase Edge Functions with a warning

When `USE_LAMBDA = false`:
- All calls go directly to Supabase Edge Functions

### Function Mapping

The mapping between function names and Lambda endpoints is defined in `src/config/lambdaConfig.ts`:

```typescript
export const LAMBDA_FUNCTION_PATHS: Record<string, string> = {
  'generate-bpmn': '/generate-bpmn',
  'generate-bpmn-combined': '/generate-bpmn-combined',
  'refine-bpmn': '/refine-bpmn',
  // ... more functions
};
```

## Supported Functions

The following functions support Lambda routing:

### BPMN Generation
- `generate-bpmn` - Generate BPMN diagrams from text prompts
- `generate-bpmn-combined` - Generate multiple BPMN diagrams for complex workflows
- `refine-bpmn` - Refine existing BPMN diagrams
- `process-bpmn-job` - Process BPMN generation jobs asynchronously

### Document Analysis
- `analyze-document-to-bpmn` - Analyze documents and generate BPMN
- `vision-to-bpmn` - Convert images to BPMN diagrams
- `screen-recording-to-bpmn` - Convert screen recordings to BPMN
- `speech-to-text` - Convert speech to text

### DMN Functions
- `generate-dmn` - Generate DMN decision tables
- `refine-dmn` - Refine DMN decision tables

### Dashboard & Analytics
- `bpmn-dashboard-api` - BPMN dashboard API
- `bottleneck-metrics` - Calculate bottleneck metrics

### Other
- `chatbot` - AI chatbot
- `track-visitor` - Track visitor analytics

## Testing

### 1. Test Lambda Integration

1. Enable the feature flag: `USE_LAMBDA: true`
2. Set your Lambda API URL in `.env`
3. Test each function to ensure it works correctly
4. Check browser console for routing logs:
   - `[Lambda] Routing function-name to Lambda`
   - `[Supabase] Routing function-name to Supabase Edge Functions`

### 2. Compare Performance

You can compare performance by:
1. Testing with `USE_LAMBDA: false` (Supabase)
2. Testing with `USE_LAMBDA: true` (Lambda)
3. Comparing response times and error rates

### 3. Fallback Testing

Test the fallback behavior:
1. Set `USE_LAMBDA: true`
2. Don't set `VITE_LAMBDA_API_URL`
3. Verify that calls fall back to Supabase with a console warning

## Debugging

### Console Logs

The API client logs all routing decisions:

```
[Lambda] Routing generate-bpmn to Lambda
```

or

```
[Supabase] Routing generate-bpmn to Supabase Edge Functions
```

### Common Issues

**Issue**: "VITE_LAMBDA_API_URL environment variable is not set"
- **Solution**: Add the Lambda API URL to your `.env` file

**Issue**: "No Lambda endpoint configured for function: xyz"
- **Solution**: Add the function mapping to `LAMBDA_FUNCTION_PATHS` in `lambdaConfig.ts`

**Issue**: Lambda function returns 404
- **Solution**: Verify the function is deployed and the path is correct in `template.yaml`

**Issue**: CORS errors
- **Solution**: Check that CORS is properly configured in `template.yaml` API Gateway settings

## Migration Checklist

When migrating from Supabase to Lambda:

- [ ] Deploy all Lambda functions using SAM
- [ ] Get Lambda API Gateway URL from CloudFormation outputs
- [ ] Add `VITE_LAMBDA_API_URL` to `.env`
- [ ] Enable `USE_LAMBDA` feature flag
- [ ] Test all critical functions
- [ ] Monitor error rates and performance
- [ ] Update production environment variables
- [ ] Deploy frontend with Lambda configuration

## Rollback

To rollback to Supabase Edge Functions:

1. Set `USE_LAMBDA: false` in `src/config/featureFlags.ts`
2. Deploy the frontend
3. All calls will automatically route back to Supabase

No backend changes are required for rollback.

## Architecture

```
Frontend Component
       ↓
invokeFunction (api-client.ts)
       ↓
   Feature Flag Check (USE_LAMBDA)
       ↓
   ┌─────────┴─────────┐
   ↓                   ↓
Lambda            Supabase
API Gateway       Edge Functions
   ↓                   ↓
Lambda Function   Edge Function
```

## Best Practices

1. **Always test locally first**: Test Lambda integration in development before enabling in production
2. **Monitor logs**: Watch console logs to verify correct routing
3. **Gradual rollout**: Consider using the feature flag for gradual rollout (e.g., enable for specific users)
4. **Keep both backends in sync**: Ensure Lambda and Supabase functions have the same functionality during migration
5. **Document changes**: Update this document when adding new functions or changing configuration

## Support

For issues or questions:
1. Check the console logs for routing information
2. Verify environment variables are set correctly
3. Ensure Lambda functions are deployed
4. Check AWS CloudWatch logs for Lambda errors
