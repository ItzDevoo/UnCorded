FROM oven/bun:1.2 AS base
WORKDIR /app

# Copy monorepo root files
COPY package.json bun.lock turbo.json ./

# Copy all workspace package.json files (lockfile needs them)
COPY packages/ packages/
COPY apps/server/ apps/server/
COPY apps/web/package.json apps/web/package.json
COPY apps/admin/package.json apps/admin/package.json

# Clean host symlinks that Docker may copy from Windows, then install fresh
RUN find . -path '*/node_modules' -type d -exec rm -rf {} + 2>/dev/null; bun install

# Non-root user
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser \
    && chown -R appuser:appgroup /app
USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD bun -e "fetch('http://localhost:3000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["bun", "run", "apps/server/src/index.ts"]
