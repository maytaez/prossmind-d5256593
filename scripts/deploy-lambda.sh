#!/bin/bash

# Deployment helper script for ProssMind Lambda functions
# This script validates, builds, and deploys using AWS SAM

set -e

# Color output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}ProssMind Lambda Deployment${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &> /dev/null; then
  echo -e "${RED}Error: AWS CLI is not configured or credentials are invalid${NC}"
  echo "Please run: aws configure"
  exit 1
fi

echo -e "${GREEN}✓ AWS credentials verified${NC}"
echo ""

# Check if SAM CLI is installed
if ! command -v sam &> /dev/null; then
  echo -e "${RED}Error: AWS SAM CLI is not installed${NC}"
  echo "Please run: brew install aws-sam-cli"
  exit 1
fi

echo -e "${GREEN}✓ SAM CLI found${NC}"
echo ""

# Step 1: Build Lambda functions
echo -e "${BLUE}Step 1: Building Lambda functions...${NC}"
./scripts/build-lambda.sh

# Step 2: Validate SAM template
echo -e "${BLUE}Step 2: Validating SAM template...${NC}"
sam validate --template template.yaml
echo -e "${GREEN}✓ SAM template is valid${NC}"
echo ""

# Step 3: Build with SAM
echo -e "${BLUE}Step 3: Building with SAM...${NC}"
sam build
echo -e "${GREEN}✓ SAM build complete${NC}"
echo ""

# Step 4: Deploy
echo -e "${BLUE}Step 4: Deploying to AWS...${NC}"
echo -e "${YELLOW}Note: You will be prompted for deployment configuration${NC}"
echo ""

if [ -f "samconfig.toml" ]; then
  echo -e "${YELLOW}Found existing samconfig.toml, using saved configuration${NC}"
  sam deploy
else
  echo -e "${YELLOW}Running guided deployment (first time)${NC}"
  sam deploy --guided
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "To view your API endpoint:"
echo "  aws cloudformation describe-stacks --stack-name <your-stack-name> --query 'Stacks[0].Outputs'"
echo ""
echo "To view logs:"
echo "  sam logs -n GenerateBpmnFunction --tail"
echo ""
echo "To test a function:"
echo "  aws lambda invoke --function-name prossmind-generate-bpmn --payload '{\"body\":\"{}\"}' response.json"
