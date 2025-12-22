#!/bin/bash

# Build script for ProssMind Lambda functions
# This script compiles TypeScript and prepares deployment packages

set -e

LAMBDA_DIR="lambda"

# Color output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Functions to build
FUNCTIONS=(
  "analyze-document-to-bpmn"
  "bottleneck-metrics"
  "bpmn-dashboard-api"
  "chatbot"
  "generate-bpmn"
  "generate-bpmn-combined"
  "generate-dmn"
  "process-bpmn-job"
  "refine-bpmn"
  "refine-dmn"
  "screen-recording-to-bpmn"
  "speech-to-text"
  "track-visitor"
  "vision-to-bpmn"
)

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Building ProssMind Lambda Functions${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Build each function
for FUNC in "${FUNCTIONS[@]}"; do
  echo -e "${BLUE}Building $FUNC...${NC}"
  
  FUNC_DIR="$LAMBDA_DIR/$FUNC"
  
  if [ ! -d "$FUNC_DIR" ]; then
    echo -e "${RED}Warning: Directory $FUNC_DIR not found, skipping...${NC}"
    continue
  fi
  
  # Install dependencies
  echo "  Installing dependencies..."
  cd "$FUNC_DIR"
  npm install --silent
  cd ../..
  
  # Compile from lambda directory to include shared code
  echo "  Compiling TypeScript..."
  cd "$LAMBDA_DIR"
  
  # Create temporary tsconfig
  cat > "tsconfig.$FUNC.json" << EOF
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./$FUNC/dist",
    "rootDir": "./",
    "strict": false,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "types": ["node"]
  },
  "include": ["./$FUNC/**/*.ts", "./shared/**/*.ts"],
  "exclude": ["node_modules", "dist", "**/node_modules", "**/dist"]
}
EOF
  
  # Compile
  npx tsc --project "tsconfig.$FUNC.json"
  
  # Remove temp config
  rm "tsconfig.$FUNC.json"
  
  cd ..
  
  # Copy package.json and node_modules to dist
  echo "  Copying dependencies..."
  cp "$FUNC_DIR/package.json" "$FUNC_DIR/dist/"
  if [ -d "$FUNC_DIR/node_modules" ]; then
    cp -r "$FUNC_DIR/node_modules" "$FUNC_DIR/dist/"
  fi
  
  echo -e "${GREEN}✓ Built $FUNC${NC}"
  echo ""
done

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}All functions built successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Validate SAM template: sam validate"
echo "2. Build with SAM: sam build"
echo "3. Deploy: sam deploy --guided"
