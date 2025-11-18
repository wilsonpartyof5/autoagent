# Vercel Deployment - Configuration Fix

The deployment is failing because Vercel needs proper monorepo configuration. Here's how to fix it:

## Issue

Vercel is not detecting Next.js because the `rootDirectory` setting needs to be configured in the Vercel Dashboard, not just in `vercel.json`.

## Solution: Configure via Vercel Dashboard

1. **Go to Vercel Dashboard**
   - Visit: https://vercel.com/dustins-projects-2a4636fb/dealer-dashboard/settings
   - Or: https://vercel.com/dashboard → Select "dealer-dashboard" project → Settings

2. **Update General Settings**
   - **Root Directory**: Set to `apps/dealer-dashboard`
   - **Framework Preset**: Next.js
   - **Build Command**: `pnpm build` (or leave default)
   - **Output Directory**: `.next` (or leave default)
   - **Install Command**: `cd ../.. && pnpm install` (to install from monorepo root)

3. **Set Environment Variables**
   Go to Settings → Environment Variables and add:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://vqoawedqmeybbndvqxta.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (your Supabase anon key)

4. **Redeploy**
   - Go to Deployments tab
   - Click "Redeploy" on the latest deployment
   - Or trigger a new deployment via Git push

## Alternative: Deploy from Root Directory

If the above doesn't work, you can configure Vercel to deploy from the repository root:

1. **Update Root Directory in Vercel Dashboard**
   - Set **Root Directory** to: `apps/dealer-dashboard`
   - This tells Vercel where your Next.js app is

2. **Update vercel.json in app directory**
   The `apps/dealer-dashboard/vercel.json` should be:
   ```json
   {
     "buildCommand": "pnpm build",
     "outputDirectory": ".next",
     "installCommand": "cd ../.. && pnpm install",
     "framework": "nextjs"
   }
   ```

3. **Or use Turborepo build**
   ```json
   {
     "buildCommand": "cd ../.. && pnpm --filter @autoagent/dealer-dashboard build",
     "outputDirectory": ".next",
     "installCommand": "cd ../.. && pnpm install",
     "framework": "nextjs"
   }
   ```

## Quick Fix Command

After updating settings in dashboard, redeploy:

```bash
cd apps/dealer-dashboard
vercel --prod
```

## Current Deployment URLs

- **Preview**: https://dealer-dashboard-l5feibfx5-dustins-projects-2a4636fb.vercel.app
- **Production**: (will be set after successful deployment)

## Next Steps After Successful Deployment

1. **Configure Supabase Redirect URLs**
   - Add: `https://your-vercel-url.vercel.app/auth`
   - Add: `https://your-vercel-url.vercel.app/app/setup`

2. **Test Login**
   - Visit: `https://your-vercel-url.vercel.app/auth`
   - Should see login page (not 404)

3. **Set Up Demo Account**
   - Run: `node scripts/setup-vercel-demo.js`

