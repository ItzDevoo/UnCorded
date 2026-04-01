# UnCorded — Main Branch

This is the deploy target. Subagents land here for quick fixes and merges.

## Commands

- `bun run typecheck` — typecheck all packages
- `bun run lint` — Oxlint
- `bun run fmt` — Oxfmt
- `bun run test` — Vitest

## Deploy Steps

1. `VITE_API_URL="" bun run build --filter=@uncorded/web`
2. `cd .. && docker compose build server` (if server code changed)
3. `cd .. && docker compose up -d server main admin`

## Merge PR Steps

1. `gh pr merge #X --squash && git pull`
2. Deploy (steps above)
3. `git worktree remove ../worktrees/{branch}` (if applicable)

## Rules

- Typecheck + lint before every commit
- Conventional commits: feat/fix/chore/docs/refactor
- Never commit .env, node_modules, .turbo, dist
- Docker compose runs from parent dir `C:\Projects\UnCorded-Dev\`
- Only restart prod services: `server main admin`
- For detailed project rules, read parent CLAUDE.md
