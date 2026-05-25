# 500 Internal Server Error - Troubleshooting Guide

## Problem
Your frontend is now connecting to the backend successfully, but getting a `500 Internal Server Error`. This means the backend request format was incorrect and/or the backend is missing critical configuration.

## Root Causes

### Cause 1: Incorrect Request Format ✅ FIXED
**What was wrong**: Frontend was sending `context` field, but backend expects `user_id`, `session_id`, `language`.

**Fixed in**: `frontend/components/gemini-chat-interface.tsx`
- Now sends correct format with `user_id`, `session_id`, `language`
- Added persistent session tracking with `sessionIdRef`

### Cause 2: Missing GOOGLE_API_KEY 🔴 LIKELY ISSUE
The SenseiAgent cannot initialize without a valid Google API key.

**Fix**: Set environment variable before starting backend
```powershell
# In PowerShell
$env:GOOGLE_API_KEY="your_actual_google_api_key_here"

# Then start backend
python -m uvicorn main:app --reload --port 8000
```

### Cause 3: Missing config.yaml 🔴 LIKELY ISSUE
The backend needs `config.yaml` at project root.

**Check**:
```powershell
# Verify file exists
Test-Path "config.yaml"

# Should show: True
```

If missing, check that `config.yaml` is in the project root directory.

---

## Diagnostic Steps

### Step 1: Run Diagnostic Script
```powershell
# Navigate to project root
cd C:\Users\PC\Desktop\AI_NAGARI-Artificial_Intelligence_Nihongo_Agentic_RAG_Inference

# Run diagnostic
.\debug_backend.ps1
```

This will check:
- ✅ GOOGLE_API_KEY is set
- ✅ config.yaml exists
- ✅ Python is installed
- ✅ Backend is running
- ✅ SenseiAgent is initialized
- ✅ TTS Service is initialized
- ✅ Chat endpoint works

### Step 2: Check Backend Logs
Start the backend with detailed logging:
```powershell
# In backend directory
python -m uvicorn main:app --reload --port 8000 --log-level debug
```

Look for these messages:
```
✅ Good signs:
  "SenseiAgent initialized successfully"
  "Voicevox TTS engine started successfully"

❌ Bad signs:
  "Check GOOGLE_API_KEY and config.yaml"
  "Failed to import SenseiAgent"
  "Failed to start Voicevox engine"
```

### Step 3: Test Health Endpoint
```powershell
# Test if backend is responsive
Invoke-WebRequest -Uri "http://localhost:8000/health" -UseBasicParsing | ConvertFrom-Json
```

Should return something like:
```json
{
  "status": "ok",
  "service": "AI NARAGI Chat API",
  "version": "1.0.0",
  "sensei_agent_initialized": true,
  "tts_service_initialized": true
}
```

If `sensei_agent_initialized` is `false`, the SenseiAgent didn't initialize properly.

---

## Common Scenarios

### Scenario A: GOOGLE_API_KEY Not Set

**Symptom**: Backend starts but SenseiAgent not initialized

**Check**:
```powershell
$env:GOOGLE_API_KEY  # Should show your API key, not empty
```

**Fix**:
```powershell
# Set the API key
$env:GOOGLE_API_KEY="sk-proj-xxxxxxxxxxxx"

# Restart backend
python -m uvicorn main:app --reload --port 8000
```

### Scenario B: config.yaml Not Found

**Symptom**: Backend logs show "Configuration file not found"

**Check**:
```powershell
Get-ChildItem config.yaml  # Should exist at project root
```

**Fix**:
```powershell
# Verify it exists in project root
ls config.yaml

# If not found, check if it's in a subdirectory
Get-ChildItem -Recurse -Filter config.yaml
```

### Scenario C: Invalid JSON Request

**Symptom**: 422 Unprocessable Entity error

**Check**: Frontend is sending proper format
```typescript
// Should be:
{
  "message": "user input",
  "user_id": "user_web_ui",
  "session_id": "session_...",
  "language": "en"
}

// NOT:
{
  "message": "...",
  "context": [...]  // ❌ WRONG
}
```

**Status**: ✅ FIXED in updated component

---

## Step-by-Step Recovery

### 1. Set GOOGLE_API_KEY
```powershell
$env:GOOGLE_API_KEY="your_key_here"
```

### 2. Verify config.yaml exists
```powershell
Test-Path "config.yaml"  # Should return True
```

### 3. Stop any running backend
```powershell
# If backend is running, Ctrl+C to stop it
```

### 4. Clear backend cache
```powershell
# Remove Python cache
Remove-Item -Recurse -Force "backend/__pycache__" -ErrorAction SilentlyContinue
```

### 5. Start backend with debug logging
```powershell
cd backend
python -m uvicorn main:app --reload --port 8000 --log-level debug
```

### 6. In another terminal, test the health endpoint
```powershell
Invoke-WebRequest http://localhost:8000/health -UseBasicParsing | ConvertFrom-Json
```

If `sensei_agent_initialized` is `false`, check the backend terminal for error messages.

### 7. Test chat endpoint
Frontend should now work! Try sending a message.

---

## Advanced Debugging

### Check if Voicevox is running (TTS)
```powershell
# Voicevox should be running on port 50021
netstat -an | findstr "50021"
```

### Check Python environment
```powershell
python -c "import sys; print(sys.executable)"
python -c "import fastapi; print('FastAPI OK')"
python -c "import pydantic; print('Pydantic OK')"
```

### View backend environment
```powershell
# In Python script or terminal
import os
print(os.environ.get('GOOGLE_API_KEY'))
```

---

## If Problems Persist

### Option 1: Check Backend Requirements
```powershell
# Install backend dependencies
cd backend
pip install -r requirements.txt
```

### Option 2: Fresh Backend Startup
```powershell
# Stop backend (Ctrl+C)
# Clear cache
Remove-Item -Recurse -Force ".next" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "__pycache__" -ErrorAction SilentlyContinue

# Restart
python -m uvicorn main:app --reload --port 8000
```

### Option 3: Check Backend Logs for Specific Errors
Look for patterns in backend output:
- `ImportError` - Missing dependency
- `FileNotFoundError` - Missing config.yaml
- `ValueError` - Invalid configuration
- `KeyError` - Missing environment variable

---

## Success Criteria

When everything is working:

```
Backend terminal shows:
✅ "SenseiAgent initialized successfully"
✅ "Voicevox TTS engine started successfully"
✅ "FastAPI application created and configured successfully"

Health endpoint returns:
{
  "status": "ok",
  "sensei_agent_initialized": true,
  "tts_service_initialized": true
}

Frontend:
✅ Chat messages send and receive
✅ No 500 errors
✅ Audio synthesis works
✅ Messages appear in chat history
```

---

## Next Steps

1. **Run diagnostic script**: `.\debug_backend.ps1`
2. **Review backend logs**: Check for initialization errors
3. **Set GOOGLE_API_KEY**: `$env:GOOGLE_API_KEY="your_key"`
4. **Restart backend**: Fresh start with new env vars
5. **Test chat**: Send a message from frontend

If issues persist, the backend logs will provide the specific error message to debug further.
