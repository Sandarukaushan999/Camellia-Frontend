# Deployment Guide

## Environment Variables

### Production (Vercel/Railway)

You need to set the `VITE_API_URL` environment variable in your Vercel project settings:

```
VITE_API_URL=https://camellia-backend-production.up.railway.app/api
```

**How to set in Vercel:**
1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Add `VITE_API_URL` with value: `https://camellia-backend-production.up.railway.app/api`
4. Redeploy your application

### Local Development

For local development, leave `VITE_API_URL` unset. The app will use Vite's proxy configuration which routes `/api` requests to `http://localhost:4000`.

Make sure your backend is running on port 4000.

## Troubleshooting 404 Errors

### Issue 1: Frontend calling wrong URL

**Check the Network tab:**
- The request should go to: `https://camellia-backend-production.up.railway.app/api/auth/login`
- If it's going to a relative URL like `/api/auth/login`, the `VITE_API_URL` is not set

**Solution:** Set the `VITE_API_URL` environment variable in Vercel

### Issue 2: Backend not responding

**Check Railway logs:**
- Verify the backend is running and healthy
- Check for any errors in Railway logs

**Test the backend directly:**
```bash
curl https://camellia-backend-production.up.railway.app/api/auth/login \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}'
```

### Issue 3: CORS errors

If you see CORS errors, the backend needs to allow requests from your frontend domain. Check:
- Railway backend CORS configuration
- Ensure `Access-Control-Allow-Origin` includes your Vercel domain

### Issue 4: OPTIONS preflight requests

The browser makes OPTIONS requests first (CORS preflight). Ensure:
- The backend handles OPTIONS requests
- Returns proper CORS headers for OPTIONS requests

## Debugging

Check the browser console for:
- `API Base URL: ...` - This shows what base URL is being used
- Network errors showing the exact URL being called
- Any CORS errors

## Build & Deploy

```bash
cd frontend
npm install
npm run build
```

The build output will be in the `dist/` folder, which Vercel will automatically detect and deploy.




