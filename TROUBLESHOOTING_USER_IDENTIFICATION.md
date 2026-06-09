# User Identification Troubleshooting Guide

## Problem
Backend reports user as "Anonymous" even after successful login

## Quick Diagnostic Steps

### Step 1: Verify Login Response Has user_id
1. Open Browser Developer Tools (F12)
2. Go to **Login Page** and submit the form
3. Check **Console** tab for logs starting with `[Login Success] Storing user data`
4. Look for `userId` field - should be a number like `1`, `2`, etc.
   - ✅ If you see a number: user_id was returned by backend
   - ❌ If it's empty: backend didn't return user.id

**Example Console Output:**
```
[Login Success] Storing user data: {
  userId: "1"
  displayName: "john_doe"
  email: "john@example.com"
}
```

### Step 2: Verify localStorage Storage
1. After login, check **Application/Storage** tab in DevTools
2. Click **Local Storage** → `http://localhost:3000`
3. Look for these keys:
   - `user_id` → should have a value like `"1"` or `"2"`
   - `user_display_name` → should have your username
   - `user_email` → should have your email
   - `session_token` → should have a long string

**What to look for:**
- ✅ `user_id` = `"1"` or similar number as string
- ❌ `user_id` = empty or missing
- ❌ `user_id` = `null`

### Step 3: Go to Chat and Check User Profile Load
1. Navigate to Chat page (home page after login)
2. Check **Console** for `[UserProfile] Raw localStorage data`
3. Look at the values:

**Good Output:**
```
[UserProfile] Raw localStorage data: {
  userId: "1"
  displayName: "john_doe"
  email: "john@example.com"
  hasSessionToken: true
}
[UserProfile] Initialized: {
  userId: "1"
  displayName: "john_doe"
  isAuthenticated: true
}
```

**Bad Output:**
```
[UserProfile] Raw localStorage data: {
  userId: null
  displayName: null
  email: null
  hasSessionToken: false
}
[UserProfile] WARNING: User not authenticated. Please log in first.
```

### Step 4: Send a Chat Message and Check Request
1. Type a message in chat
2. Check **Console** for `[Message Send] Request payload`
3. Look at the `user_id` field:

**Good:**
```
[Message Send] Request payload: {
  message: "Hello"
  user_id: "1"     ← Should be your user ID
  session_id: "..."
  language: "en"
}
```

**Bad:**
```
[Message Send] Request payload: {
  message: "Hello"
  user_id: "anonymous"   ← This is the problem!
  session_id: "..."
  language: "en"
}
```

### Step 5: Check Backend Logs
1. Check backend server logs for `[DIAGNOSTIC]` lines
2. Look for output like:

**Good:**
```
[DIAGNOSTIC] Incoming request user_id: '1' | Type: <class 'str'> | Is None: False | Is Empty: False
[DIAGNOSTIC] Final user_id being used: '1'
[UserProfile] Identified successfully | ID: 1 | Username: john_doe
```

**Bad:**
```
[DIAGNOSTIC] Incoming request user_id: 'None' | Type: <class 'str'> | Is None: False | Is Empty: False
[DIAGNOSTIC] Final user_id being used: 'anonymous'
```

---

## Possible Causes & Solutions

### Issue: localStorage keys are empty
**Cause:** Login response from backend doesn't include `user.id`
**Solution:** Check backend auth router returns correct response schema with `user.id`

```bash
# Check database has user with ID
sqlite3 database/ai_naragi.db "SELECT id, username, email FROM users LIMIT 5;"
```

### Issue: localStorage shows correct data, but Chat page loses it
**Cause:** Page refresh/navigation clears localStorage OR different domain
**Solution:**
1. Check if you're on the same domain
2. Check if session expires immediately
3. Clear localStorage and re-login: 
   ```javascript
   localStorage.clear()
   // Then login again
   ```

### Issue: localStorage has data but frontend shows "anonymous"
**Cause:** User ID contains whitespace or is null string
**Solution:** Fixed in latest code - should now trim whitespace automatically

### Issue: Frontend sends correct user_id but backend shows "anonymous"
**Cause:** Backend database doesn't have user with that ID
**Solution:**
1. Check database has the user:
   ```bash
   sqlite3 database/ai_naragi.db "SELECT id, username FROM users WHERE id = '1';"
   ```
2. If user exists, check if user_identification_service is working:
   ```bash
   # Add debug logs in identify_user method
   ```

---

## Full Debugging Checklist

```
□ 1. User successfully logs in (no error messages)
□ 2. Login page shows [Login Success] in console with user_id value
□ 3. localStorage has user_id key with a non-empty value
□ 4. Chat page loads and shows [UserProfile] Initialized with isAuthenticated: true
□ 5. Send a message and see [Message Send] Request payload with user_id (not "anonymous")
□ 6. Backend logs show [DIAGNOSTIC] with correct user_id (not 'None' or 'anonymous')
□ 7. Backend logs show user identified from database (not anonymous)
□ 8. Backend activity_log table has entry for the user_id
```

---

## Browser Console Commands to Check

```javascript
// Check localStorage
console.log('user_id:', localStorage.getItem('user_id'));
console.log('user_display_name:', localStorage.getItem('user_display_name'));
console.log('user_email:', localStorage.getItem('user_email'));
console.log('session_token exists:', !!localStorage.getItem('session_token'));

// Clear and start fresh (if needed)
localStorage.clear();
console.log('localStorage cleared');
```

---

## Still Not Working?

1. **Share Console Output:** Copy-paste the `[UserProfile]` and `[Message Submit]` logs
2. **Share Backend Logs:** Copy-paste the `[DIAGNOSTIC]` and `[UserIdentification]` logs
3. **Check Database:** `SELECT * FROM users; SELECT * FROM activity_log;`
4. **Verify Login worked:** `SELECT * FROM users WHERE username = 'your_username';`
