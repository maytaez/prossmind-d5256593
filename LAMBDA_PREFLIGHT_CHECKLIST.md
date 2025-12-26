# Lambda Integration Pre-Flight Checklist

**Status**: Ready for Testing ✅  
**Date**: 2025-12-23  
**Feature Flag**: `USE_LAMBDA = true` (ENABLED)

---

## ✅ Code Implementation Status

### 1. Feature Flag Configuration
- ✅ **Feature flag created**: `src/config/featureFlags.ts`
  - `USE_LAMBDA: true` (enabled by default)
  - Properly documented with comments
  
### 2. Lambda Configuration
- ✅ **Lambda config created**: `src/config/lambdaConfig.ts`
  - All 14 functions mapped to Lambda endpoints
  - Helper functions implemented:
    - `getLambdaEndpoint(functionName)` ✅
    - `isLambdaConfigured()` ✅
    - `getLambdaApiUrl()` ✅
  - Reads from `VITE_LAMBDA_API_URL` environment variable ✅

### 3. API Client Routing
- ✅ **API client enhanced**: `src/utils/api-client.ts`
  - `invokeLambdaFunction()` implemented ✅
  - `invokeSupabaseFunction()` implemented ✅
  - Automatic routing based on feature flag ✅
  - Fallback to Supabase if Lambda not configured ✅
  - Console logging for debugging ✅
  - Error handling and timeout support ✅

### 4. Component Updates
All components updated to use centralized `invokeFunction`:

- ✅ **TryProssMe.tsx**
  - `generate-bpmn` (already using invokeFunction)
  - `generate-bpmn-combined` (already using invokeFunction)
  - `speech-to-text` (updated)
  - `vision-to-bpmn` (updated)
  - `refine-bpmn` (updated)

- ✅ **SubdomainTryProssMe.tsx**
  - `generate-bpmn` (already using invokeFunction)
  - `speech-to-text` (updated)
  - `vision-to-bpmn` (updated)
  - `refine-bpmn` (updated)

- ✅ **ScreenRecorder.tsx**
  - `screen-recording-to-bpmn` (updated)

- ✅ **CookieConsent.tsx**
  - `track-visitor` (updated)

### 5. Lambda Functions Status

All 14 Lambda functions are ready:

| Function | Directory | index.ts | package.json | SAM Config |
|----------|-----------|----------|--------------|------------|
| generate-bpmn | ✅ | ✅ | ✅ | ✅ |
| generate-bpmn-combined | ✅ | ✅ | ✅ | ✅ |
| refine-bpmn | ✅ | ✅ | ✅ | ✅ |
| process-bpmn-job | ✅ | ✅ | ✅ | ✅ |
| analyze-document-to-bpmn | ✅ | ✅ | ✅ | ✅ |
| vision-to-bpmn | ✅ | ✅ | ✅ | ✅ |
| screen-recording-to-bpmn | ✅ | ✅ | ✅ | ✅ |
| speech-to-text | ✅ | ✅ | ✅ | ✅ |
| generate-dmn | ✅ | ✅ | ✅ | ✅ |
| refine-dmn | ✅ | ✅ | ✅ | ✅ |
| bpmn-dashboard-api | ✅ | ✅ | ✅ | ✅ |
| bottleneck-metrics | ✅ | ✅ | ✅ | ✅ |
| chatbot | ✅ | ✅ | ✅ | ✅ |
| track-visitor | ✅ | ✅ | ✅ | ✅ |

### 6. SAM Configuration
- ✅ **template.yaml**: All 14 functions defined
- ✅ **samconfig.toml**: Deployment configuration ready
- ✅ **Stack name**: `prossmind-rest-api`
- ✅ **Region**: `us-east-1`
- ✅ **CORS**: Configured in API Gateway

### 7. Documentation
- ✅ **LAMBDA_INTEGRATION.md**: Comprehensive integration guide
- ✅ **LAMBDA_IMPLEMENTATION_SUMMARY.md**: Implementation details
- ✅ **.env.example**: Environment variable template
- ✅ **This checklist**: Pre-flight verification

