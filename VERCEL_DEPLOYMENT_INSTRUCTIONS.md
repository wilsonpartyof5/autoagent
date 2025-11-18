# Vercel Deployment Instructions - Marketing Landing Page

## Current Status
- ✅ Project linked: `autoagent-dealer-dashboard`
- ✅ Marketing landing page exists: `apps/dealer-dashboard/src/app/page.tsx`
- ⚠️ Build failing due to pnpm version and native module issues
- ⚠️ Domains showing old placeholder

## Required Vercel Dashboard Configuration

### Step 1: Update Project Settings

**URL**: https://vercel.com/dustins-projects-2a4636fb/autoagent-dealer-dashboard/settings/general

Update these settings:

1. **Root Directory**: `apps/dealer-dashboard` ✅
2. **Framework Preset**: Next.js ✅
3. **Build Command**: `pnpm build`
4. **Output Directory**: `.next`
5. **Install Command**: Leave **EMPTY** (Vercel will auto-detect and use pnpm from packageManager field)
6. **Node.js Version**: 22.x (or use project default)
7. **Package Manager**: pnpm (should auto-detect from `packageManager` field in root package.json)

**Important**: When Install Command is empty, Vercel will:
- Read `packageManager: "pnpm@8.15.0"` from root `package.json`
- Use corepack to activate the correct pnpm version
- Run install from the root directory (respecting monorepo structure)

### Step 2: Verify Domain Configuration

**URL**: https://vercel.com/dustins-projects-2a4636fb/autoagent-dealer-dashboard/settings/domains

Verify:
- ✅ `autoagentapp.com` is attached (primary domain)
- ✅ `www.autoagentapp.com` is attached and redirects to `autoagentapp.com`

If domains are missing:
1. Click "Add Domain"
2. Add `autoagentapp.com` (primary)
3. Add `www.autoagentapp.com` and configure redirect to apex

### Step 3: Trigger Fresh Deployment

**Option A: Via Dashboard (Recommended)**
1. Go to: https://vercel.com/dustins-projects-2a4636fb/autoagent-dealer-dashboard/deployments
2. Find latest deployment
3. Click "..." → "Redeploy"
4. **Uncheck** "Use existing Build Cache"
5. Click "Redeploy"

**Option B: Via CLI**
```bash
cd /Users/mac/AutoAgent
vercel --prod --force
```

**Option C: Via Git Push**
```bash
git commit --allow-empty -m "Trigger Vercel deployment for marketing landing"
git push origin main
```

### Step 4: Verify Deployment

After deployment succeeds:

1. **Check Vercel URL**:
   ```bash
   curl -I https://autoagent-dealer-dashboard.vercel.app
   ```
   Should return 200

2. **Check Apex Domain**:
   ```bash
   curl -I https://autoagentapp.com
   ```
   Should return 200 (or 307 redirect to www if configured)

3. **Check WWW Domain**:
   ```bash
   curl -I https://www.autoagentapp.com
   ```
   Should return 200

4. **Verify Content**:
   Visit in browser and confirm you see the marketing landing page (not placeholder):
   - Header with navigation
   - Hero section
   - Features section
   - Benefits section
   - Final CTA
   - Footer

### Step 5: Clear Edge Cache (if needed)

If domains still show old content:

1. Go to: https://vercel.com/dustins-projects-2a4636fb/autoagent-dealer-dashboard/settings/domains
2. For each domain (`autoagentapp.com`, `www.autoagentapp.com`):
   - Click "..." → "Clear Cache"
3. Wait 1-2 minutes
4. Test again

## Why Empty Install Command Works

When Install Command is empty, Vercel:
1. Detects `packageManager: "pnpm@8.15.0"` in root `package.json`
2. Uses corepack to activate pnpm 8.15.0 automatically
3. Runs `pnpm install` from the repository root
4. Respects the monorepo structure and installs all workspace dependencies

This is better than manually specifying the install command because:
- Vercel handles pnpm version management via corepack
- Works correctly with monorepos
- Respects the `packageManager` field in package.json

## Troubleshooting

### Build Still Fails

If build continues to fail:

1. **Check Root Directory**: Must be `apps/dealer-dashboard`
2. **Check package.json**: Must have `packageManager: "pnpm@8.15.0"` in root
3. **Check Node Version**: Should be 18+ (22.x recommended)
4. **Remove vercel.json**: If issues persist, delete `apps/dealer-dashboard/vercel.json` and let Vercel auto-detect

### better-sqlite3 Build Error

If you see `better-sqlite3` build errors:
- This is a native module used by the MCP server
- It may not be needed for the dashboard build
- The build should continue even if this fails (it's in a different workspace)
- If it blocks the build, we can exclude it or mark it as optional

### Domains Not Updating

1. **Check Domain Assignment**: Ensure domains point to `autoagent-dealer-dashboard` project
2. **Check DNS**: Verify DNS records are correct
3. **Wait for Propagation**: DNS changes can take up to 48 hours
4. **Clear Browser Cache**: Hard refresh (Cmd+Shift+R / Ctrl+Shift+R)
5. **Clear Vercel Edge Cache**: Use domain settings → Clear Cache

## Expected Results

After successful deployment:

- ✅ `https://autoagent-dealer-dashboard.vercel.app` → Marketing landing (200)
- ✅ `https://autoagentapp.com` → Marketing landing (200)
- ✅ `https://www.autoagentapp.com` → Marketing landing (200) or redirect to apex
- ✅ `/auth` → Login page (200)
- ✅ `/app/*` → Protected routes (redirect to `/auth` if not logged in)

## Current Configuration Files

- `vercel.json` (root) - Contains rootDirectory and build settings
- `apps/dealer-dashboard/vercel.json` - App-specific settings (may conflict, consider removing)
- `.vercel/project.json` - Project link (auto-generated)

## Next Steps

1. ✅ Update Vercel Dashboard settings (Step 1)
2. ✅ Verify domain configuration (Step 2)
3. ⏳ Trigger fresh deployment (Step 3)
4. ⏳ Verify deployment (Step 4)
5. ⏳ Clear cache if needed (Step 5)

