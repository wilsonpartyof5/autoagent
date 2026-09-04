# Railway production MCP server image
# Trigger: harden apt against Debian mirror 404s (2026-09-04)
FROM node:20-bookworm
# node-gyp (better-sqlite3) needs python3 + a compiler, not pip.
# Skip python3-pip so we do not pull python3-pkg-resources from flaky security mirrors.
RUN set -eux; \
    apt-get update -o Acquire::Retries=5; \
    apt-get install -y --no-install-recommends -o Acquire::Retries=5 \
      python3 \
      build-essential; \
    rm -rf /var/lib/apt/lists/*
WORKDIR /app
# Copy lockfile and package files for dependency layer caching
# This allows Docker to cache the pnpm install step unless dependencies change
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/mcp-server/package.json ./apps/mcp-server/
# Install dependencies (cached layer - only rebuilds if lockfile/package.json changes)
RUN corepack enable && pnpm install --frozen-lockfile
# Copy all source code (invalidates cache when code changes, but keeps dependency layer cached)
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
