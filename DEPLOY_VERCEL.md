# Quick Vercel Deployment Guide

## Step 1: Deploy via CLI

```bash
cd apps/dealer-dashboard
vercel
```

Follow the prompts:
- **Set up and deploy?** → Yes
- **Which scope?** → Select your account
- **Link to existing project?** → No (first time)
- **Project name?** → `autoagent-dealer-dashboard`
- **Directory?** → `./` (current directory)

## Step 2: Set Environment Variables

After deployment, set environment variables:

```bash
cd apps/dealer-dashboard
vercel env add NEXT_PUBLIC_SUPABASE_URL production
# Enter: https://vqoawedqmeybbndvqxta.supabase.co

vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
# Enter: your_supabase_anon_key_here
```

Or set them in Vercel Dashboard:
1. Go to https://vercel.com/dashboard
2. Select your project
3. Settings → Environment Variables
4. Add:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://vqoawedqmeybbndvqxta.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (your key)

## Step 3: Redeploy with Environment Variables

```bash
cd apps/dealer-dashboard
vercel --prod
```

## Step 4: Configure Supabase Redirect URLs

1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Add redirect URLs:
   - `https://autoagent-dealer-dashboard.vercel.app`
   - `https://autoagent-dealer-dashboard.vercel.app/auth`
   - `https://autoagent-dealer-dashboard.vercel.app/app/setup`

## Step 5: Test

Visit: `https://autoagent-dealer-dashboard.vercel.app/auth`

## Alternative: Deploy via Vercel Dashboard

1. Go to https://vercel.com/dashboard
2. Click "Add New Project"
3. Import your Git repository
4. Configure:
   - **Root Directory**: `apps/dealer-dashboard`
   - **Framework**: Next.js
   - **Build Command**: `pnpm build`
   - **Output Directory**: `.next`
5. Add environment variables
6. Deploy

