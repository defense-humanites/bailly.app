# The front end on Node.js (Nitro's `node-server`), for a server of one's own (cf.
# deploy/README.md). Built from the repository's root:
#
#   docker build -f apps/web/Dockerfile -t bailly-web .
#
# Outside Cloudflare, the synchronization lockers are kept in SQLite
# (`.data/sync.sqlite`, cf. `nuxt.config.ts`): mount a persistent volume on
# /app/.data.

FROM node:24-slim AS build
WORKDIR /repo
# pnpm, at the version of `packageManager` (package.json).
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .node-version ./
COPY packages packages
COPY apps/web apps/web
RUN pnpm install --frozen-lockfile --filter bailly-app
RUN pnpm --filter bailly-app run build

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build /repo/apps/web/.output /app/.output
RUN mkdir -p /app/.data && chown node:node /app/.data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/robots.txt').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", ".output/server/index.mjs"]
