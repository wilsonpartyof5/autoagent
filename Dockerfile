FROM node:20-bullseye
RUN apt-get update && apt-get install -y python3 python3-pip build-essential && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile
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
