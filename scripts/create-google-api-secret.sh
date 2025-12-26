#!/bin/bash

# Script to create Google API Key secret in AWS Secrets Manager
# Usage: ./create-secret.sh YOUR_GOOGLE_API_KEY

set -e

if [ -z "$1" ]; then
    echo "Error: Please provide your Google API Key as an argument"
    echo "Usage: ./create-secret.sh YOUR_GOOGLE_API_KEY"
    exit 1
fi

GOOGLE_API_KEY="$1"
SECRET_NAME="prossmind/google-api-key"
REGION="eu-central-2"

echo "Creating secret '${SECRET_NAME}' in region '${REGION}'..."

# Try to create the secret
aws secretsmanager create-secret \
    --name "${SECRET_NAME}" \
    --description "Google API Key for ProssMind Gemini AI integration" \
    --secret-string "${GOOGLE_API_KEY}" \
    --region "${REGION}" 2>/dev/null && echo "✅ Secret created successfully!" || \
    
# If secret already exists, update it instead
(echo "Secret already exists. Updating..." && \
aws secretsmanager update-secret \
    --secret-id "${SECRET_NAME}" \
    --secret-string "${GOOGLE_API_KEY}" \
    --region "${REGION}" && \
echo "✅ Secret updated successfully!")

echo ""
echo "Secret ARN:"
aws secretsmanager describe-secret \
    --secret-id "${SECRET_NAME}" \
    --region "${REGION}" \
    --query 'ARN' \
    --output text

echo ""
echo "✅ Done! Your Google API Key is now securely stored in AWS Secrets Manager."
echo "The Lambda functions will automatically fetch it when needed."
