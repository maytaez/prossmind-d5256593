#!/bin/bash

# Build script for all subdomains
set -e

echo "Building all subdomains..."

# Build marketing site
echo "Building marketing site..."
cd apps/marketing
npm run build
cd ../..

# Build app subdomain
echo "Building app subdomain..."
cd apps/app
npm run build
cd ../..

# Build docs subdomain
echo "Building docs subdomain..."
cd apps/docs
npm run build
cd ../..

echo "All builds completed successfully!"




