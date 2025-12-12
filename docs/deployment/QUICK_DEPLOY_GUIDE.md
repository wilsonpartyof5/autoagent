# Quick Deployment Guide for Railway & Vercel

This guide explains how to commit changes and deploy to Railway (MCP Server) and Vercel (Dealer Dashboard).

---

## 🚀 Railway Deployment (MCP Server)

Railway **automatically deploys** when you push to GitHub. No manual steps needed!

### How to Deploy to Railway:

1. **Commit your changes:**
   ```bash
   git add .
   git commit -m "Your commit message describing the changes"
   ```

2. **Push to GitHub:**
   ```bash
   git push origin main
   ```

3. **That's it!** Railway will automatically:
   - Detect the push to `main` branch
   - Build using the `Dockerfile`
   - Deploy the new version

### Verify Deployment:

- **Check Railway Dashboard**: https://railway.app → Your project → `mcp-server` service → Deployments tab
- **Check logs**: Railway Dashboard → `mcp-server` → Logs tab
- **Health check**: `curl https://your-railway-url.up.railway.app/health`

### Optional: Trigger Script

If you want to force a rebuild (useful for cache issues):

```bash
bash scripts/trigger-railway-rebuild.sh
```

This updates a cache-busting file and pushes to trigger a fresh build.

---

## 🌐 Vercel Deployment (Dealer Dashboard)

Vercel **automatically deploys** when you push to GitHub. No manual steps needed!

### How to Deploy to Vercel:

1. **Commit your changes:**
   ```bash
   git add .
   git commit -m "Your commit message describing the changes"
   ```

2. **Push to GitHub:**
   ```bash
   git push origin main
   ```

3. **That's it!** Vercel will automatically:
   - Detect the push to `main` branch
   - Build the Next.js app from `apps/dealer-dashboard`
   - Deploy to production

### Verify Deployment:

- **Check Vercel Dashboard**: https://vercel.com/dashboard → Your project → Deployments tab
- **Check build logs**: Vercel Dashboard → Your project → Deployments → Click on deployment → View build logs
- **Visit your site**: `https://your-project.vercel.app`

### Manual Deployment (if needed):

If auto-deploy is disabled or you want to force a deploy:

```bash
cd apps/dealer-dashboard
vercel --prod
```

---

## 📝 Standard Workflow

For both platforms, the workflow is the same:

```bash
# 1. Make your code changes
# ... edit files ...

# 2. Stage changes
git add .

# 3. Commit with descriptive message
git commit -m "feat: add new feature" 
# or
git commit -m "fix: resolve bug in component"
# or
git commit -m "refactor: improve code structure"

# 4. Push to GitHub
git push origin main

# 5. Wait for automatic deployment
# - Railway: Check Railway dashboard
# - Vercel: Check Vercel dashboard
```

---

## 🔍 Troubleshooting

### Railway Not Deploying

1. **Check GitHub connection:**
   - Railway Dashboard → Your project → Settings → Source
   - Ensure GitHub repo is connected

2. **Check branch:**
   - Railway only auto-deploys from `main` branch
   - Make sure you're pushing to `main`, not a feature branch

3. **Check build logs:**
   - Railway Dashboard → `mcp-server` → Deployments → Click latest → View logs
   - Look for build errors

### Vercel Not Deploying

1. **Check GitHub connection:**
   - Vercel Dashboard → Your project → Settings → Git
   - Ensure GitHub repo is connected

2. **Check branch:**
   - Vercel auto-deploys `main` to production
   - Other branches create preview deployments

3. **Check build logs:**
   - Vercel Dashboard → Your project → Deployments → Click latest → View build logs
   - Look for build errors

4. **Check root directory:**
   - Vercel Dashboard → Your project → Settings → General
   - Root Directory should be: `apps/dealer-dashboard`

### Build Failures

**Railway:**
- Check `Dockerfile` is correct
- Check environment variables are set in Railway Dashboard
- Check build logs for specific errors

**Vercel:**
- Check `package.json` has correct build script
- Check environment variables are set in Vercel Dashboard
- Check build logs for specific errors
- Ensure `pnpm` is selected as package manager

---

## 🎯 Key Points

1. **Both platforms auto-deploy on `git push origin main`**
   - No CLI commands needed
   - No manual triggers needed
   - Just commit and push!

2. **Railway** deploys the MCP Server (backend)
   - Uses `Dockerfile` for builds
   - Located at repo root

3. **Vercel** deploys the Dealer Dashboard (frontend)
   - Uses Next.js build system
   - Located in `apps/dealer-dashboard`

4. **Always check deployment logs** if something goes wrong
   - Railway: Dashboard → Service → Logs
   - Vercel: Dashboard → Project → Deployments → Build logs

---

## 📚 Additional Resources

- **Railway Docs**: https://docs.railway.app
- **Vercel Docs**: https://vercel.com/docs
- **Detailed Railway Guide**: `docs/deployment/RAILWAY_DEPLOYMENT_GUIDE.md`
- **Detailed Vercel Guide**: `docs/deployment/VERCEL_DEPLOYMENT.md`

---

## ✅ Quick Checklist

Before pushing:
- [ ] Code changes are complete
- [ ] Tests pass (if applicable)
- [ ] No console errors
- [ ] Environment variables are set (if adding new ones)

After pushing:
- [ ] Check Railway deployment status
- [ ] Check Vercel deployment status
- [ ] Verify build succeeded
- [ ] Test the deployed application

---

**Remember**: Just `git commit` and `git push origin main` - both platforms handle the rest automatically! 🚀

