#!/bin/bash

# AutoAgent Production Deployment Script
set -e

echo "🚀 Starting AutoAgent Production Deployment..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check if required environment variables are set
if [ -z "$MARKETCHECK_API_KEY" ]; then
    echo "❌ MARKETCHECK_API_KEY is not set"
    exit 1
fi

if [ -z "$LEAD_ENC_KEY" ]; then
    echo "❌ LEAD_ENC_KEY is not set"
    exit 1
fi

# Create SSL directory if it doesn't exist
mkdir -p ssl

# Generate self-signed certificate for development
if [ ! -f ssl/cert.pem ] || [ ! -f ssl/key.pem ]; then
    echo "🔐 Generating SSL certificates..."
    openssl req -x509 -newkey rsa:4096 -keyout ssl/key.pem -out ssl/cert.pem -days 365 -nodes -subj "/C=US/ST=State/L=City/O=AutoAgent/CN=localhost"
fi

# Build and start services
echo "🏗️  Building and starting services..."
docker-compose down --remove-orphans
docker-compose up --build -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
timeout=60
counter=0

while [ $counter -lt $timeout ]; do
    if curl -f http://localhost/health > /dev/null 2>&1; then
        echo "✅ Services are healthy!"
        break
    fi
    
    echo "⏳ Waiting for services... ($counter/$timeout)"
    sleep 2
    counter=$((counter + 2))
done

if [ $counter -ge $timeout ]; then
    echo "❌ Services failed to start within $timeout seconds"
    docker-compose logs
    exit 1
fi

# Display service status
echo "📊 Service Status:"
docker-compose ps

echo "🌐 Services available at:"
echo "  - MCP Server: https://localhost/mcp"
echo "  - Health Check: https://localhost/health"
echo "  - Monitoring: http://localhost:9090"

echo "✅ Deployment complete!"
echo ""
echo "🔧 To view logs: docker-compose logs -f"
echo "🛑 To stop: docker-compose down"
echo "🔄 To restart: docker-compose restart"