---

## ⏳ Pending Actions (Required Before Testing)

### 1. Deploy Lambda Functions
```bash
# Navigate to project root
cd /Users/divyampant/Documents/Projects/prossmind/prossmind\ project/prossmind-d5256593

# Build all Lambda functions
sam build

# Deploy to AWS (first time - guided)
sam deploy --guided

# Or deploy with existing config
sam deploy
```

**Expected Output**:
```
Successfully created/updated stack - prossmind-rest-api
Outputs:
  ApiUrl: https://abc123xyz.execute-api.us-east-1.amazonaws.com/Prod/
```

### 2. Configure Environment Variable
After deployment, add the API Gateway URL to your `.env` file:

```bash
# Copy .env.example to .env if not exists
cp .env.example .env

# Edit .env and add:
VITE_LAMBDA_API_URL=https://YOUR-API-ID.execute-api.us-east-1.amazonaws.com/Prod
```

**Important**: 
- Remove the trailing slash from the URL
- Use the exact URL from SAM deploy output
- Restart your dev server after updating .env

### 3. Restart Development Server
```bash
# Stop current dev server (Ctrl+C)
# Start fresh
npm run dev
```

---

## 🧪 Testing Checklist

Once Lambda is deployed and configured, test each function:

### Critical Functions (Test First)
- [ ] **generate-bpmn**: Generate a simple BPMN diagram
  - Go to "Try ProssMind" section
  - Enter: "Create a customer onboarding process"
  - Check console for: `[Lambda] Routing generate-bpmn to Lambda`
  - Verify diagram generates successfully

- [ ] **refine-bpmn**: Refine an existing diagram
  - Generate a diagram first
  - Click "Refine" and enter: "Add a review step"
  - Check console for: `[Lambda] Routing refine-bpmn to Lambda`
  - Verify refinement works

- [ ] **track-visitor**: Cookie consent tracking
  - Open the app in incognito mode
  - Accept cookie consent
  - Check console for: `[Lambda] Routing track-visitor to Lambda`
  - Verify no errors

### Document Processing Functions
- [ ] **vision-to-bpmn**: Upload an image
  - Upload a process diagram image
  - Check console for Lambda routing
  - Verify BPMN generation

- [ ] **speech-to-text**: Voice recording
  - Click voice input
  - Record a short message
  - Check console for Lambda routing
  - Verify text conversion

- [ ] **screen-recording-to-bpmn**: Screen recording
  - Go to Screen Recorder page
  - Record a short workflow
  - Check console for Lambda routing
  - Verify BPMN generation

### Complex Workflow Functions
- [ ] **generate-bpmn-combined**: Complex prompt
  - Enter a complex multi-step process
  - Check console for Lambda routing
  - Verify multiple diagrams generated

- [ ] **process-bpmn-job**: Async processing
  - Trigger an async job (complex prompt)
  - Check console for Lambda routing
  - Verify job completion

### DMN Functions
- [ ] **generate-dmn**: Generate decision table
  - Test DMN generation
  - Check console for Lambda routing

- [ ] **refine-dmn**: Refine decision table
  - Refine a DMN diagram
  - Check console for Lambda routing

### Dashboard Functions
- [ ] **bpmn-dashboard-api**: Dashboard data
  - Open BPMN analytics dashboard
  - Check console for Lambda routing
  - Verify data loads

- [ ] **bottleneck-metrics**: Metrics calculation
  - Test bottleneck analysis
  - Check console for Lambda routing

### Other Functions
- [ ] **chatbot**: AI assistant
  - Open chatbot
  - Send a message
  - Verify response (may use direct fetch, not invokeFunction)

- [ ] **analyze-document-to-bpmn**: Document analysis
  - Upload a document
  - Check console for Lambda routing

---

## 🔍 Verification Steps

### 1. Check Console Logs
Open browser DevTools Console and look for:

✅ **Success Pattern**:
```
[Lambda] Routing generate-bpmn to Lambda
```

❌ **Warning Pattern** (Lambda not configured):
```
USE_LAMBDA feature flag is enabled but Lambda is not configured. 
Falling back to Supabase Edge Functions.
```

