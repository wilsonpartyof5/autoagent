FROM node:20-bullseye
RUN apt-get update && apt-get install -y python3 python3-pip build-essential && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile
# Build shared package first (required for mcp-server)
# Fixed: Added .js extensions, Dealer type export, and ESM module type for compatibility
RUN pnpm --filter @autoagent/shared build
# Build mcp-server (depends on shared package)
RUN pnpm --filter @autoagent/mcp-server build
EXPOSE 8787
CMD ["pnpm", "--filter", "@autoagent/mcp-server", "start"]
