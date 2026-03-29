FROM oven/bun:1-alpine AS build

WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile || bun install

COPY tsconfig.json ./
COPY src/ ./src/
RUN bun build src/server.ts --outdir dist --target bun

# --- Production ---
FROM oven/bun:1-alpine

WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY public/ ./public/

RUN mkdir -p /app/data/boards

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["bun", "run", "dist/server.js"]
