FROM node:20-bullseye
RUN apt-get update && apt-get install -y python3 python3-pip build-essential && rm -rf /var/lib/apt/lists/*
WORKDIR /app
# Copy package files first for better layer caching
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/mcp-server/package.json ./apps/mcp-server/
# Install dependencies (this layer will be cached unless lockfile changes)
RUN corepack enable && pnpm install --frozen-lockfile
# Copy rest of the code (this invalidates cache when code changes)
COPY . .
# Clean any existing build artifacts to ensure fresh build
RUN pnpm --filter @autoagent/shared clean || true
RUN pnpm --filter @autoagent/mcp-server clean || true
# Build shared package first (required for mcp-server)
# Fixed: Source files use .js extensions, NodeNext preserves them in output for ESM
RUN pnpm --filter @autoagent/shared build
# Build mcp-server (depends on shared package)
RUN pnpm --filter @autoagent/mcp-server build
EXPOSE 8787
CMD ["pnpm", "--filter", "@autoagent/mcp-server", "start"]
