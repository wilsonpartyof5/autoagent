# Vercel Deployment Guide for AutoAgent Dealer Dashboard

This guide walks you through deploying the AutoAgent dealer dashboard to Vercel.

## Prerequisites

- Vercel account (sign up at https://vercel.com)
- GitHub repository with your code (or GitLab/Bitbucket)
- Supabase project configured
- Environment variables ready

## Quick Deploy (Recommended)

### Option 1: Deploy via Vercel Dashboard

1. **Go to Vercel Dashboard**
   - Visit https://vercel.com/dashboard
   - Click "Add New Project"

2. **Import Your Repository**
   - Connect your Git provider (GitHub, GitLab, Bitbucket)
   - Select the `AutoAgent` repository
   - Click "Import"

3. **Configure Project Settings**
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `apps/dealer-dashboard`
   - **Build Command**: `pnpm build` (or leave default)
   - **Output Directory**: `.next` (or leave default)
   - **Install Command**: `pnpm install` (or leave default)

4. **Set Environment Variables**
   Click "Environment Variables" and add:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://vqoawedqmeybbndvqxta.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

5. **Deploy**
   - Click "Deploy"
   - Wait for build to complete
   - Your app will be live at `https://your-project.vercel.app`

### Option 2: Deploy via Vercel CLI

1. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **Navigate to Dealer Dashboard**
   ```bash
   cd apps/dealer-dashboard
   ```

4. **Deploy**
   ```bash
   vercel
   ```
   
   Follow the prompts:
   - Link to existing project? (No for first deploy)
   - Project name: `autoagent-dealer-dashboard`
   - Directory: `./` (current directory)
   - Override settings? (No)

5. **Set Environment Variables**
   ```bash
   vercel env add NEXT_PUBLIC_SUPABASE_URL
   # Enter: https://vqoawedqmeybbndvqxta.supabase.co
   
   vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
   # Enter: your_supabase_anon_key
   ```

6. **Redeploy with Environment Variables**
   ```bash
   vercel --prod
   ```

## Monorepo Configuration

Since this is a monorepo with Turborepo, Vercel needs to know:

1. **Root Directory**: `apps/dealer-dashboard`
2. **Build Command**: `pnpm build` (runs in the app directory)
3. **Install Command**: `pnpm install` (from root)

The `vercel.json` file in the root handles this configuration.

## Environment Variables

### Required Variables

Add these in Vercel Dashboard → Project Settings → Environment Variables:

| Variable | Value | Environment |
|----------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://vqoawedqmeybbndvqxta.supabase.co` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key | Production, Preview, Development |

### Optional Variables

| Variable | Value | Environment |
|----------|-------|-------------|
| `NEXT_PUBLIC_APP_URL` | `https://autoagent-dealer-dashboard.vercel.app` | Production |
| `MARKETCHECK_API_KEY` | Your MarketCheck API key | Production (if needed server-side) |

## Supabase Redirect URLs

After deployment, configure Supabase redirect URLs:

1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Add these Redirect URLs:
   - `https://autoagent-dealer-dashboard.vercel.app`
   - `https://autoagent-dealer-dashboard.vercel.app/auth`
   - `https://autoagent-dealer-dashboard.vercel.app/app/setup`
   - `https://autoagent-dealer-dashboard.vercel.app/app/inventory`

## Custom Domain (Optional)

1. **Add Domain in Vercel**
   - Go to Project Settings → Domains
   - Add your custom domain (e.g., `dashboard.autoagent.com`)

2. **Configure DNS**
   - Add CNAME record pointing to `cname.vercel-dns.com`
   - Or A record as instructed by Vercel

3. **Update Supabase Redirect URLs**
   - Add your custom domain URLs to Supabase

## Build Configuration

The project uses:
- **Package Manager**: pnpm
- **Framework**: Next.js 15
- **Monorepo**: Turborepo

Vercel should auto-detect these settings, but you can verify in Project Settings.

## Troubleshooting

### Build Fails

**Error: "Cannot find module"**
- Ensure `pnpm install` runs from the root directory
- Check that `turbo.json` is configured correctly
- Verify all dependencies are in `package.json`

**Error: "Command not found: pnpm"**
- Vercel should auto-detect pnpm, but you can set it explicitly:
  - Project Settings → General → Package Manager: `pnpm`

**Error: "Build output not found"**
- Check that `outputDirectory` in `vercel.json` is correct
- For Next.js, it should be `.next` (in the app directory)

### 404 Errors

**All routes return 404**
- Check that `rootDirectory` is set to `apps/dealer-dashboard`
- Verify the build completed successfully
- Check Vercel deployment logs

**Specific routes return 404**
- Verify the route exists in `apps/dealer-dashboard/src/app/`
- Check Next.js routing structure
- Ensure middleware is configured correctly

### Environment Variables Not Working

**Variables not accessible in browser**
- Ensure they start with `NEXT_PUBLIC_` for client-side access
- Redeploy after adding new variables
- Check that variables are set for the correct environment (Production/Preview/Development)

### Authentication Issues

**Supabase redirect errors**
- Verify redirect URLs are configured in Supabase
- Check that `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set
- Ensure cookies are working (check browser console)

## Deployment Checklist

- [ ] Repository connected to Vercel
- [ ] Root directory set to `apps/dealer-dashboard`
- [ ] Build command: `pnpm build`
- [ ] Environment variables configured
- [ ] Supabase redirect URLs added
- [ ] Build completes successfully
- [ ] App accessible at Vercel URL
- [ ] Login page works (`/auth`)
- [ ] Authentication flow works
- [ ] Dashboard loads after login

## Post-Deployment

1. **Test Login**
   - Go to `https://your-project.vercel.app/auth`
   - Test sign up and sign in

2. **Set Up Demo Account**
   - Run `node scripts/setup-vercel-demo.js` (requires service role key)
   - Or use SQL script: `scripts/setup-vercel-demo-sql-only.sql`

3. **Verify Inventory**
   - Log in with demo account
   - Check `/app/inventory` shows vehicles

## Continuous Deployment

Vercel automatically deploys on:
- Push to `main` branch → Production
- Push to other branches → Preview
- Pull requests → Preview

To disable auto-deploy:
- Project Settings → Git → Disable "Automatic deployments"

## Manual Deployment

```bash
cd apps/dealer-dashboard
vercel --prod
```

## Rollback

If a deployment fails:

1. Go to Vercel Dashboard → Deployments
2. Find the last working deployment
3. Click "..." → "Promote to Production"

## Support

- Vercel Docs: https://vercel.com/docs
- Next.js Deployment: https://nextjs.org/docs/deployment
- Vercel Support: https://vercel.com/support

