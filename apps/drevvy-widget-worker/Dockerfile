FROM mcr.microsoft.com/playwright:v1.49.1-jammy

WORKDIR /app

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV DRY_RUN=true

COPY package.json ./
# typescript is a devDependency. NODE_ENV=production (here or from the platform)
# would skip it and `npm run build` would fail with `tsc: not found`.
RUN NODE_ENV=development npm install

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
COPY examples ./examples
RUN npm run build && npm prune --omit=dev

ENV NODE_ENV=production

CMD ["node", "dist/cli.js", "health"]
