#!/bin/bash
set -e

ROLE_NAME="prossmind-generate-bpmn-role-2utjx5oe"
POLICY_NAME="SecretsManagerAccess"

# Create the policy document
POLICY_DOC='{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "secretsmanager:GetSecretValue",
      "Resource": "arn:aws:secretsmanager:eu-central-2:580165054191:secret:prossmind/google-api-key-*"
    },
    {
      "Effect": "Allow",
      "Action": "lambda:InvokeFunction",
      "Resource": "arn:aws:lambda:eu-central-2:580165054191:function:prossmind-process-bpmn-job"
    }
  ]
}'

echo "Updating IAM policy..."
aws iam put-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-name "$POLICY_NAME" \
  --policy-document "$POLICY_DOC"

echo "✅ Policy updated successfully!"
echo ""
echo "Verifying policy..."
aws iam get-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-name "$POLICY_NAME" \
  --output json | jq '.PolicyDocument.Statement'
