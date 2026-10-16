FROM mcr.microsoft.com/playwright:v1.49.1-jammy

WORKDIR /app

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV DRY_RUN=true
ENV NODE_ENV=production

COPY package.json ./
RUN npm install

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

CMD ["node", "dist/cli.js"]
