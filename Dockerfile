# Use Node 20 with Debian Bullseye base
FROM node:20-bullseye

# Install Python 3 and build tools for native dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/mcp-server/package.json ./apps/mcp-server/
COPY packages/shared/package.json ./packages/shared/

# Enable pnpm via corepack
RUN corepack enable

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the MCP server
RUN pnpm --filter mcp-server build

# Expose port
EXPOSE 8787

# Start the MCP server
CMD ["pnpm", "--filter", "mcp-server", "start"]
