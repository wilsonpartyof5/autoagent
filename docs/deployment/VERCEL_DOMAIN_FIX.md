# Vercel Domain Configuration Fix

## Current Status

- **Vercel Project**: `autoagent-dealer-dashboard` (dustins-projects-2a4636fb)
- **Apex Domain**: `autoagentapp.com` → Redirects to `www.autoagentapp.com` (307)
- **WWW Domain**: `www.autoagentapp.com` → Returns 200
- **Vercel URL**: `https://autoagent-dealer-dashboard.vercel.app`

## Issue

The deployment is showing an old placeholder page instead of the new marketing landing page. Recent deployments are failing due to monorepo build configuration.

## Solution: Configure via Vercel Dashboard

Since this is a monorepo, Vercel needs to be configured via the Dashboard, not just `vercel.json`.

### Step 1: Update Project Settings

1. Go to: https://vercel.com/dustins-projects-2a4636fb/autoagent-dealer-dashboard/settings/general

2. Update these settings:
   - **Root Directory**: `apps/dealer-dashboard` ✅ (should already be set)
   - **Framework Preset**: Next.js ✅
   - **Build Command**: `pnpm build` (runs in app directory)
   - **Output Directory**: `.next` ✅
   - **Install Command**: Leave empty or set to `pnpm install` (Vercel will handle monorepo)

3. **Package Manager**: Ensure it's set to `pnpm`

### Step 2: Verify Domain Configuration

1. Go to: https://vercel.com/dustins-projects-2a4636fb/autoagent-dealer-dashboard/settings/domains

2. Verify domains are attached:
   - `autoagentapp.com` → Should be primary
   - `www.autoagentapp.com` → Should redirect to apex

3. If domains are missing or pointing to wrong project:
   - Add `autoagentapp.com` as primary domain
   - Add `www.autoagentapp.com` and configure redirect to apex

### Step 3: Trigger Fresh Deployment

**Option A: Via Dashboard**
1. Go to Deployments tab
2. Find the latest successful deployment (or any deployment)
3. Click "..." → "Redeploy"
4. Select "Use existing Build Cache" = OFF (to force fresh build)

**Option B: Via CLI**
```bash
cd apps/dealer-dashboard
vercel --prod --force
```

**Option C: Via Git Push**
```bash
git commit --allow-empty -m "Trigger Vercel deployment"
git push origin main
```

### Step 4: Verify Deployment

After deployment succeeds:

1. **Check Vercel URL**:
   ```bash
   curl -I https://autoagent-dealer-dashboard.vercel.app
   ```
   Should return 200 with new marketing page

2. **Check Apex Domain**:
   ```bash
   curl -I https://autoagentapp.com
   ```
   Should redirect (307) to www

3. **Check WWW Domain**:
   ```bash
   curl -I https://www.autoagentapp.com
   ```
   Should return 200 with new marketing page

4. **Verify Content**:
   Visit in browser and confirm you see:
   - Header with navigation
   - Hero section
   - Features section
   - Benefits section
   - Final CTA
   - Footer

### Step 5: Clear Edge Cache (if needed)

If domains still show old content after successful deployment:

1. Go to Vercel Dashboard → Project → Settings → Domains
2. For each domain, click "..." → "Clear Cache"
3. Wait 1-2 minutes
4. Test again

## Troubleshooting

### Build Still Failing

If build continues to fail with "No Next.js version detected":

1. **Check Root Directory**: Must be `apps/dealer-dashboard`
2. **Check package.json**: Must be in `apps/dealer-dashboard/package.json`
3. **Try removing vercel.json**: Let Vercel auto-detect Next.js

### Domains Not Updating

1. **Check Domain Assignment**: Ensure domains point to correct project
2. **Check DNS**: Verify DNS records are correct
3. **Wait for Propagation**: DNS changes can take up to 48 hours
4. **Clear Browser Cache**: Hard refresh (Cmd+Shift+R / Ctrl+Shift+R)

### Still Seeing Placeholder

1. **Check Deployment**: Ensure latest deployment succeeded
2. **Check Route**: Verify `/` route serves marketing page (not `/app`)
3. **Check Middleware**: Ensure middleware doesn't redirect `/` to `/app`
4. **Check Build Output**: Verify `.next` contains marketing page

## Expected Results

After successful deployment:

- ✅ `https://autoagent-dealer-dashboard.vercel.app` → New marketing landing (200)
- ✅ `https://autoagentapp.com` → Redirects to www (307)
- ✅ `https://www.autoagentapp.com` → New marketing landing (200)
- ✅ `/auth` → Login page (200)
- ✅ `/app/*` → Protected routes (redirect to `/auth` if not logged in)

## Files to Verify

Marketing landing page should be at:
- `apps/dealer-dashboard/src/app/page.tsx` ✅ (exists)
- `apps/dealer-dashboard/src/app/(marketing)/page.tsx` ✅ (exists)

Both should render the marketing components:
- Header
- Hero
- Features
- Benefits
- Final CTA
- Footer
