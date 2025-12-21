# AWS Lambda Functions

This directory contains the Supabase Edge Functions converted to AWS Lambda compatible format.

## Structure
- Each function is in its own directory (e.g., `track-visitor/`).
- `shared/` contains code shared across functions.
- `shared/aws-shim.ts` creates an adapter to run the original `serve` style code as an AWS Lambda handler.

## Deployment
To deploy these functions:
1. Ensure you have the `shared` directory available to the build.
2. For each function:
   - Run `npm install`.
   - Compile TypeScript (including `../shared`).
   - Zip the output.
   - Deploy as an AWS Lambda function.
   - **Environment Variables**: You must set environment variables (e.g., `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) in the Lambda configuration, as `Deno.env` calls have been replaced with `process.env`.

## Notes
- Background tasks using `EdgeRuntime.waitUntil` have been converted to `await`, making them synchronous. This is necessary for standard Lambda execution models unless you configure async invocation flows.
- `Deno` imports have been replaced with Node.js equivalents or polyfills.