❌ **Error Pattern**:
```
Error: VITE_LAMBDA_API_URL environment variable is not set
```

### 2. Check Network Tab
In DevTools Network tab:

✅ **Lambda Requests**:
- URL should be: `https://YOUR-API-ID.execute-api.us-east-1.amazonaws.com/Prod/function-name`
- Method: POST
- Status: 200 OK

❌ **Supabase Requests** (if fallback):
- URL should be: `https://lnxbvkcggoyfmpfthhhk.supabase.co/functions/v1/function-name`

### 3. Check Response Times
Compare performance:
- Lambda cold start: ~2-5 seconds (first request)
- Lambda warm: ~500ms-2s
- Supabase: ~1-3s

### 4. Check Error Handling
Test error scenarios:
- [ ] Invalid prompt
- [ ] Network timeout
- [ ] Large file upload
- [ ] Rate limiting

---

## 🚨 Troubleshooting Guide

### Issue: "Lambda is not configured" warning
**Solution**: 
1. Check if `VITE_LAMBDA_API_URL` is set in `.env`
2. Restart dev server after adding the variable
3. Verify the URL doesn't have trailing slash

### Issue: 404 Not Found from Lambda
**Solution**:
1. Verify function is deployed: `aws lambda list-functions --query 'Functions[?starts_with(FunctionName, `prossmind`)].FunctionName'`
2. Check template.yaml has correct path mapping
3. Verify API Gateway routes are created

### Issue: CORS errors
**Solution**:
1. Check template.yaml CORS configuration
2. Verify AllowOrigin includes your domain
3. Redeploy: `sam deploy`

### Issue: Timeout errors
**Solution**:
1. Check Lambda timeout in template.yaml (default: 300s)
2. Increase if needed for complex operations
3. Check CloudWatch logs for actual execution time

### Issue: Function returns 500 error
**Solution**:
1. Check CloudWatch Logs:
   ```bash
   aws logs tail /aws/lambda/prossmind-FUNCTION-NAME --follow
   ```
2. Look for error stack traces
3. Verify environment variables are set in Lambda

---

## 📊 Current Status Summary

| Component | Status | Notes |
|-----------|--------|-------|
| Feature Flag | ✅ Ready | Enabled by default |
| Lambda Config | ✅ Ready | All 14 functions mapped |
| API Client | ✅ Ready | Routing logic implemented |
| Components | ✅ Ready | All updated to use invokeFunction |
| Lambda Functions | ✅ Ready | All 14 functions have code |
| SAM Template | ✅ Ready | All functions defined |
| Documentation | ✅ Ready | Complete guides available |
| **Deployment** | ⏳ **Pending** | Need to run `sam deploy` |
| **Environment** | ⏳ **Pending** | Need to set VITE_LAMBDA_API_URL |
| **Testing** | ⏳ **Pending** | Waiting for deployment |

---

## 🎯 Next Immediate Steps

1. **Deploy Lambda Stack**:
   ```bash
   sam build && sam deploy
   ```

2. **Get API Gateway URL** from deployment output

3. **Update .env**:
   ```bash
   VITE_LAMBDA_API_URL=https://YOUR-API-ID.execute-api.us-east-1.amazonaws.com/Prod
   ```

4. **Restart Dev Server**:
   ```bash
   npm run dev
   ```

5. **Test First Function**:
   - Open app
   - Generate a BPMN diagram
   - Check console for `[Lambda] Routing...`

6. **Verify All Functions** using the testing checklist above

---

## 📝 Notes

- All code changes are complete and committed
- Feature flag is enabled by default
- Fallback to Supabase is automatic if Lambda fails
- No frontend code changes needed after deployment
- Can toggle back to Supabase anytime by setting `USE_LAMBDA: false`

---

**Ready to Deploy**: YES ✅  
**Blockers**: None  
**Risk Level**: Low (automatic fallback to Supabase)  
**Estimated Deployment Time**: 5-10 minutes  
**Estimated Testing Time**: 30-45 minutes
