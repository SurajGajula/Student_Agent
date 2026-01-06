# Troubleshooting Guide

## Issue 1: Frontend Config API Not Being Called

### Symptoms
- Config API works when you type the URL directly in browser
- Config API is not called when the website loads
- Frontend shows errors or doesn't initialize

### Solutions

1. **Check if frontend build is up to date:**
   ```bash
   # On EC2, check when dist/ was last built
   ls -la ~/Student_Agent/dist/
   
   # Rebuild frontend if needed
   cd ~/Student_Agent
   npm run build:web
   sudo chmod -R 755 dist
   sudo systemctl reload nginx
   ```

2. **Check browser console for errors:**
   - Open browser DevTools (F12)
   - Go to Console tab
   - Look for errors starting with `[supabase.ts]`
   - Check Network tab to see if `/api/config` request is being made

3. **Verify the frontend code has runtime config:**
   - The frontend should call `initSupabase()` which calls `fetchRuntimeConfig()`
   - Check browser console for logs like: `[supabase.ts] Trying to fetch config from: ...`

4. **Check CORS:**
   - If you see CORS errors in console, verify `server.ts` allows your origin
   - The config endpoint should be accessible from `https://studentagent.site`

## Issue 2: Gemini Client Not Initializing

### Symptoms
- PM2 logs show: "Gemini client initialization failed"
- Schedule parsing doesn't work
- Error mentions `GOOGLE_SERVICE_ACCOUNT_BASE64`

### Solutions

1. **Verify environment variable is set:**
   ```bash
   # On EC2, check your ecosystem.config.cjs (NOT the .example file)
   cat ~/Student_Agent/ecosystem.config.cjs | grep GOOGLE_SERVICE_ACCOUNT_BASE64
   
   # It should show something like:
   # GOOGLE_SERVICE_ACCOUNT_BASE64: 'eyJ0eXAiOiJKV1QiLCJhbGc...' (long base64 string)
   ```

2. **Make sure you're using the actual config file, not the example:**
   ```bash
   # The actual file should be:
   ~/Student_Agent/ecosystem.config.cjs
   
   # NOT:
   ~/Student_Agent/deployment/ecosystem.config.cjs.example
   ```

3. **Restart PM2 with updated environment variables:**
   ```bash
   cd ~/Student_Agent
   pm2 restart student-agent-backend --update-env
   pm2 logs student-agent-backend --lines 50 | grep -i gemini
   ```

4. **Check PM2 logs for Gemini initialization:**
   ```bash
   pm2 logs student-agent-backend --lines 100 | grep -i "gemini\|service account\|GOOGLE"
   ```
   
   You should see:
   - `GOOGLE_SERVICE_ACCOUNT_BASE64 environment variable is set.`
   - `Attempting to decode service account from GOOGLE_SERVICE_ACCOUNT_BASE64`
   - `Loaded service account from GOOGLE_SERVICE_ACCOUNT_BASE64 environment variable`
   - `Gemini client initialized with service account (project: ...)`

5. **If environment variable is missing:**
   - Get your service account JSON key from Google Cloud Console
   - Base64 encode it:
     ```bash
     # On your local machine (not EC2)
     cat studentagent.json | base64
     ```
   - Copy the entire base64 string (including `==` at the end if present)
   - Add it to `ecosystem.config.cjs`:
     ```javascript
     GOOGLE_SERVICE_ACCOUNT_BASE64: 'your-base64-string-here',
     ```
   - Restart PM2: `pm2 restart student-agent-backend --update-env`

## Quick Diagnostic Commands

### Check if backend is running:
```bash
curl http://localhost:3001/health
```

### Check if config endpoint works:
```bash
curl https://studentagent.site/api/config
```

### Check PM2 status:
```bash
pm2 status
pm2 logs student-agent-backend --lines 20
```

### Check Nginx status:
```bash
sudo systemctl status nginx
sudo nginx -t
```

### Check frontend files:
```bash
ls -la ~/Student_Agent/dist/
cat ~/Student_Agent/dist/index.html | grep -i "api_url\|config"
```

