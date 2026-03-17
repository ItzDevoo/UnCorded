FROM oven/bun:1.2 AS base
WORKDIR /app

# Copy monorepo root files
COPY package.json bun.lock turbo.json ./

# Copy all workspace package.json files (lockfile needs them)
COPY packages/ packages/
COPY apps/server/ apps/server/
COPY apps/web/package.json apps/web/package.json

# Install dependencies
RUN bun install --frozen-lockfile

EXPOSE 3000

CMD ["bun", "run", "apps/server/src/index.ts"]
