# The API on Node.js, for a server of one's own (cf. deploy/README.md). Built from
# the repository's root:
#
#   docker build -f apps/api/Dockerfile -t bailly-api .
#
# The image holds Morpheus's stem data (Alpheios), downloaded at build time: their
# licence is unclear, so the image must not be published. The dictionary is not in
# it either: mount the database on /repo/apps/api/database, read-only.
#
# The workspace keeps its layout (no `pnpm deploy`): the shared package
# (`packages/api-types`) stays a link out of `node_modules`, where Node.js would
# refuse to run TypeScript.

FROM node:24-slim AS base
WORKDIR /repo
# pnpm, at the version of `packageManager` (package.json).
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .node-version ./
COPY packages packages
COPY apps/api apps/api

# Morpheus's stem data (pinned revision, verified digests), acquired with the
# development dependencies.
FROM base AS morpheus
RUN pnpm install --frozen-lockfile --filter bailly-api \
  && pnpm --filter bailly-api run morpheus:data

# The runtime dependencies only.
FROM base AS dependencies
RUN pnpm install --prod --frozen-lockfile --filter bailly-api

FROM node:24-slim
ENV NODE_ENV=production PORT=3000
COPY --from=dependencies /repo /repo
COPY --from=morpheus /repo/apps/api/morpheus-data /repo/apps/api/morpheus-data
WORKDIR /repo/apps/api
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
# Node.js 24 runs the TypeScript sources as they are.
CMD ["node", "src/node.ts"]
