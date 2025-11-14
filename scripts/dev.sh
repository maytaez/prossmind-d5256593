#!/bin/bash

# Development script to run all subdomains concurrently
# Usage: ./scripts/dev.sh [marketing|app|docs|all]

SUBDOMAIN=${1:-all}

case $SUBDOMAIN in
  marketing)
    echo "Starting marketing site..."
    cd apps/marketing && npm run dev
    ;;
  app)
    echo "Starting app subdomain..."
    cd apps/app && npm run dev
    ;;
  docs)
    echo "Starting docs subdomain..."
    cd apps/docs && npm run dev
    ;;
  all)
    echo "Starting all subdomains..."
    # Run all in parallel using background processes
    (cd apps/marketing && npm run dev) &
    (cd apps/app && npm run dev) &
    (cd apps/docs && npm run dev) &
    wait
    ;;
  *)
    echo "Usage: ./scripts/dev.sh [marketing|app|docs|all]"
    exit 1
    ;;
esac




