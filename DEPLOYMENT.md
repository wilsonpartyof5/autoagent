# 🚀 AutoAgent Production Deployment Guide

## 🏗️ **Production Architecture**

### **Components**
- **MCP Server**: Core application with health checks
- **Nginx**: Reverse proxy with SSL termination and rate limiting
- **Prometheus**: Monitoring and metrics collection
- **Docker**: Containerization for consistency

### **Benefits Over Development Setup**
✅ **Automatic Restarts** - Services restart on failure  
✅ **Health Monitoring** - Continuous health checks  
✅ **SSL/TLS Security** - Production-grade encryption  
✅ **Rate Limiting** - Protection against abuse  
✅ **Load Balancing** - Multiple server instances  
✅ **Monitoring** - Real-time metrics and alerts  

---

## 🚀 **Quick Start (Local Production)**

### **1. Prerequisites**
```bash
# Install Docker and Docker Compose
brew install docker docker-compose

# Set environment variables
export MARKETCHECK_API_KEY="your_api_key"
export LEAD_ENC_KEY="your_encryption_key"
export DASHBOARD_INGEST_URL="https://your-dashboard.com/api/ingest/lead"
export DASHBOARD_INGEST_TOKEN="your_token"
```

### **2. Deploy**
```bash
# Run the deployment script
./scripts/deploy.sh
```

### **3. Verify**
```bash
# Check service health
curl https://localhost/health

# Test MCP endpoint
curl https://localhost/mcp -X POST -H "Content-Type: application/json" -d '{"method":"tools/list"}'

# View monitoring
open http://localhost:9090
```

---

## ☁️ **Cloud Deployment Options**

### **Option 1: AWS ECS + Application Load Balancer**
```yaml
# aws-ecs.yml
version: '3.8'
services:
  mcp-server:
    image: your-registry/autoagent-mcp:latest
    environment:
      - NODE_ENV=production
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
```

### **Option 2: Google Cloud Run**
```bash
# Deploy to Cloud Run
gcloud run deploy autoagent-mcp \
  --image gcr.io/your-project/autoagent-mcp \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8787
```

### **Option 3: Railway (Recommended for MCP Server)**
```bash
# Deploy to Railway
railway deploy
```

#### **Railway Deployment Steps**

