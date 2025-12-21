# Vercel Environment Variable Setup

## ⚠️ CRITICAL: Set This Environment Variable

To fix the 404 errors, you **must** set the following environment variable in Vercel:

### Step-by-Step Instructions

1. **Go to Vercel Dashboard**
   - Visit: https://vercel.com/dashboard
   - Select your project

2. **Navigate to Environment Variables**
   - Click on your project
   - Go to **Settings** tab
   - Click **Environment Variables** in the sidebar

3. **Add the Variable**
   ```
   Key:   VITE_API_URL
   Value: https://camellia-backend-production.up.railway.app/api
   ```

4. **Select Environments**
   - ✅ Production
   - ✅ Preview (optional but recommended)
   - ✅ Development (optional, only if deploying dev builds)

5. **Save and Redeploy**
   - Click **Save**
   - Go to **Deployments** tab
   - Click **...** on the latest deployment
   - Click **Redeploy**

## Verify It's Working

After redeploying, check the browser console. You should see:

```
[API Config] Base URL: https://camellia-backend-production.up.railway.app/api
[API Config] VITE_API_URL: https://camellia-backend-production.up.railway.app/api
```

If you see:
```
[API Config] VITE_API_URL: NOT SET - using /api
```

Then the environment variable is **NOT set correctly** - check step 3 above.

## Testing the Backend

Before deploying, verify your backend is accessible:

```bash
curl https://camellia-backend-production.up.railway.app/api/auth/login \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}'
```

If this returns a response (even 401/400), the backend is working. If it times out or gives 404, check your Railway deployment.

## Common Issues

### Issue: Still getting 404 after setting variable
- **Solution**: Make sure you **Redeployed** after adding the variable
- Vercel caches environment variables at build time, so a new deployment is required

### Issue: Variable shows in dashboard but still not working
- **Solution**: Check that you selected the correct environment (Production/Preview)
- Make sure the variable name is exactly `VITE_API_URL` (case-sensitive)
- Check for typos in the value

### Issue: Works locally but not in production
- **Solution**: Local dev uses Vite proxy (`/api` → `localhost:4000`)
- Production needs the full URL via `VITE_API_URL`
- Make sure the variable is set for Production environment




