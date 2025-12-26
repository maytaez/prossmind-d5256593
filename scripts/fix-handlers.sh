#!/bin/bash

# Update all Lambda handler paths in template.yaml to match the TypeScript build output structure

sed -i '' '
/CodeUri: lambda\/generate-bpmn\//,/Handler:/ s|Handler:.*|Handler: dist/generate-bpmn/index.handler|
/CodeUri: lambda\/generate-bpmn-combined\//,/Handler:/ s|Handler:.*|Handler: dist/generate-bpmn-combined/index.handler|
/CodeUri: lambda\/refine-bpmn\//,/Handler:/ s|Handler:.*|Handler: dist/refine-bpmn/index.handler|
/CodeUri: lambda\/process-bpmn-job\//,/Handler:/ s|Handler:.*|Handler: dist/process-bpmn-job/index.handler|
/CodeUri: lambda\/analyze-document-to-bpmn\//,/Handler:/ s|Handler:.*|Handler: dist/analyze-document-to-bpmn/index.handler|
/CodeUri: lambda\/vision-to-bpmn\//,/Handler:/ s|Handler:.*|Handler: dist/vision-to-bpmn/index.handler|
/CodeUri: lambda\/screen-recording-to-bpmn\//,/Handler:/ s|Handler:.*|Handler: dist/screen-recording-to-bpmn/index.handler|
/CodeUri: lambda\/speech-to-text\//,/Handler:/ s|Handler:.*|Handler: dist/speech-to-text/index.handler|
/CodeUri: lambda\/generate-dmn\//,/Handler:/ s|Handler:.*|Handler: dist/generate-dmn/index.handler|
/CodeUri: lambda\/refine-dmn\//,/Handler:/ s|Handler:.*|Handler: dist/refine-dmn/index.handler|
/CodeUri: lambda\/bpmn-dashboard-api\//,/Handler:/ s|Handler:.*|Handler: dist/bpmn-dashboard-api/index.handler|
/CodeUri: lambda\/bottleneck-metrics\//,/Handler:/ s|Handler:.*|Handler: dist/bottleneck-metrics/index.handler|
/CodeUri: lambda\/chatbot\//,/Handler:/ s|Handler:.*|Handler: dist/chatbot/index.handler|
/CodeUri: lambda\/track-visitor\//,/Handler:/ s|Handler:.*|Handler: dist/track-visitor/index.handler|
' template.yaml

echo "Updated all Lambda handler paths in template.yaml"