1. **Connect Repository**
   - Go to [Railway.app](https://railway.app)
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your AutoAgent repository
   - Railway will auto-detect the `railway.json` configuration

2. **Environment Variables**
   - In Railway dashboard, go to Variables tab
   - Add the following required variables:
   ```bash
   PORT=8787
   MARKETCHECK_API_KEY=your_production_api_key
   LEAD_ENC_KEY=your_32_byte_base64_key
   DASHBOARD_INGEST_URL=https://your-dashboard.com/api/ingest/lead
   DASHBOARD_INGEST_TOKEN=your_secure_token
   WIDGET_HOST=https://your-railway-domain.railway.app
   AA_DIAG=1
   ```

3. **Optional: Add Postgres Database**
   - Click "New" → "Database" → "PostgreSQL"
   - Railway will provide `DATABASE_URL` automatically
   - Update your app to use Postgres instead of SQLite

4. **Deploy**
   - Railway will automatically build and deploy using `railway.json`
   - Build command: `pnpm install --frozen-lockfile && pnpm --filter mcp-server build`
   - Start command: `pnpm --filter mcp-server start`

5. **Verify Deployment**
   ```bash
   # Health check
   curl https://your-railway-domain.railway.app/health
   
   # Test MCP endpoint
   curl https://your-railway-domain.railway.app/mcp \
     -X POST \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
   
   # Test widget
   curl https://your-railway-domain.railway.app/widget/vehicle-results
   ```

#### **Railway Configuration**
The `railway.json` file configures:
- **Build**: Uses pnpm with frozen lockfile for reproducible builds
- **Start**: Runs the MCP server with proper health checks
- **Health Check**: `/health` endpoint with 100ms timeout
- **Restart Policy**: Automatic restart on failure (max 10 retries)

#### **Railway Benefits**
✅ **Zero Configuration** - Works out of the box with `railway.json`  
✅ **Automatic HTTPS** - SSL certificates handled automatically  
✅ **Global CDN** - Fast response times worldwide  
✅ **Auto-scaling** - Handles traffic spikes automatically  
✅ **Built-in Monitoring** - Logs and metrics in Railway dashboard  
✅ **Git Integration** - Auto-deploy on git push to main branch

---

## 🔧 **Production Configuration**

### **Environment Variables**
```bash
# Required
MARKETCHECK_API_KEY=your_production_key
LEAD_ENC_KEY=your_encryption_key
DASHBOARD_INGEST_URL=https://your-dashboard.com/api/ingest/lead
DASHBOARD_INGEST_TOKEN=your_production_token

# Optional
NODE_ENV=production
LOG_LEVEL=info
PROMETHEUS_ENABLED=true
```

### **SSL/TLS Setup**
```bash
# For production, use real certificates
# Let's Encrypt (recommended)
certbot --nginx -d your-domain.com

# Or upload your certificates to ssl/ directory
```

---

## 📊 **Monitoring & Alerting**

### **Health Checks**
- **Endpoint**: `https://your-domain.com/health`
- **Interval**: Every 30 seconds
- **Timeout**: 10 seconds
- **Retries**: 3 attempts

### **Metrics Available**
- Request count and latency
- Error rates
- Memory and CPU usage
- Active connections

### **Alerting Rules**
```yaml
# prometheus-alerts.yml
groups:
  - name: autoagent
    rules:
      - alert: MCPServerDown
        expr: up{job="mcp-server"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "MCP Server is down"
```

---

## 🛡️ **Security Best Practices**

### **1. Network Security**
- Use private networks for internal communication
- Implement rate limiting (10 requests/second)
- Enable CORS for ChatGPT integration
- Use HTTPS everywhere

### **2. Application Security**
- Encrypt sensitive data (leads, API keys)
- Use environment variables for secrets
- Implement request validation
- Add security headers

### **3. Infrastructure Security**
- Run containers as non-root user
- Use minimal base images (Alpine Linux)
- Regular security updates
- Monitor for vulnerabilities

---

## 🔄 **CI/CD Pipeline**

### **GitHub Actions Example**
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build and deploy
        run: |
          docker build -t autoagent-mcp .
          docker push your-registry/autoagent-mcp:latest
          # Deploy to your cloud provider
```

---

## 🚨 **Troubleshooting**

### **Common Issues**

**1. Service Won't Start**
```bash
# Check logs
docker-compose logs mcp-server

# Check health
curl https://localhost/health
```

**2. SSL Certificate Issues**
```bash
# Generate new certificate
openssl req -x509 -newkey rsa:4096 -keyout ssl/key.pem -out ssl/cert.pem -days 365 -nodes
```

**3. High Memory Usage**
```bash
# Monitor resources
docker stats

# Scale down if needed
docker-compose up --scale mcp-server=1
```

---

## 📈 **Scaling**

### **Horizontal Scaling**
```bash
# Scale to 3 instances
docker-compose up --scale mcp-server=3
```

### **Load Balancer Configuration**
```nginx
upstream mcp_backend {
    server mcp-server-1:8787;
    server mcp-server-2:8787;
    server mcp-server-3:8787;
}
```

---

## 🎯 **ChatGPT Integration**

### **Production URL**
```
https://your-domain.com/mcp
```

### **Testing**
```bash
# Test the production endpoint
curl https://your-domain.com/mcp \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"method":"tools/list"}'
```

---

## 📋 **Maintenance**

### **Regular Tasks**
- Monitor logs for errors
- Check certificate expiration
- Update dependencies
- Review security patches
- Backup configuration

### **Updates**
```bash
# Update and restart
git pull
docker-compose down
docker-compose up --build -d
```

---

## 🆘 **Support**

- **Health Check**: `https://your-domain.com/health`
- **Monitoring**: `http://your-domain:9090`
- **Logs**: `docker-compose logs -f`
- **Status**: `docker-compose ps`