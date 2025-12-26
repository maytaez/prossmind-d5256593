# AWS Secrets Manager Integration Guide

This guide explains how to store the Google API Key in AWS Secrets Manager instead of environment variables for better security.

## Benefits

- **Security**: API keys are encrypted at rest and in transit
- **Rotation**: Easy to rotate keys without redeploying Lambda functions
- **Audit**: AWS CloudTrail logs all secret access
- **Separation**: Secrets are managed separately from code and deployment configs

## Setup Instructions

### Step 1: Create the Secret in AWS Secrets Manager

You have two options:

#### Option A: Using the provided script (Recommended)

```bash
# Make the script executable
chmod +x scripts/create-google-api-secret.sh

# Run the script with your Google API Key
./scripts/create-google-api-secret.sh YOUR_GOOGLE_API_KEY_HERE
```

#### Option B: Using AWS CLI directly

```bash
aws secretsmanager create-secret \
    --name "prossmind/google-api-key" \
    --description "Google API Key for ProssMind Gemini AI integration" \
    --secret-string "YOUR_GOOGLE_API_KEY_HERE" \
    --region us-east-1
```

#### Option C: Using AWS Console

1. Go to [AWS Secrets Manager Console](https://console.aws.amazon.com/secretsmanager/)
2. Click "Store a new secret"
3. Select "Other type of secret"
4. Choose "Plaintext" and paste your Google API Key
5. Name it: `prossmind/google-api-key`
6. Click "Next" and then "Store"

### Step 2: Verify the Secret

```bash
# List secrets to verify it was created
aws secretsmanager list-secrets --region us-east-1 | grep prossmind

# Get the secret value (for testing)
aws secretsmanager get-secret-value \
    --secret-id prossmind/google-api-key \
    --region us-east-1 \
    --query SecretString \
    --output text
```

### Step 3: Deploy Lambda Functions

The functions are already configured to fetch the secret. Just deploy:

```bash
# Build and deploy
sam build && sam deploy --no-confirm-changeset --resolve-s3
```

## How It Works

1. **Environment Variable**: Lambda functions receive `GOOGLE_API_KEY_SECRET_NAME` env var pointing to `prossmind/google-api-key`
2. **IAM Permissions**: Lambda execution role has `secretsmanager:GetSecretValue` permission
3. **Helper Function**: `lambda/shared/secrets.ts` provides `getGoogleApiKey()` function
4. **Caching**: First call fetches from Secrets Manager, subsequent calls use cached value
5. **Auto-fetch**: Lambda functions automatically call `getGoogleApiKey()` when needed

## Code Example

```typescript
import { getGoogleApiKey } from '../shared/secrets';

// Fetch Google API Key (cached after first call)
const GOOGLE_API_KEY = await getGoogleApiKey();

// Use it
const response = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GOOGLE_API_KEY}`,
  // ...
);
```

## Updating the Secret

### Using the script

```bash
./scripts/create-google-api-secret.sh NEW_GOOGLE_API_KEY_HERE
```

### Using AWS CLI

```bash
aws secretsmanager update-secret \
    --secret-id prossmind/google-api-key \
    --secret-string "NEW_GOOGLE_API_KEY_HERE" \
    --region us-east-1
```

### Changes take effect immediately

No need to redeploy Lambda functions! The cache will be refreshed on the next cold start or you can manually restart the function.

## Troubleshooting

### Error: "Failed to fetch Google API Key from Secrets Manager"

1. **Check the secret exists**:
   ```bash
   aws secretsmanager describe-secret --secret-id prossmind/google-api-key --region us-east-1
   ```

2. **Check IAM permissions**: Ensure Lambda execution role has the policy:
   ```json
   {
     "Effect": "Allow",
     "Action": "secretsmanager:GetSecretValue",
     "Resource": "arn:aws:secretsmanager:us-east-1:ACCOUNT_ID:secret:prossmind/google-api-key*"
   }
   ```

3. **Check region**: Make sure the secret is in the same region as the Lambda (us-east-1)

### Error: "Google API key not configured"

This means the secret is empty or couldn't be parsed. Verify the secret value:

```bash
aws secretsmanager get-secret-value \
    --secret-id prossmind/google-api-key \
    --region us-east-1
```

### Viewing CloudWatch Logs

```bash
# Get log streams for the Lambda function
aws logs describe-log-streams \
    --log-group-name /aws/lambda/prossmind-generate-bpmn \
    --order-by LastEventTime \
    --descending \
    --max-items 1

# View logs
aws logs tail /aws/lambda/prossmind-generate-bpmn --follow
```

## Security Best Practices

1. **Never commit secrets to git**: The secret is stored in AWS, not in code
2. **Use IAM policies**: Restrict which Lambda functions can access the secret
3. **Enable rotation**: Consider setting up automatic rotation for the API key
4. **Monitor access**: Use CloudTrail to audit who accesses the secret
5. **Delete when not needed**: Remove the secret if you no longer use it

## Cost

- **Storage**: $0.40 per secret per month
- **API calls**: $0.05 per 10,000 API calls
- **Rotation**: Additional charges if using automatic rotation

For this use case (1 secret, ~1000 calls/month), expect < $0.50/month.

## Alternative: JSON Format

If you want to store multiple keys in one secret, use JSON format:

```bash
aws secretsmanager create-secret \
    --name "prossmind/google-api-key" \
    --secret-string '{"apiKey":"YOUR_KEY_HERE","otherKey":"VALUE"}' \
    --region us-east-1
```

The helper function will automatically parse JSON and look for `apiKey`, `GOOGLE_API_KEY`, or `google_api_key` fields.
