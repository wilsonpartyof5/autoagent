FROM node:20-bullseye
RUN apt-get update && apt-get install -y python3 python3-pip build-essential && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm --filter @autoagent/shared build
RUN pnpm --filter @autoagent/mcp-server build
EXPOSE 8787
CMD ["pnpm", "--filter", "@autoagent/mcp-server", "start"]
