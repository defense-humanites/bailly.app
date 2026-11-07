# The API on Node.js, for a server of one's own (cf. deploy/README.md). Built from
# the repository's root:
#
#   docker build -f apps/api/Dockerfile -t bailly-api .
#
# The image holds Morpheus's stem data (Alpheios), downloaded at build time: their
# licence is unclear, so the image must not be published. The dictionary is not in
# it either: mount the database on /app/database, read-only.

FROM node:24-slim AS build
WORKDIR /repo
# pnpm, at the version of `packageManager` (package.json).
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .node-version ./
COPY apps/api apps/api
RUN pnpm install --frozen-lockfile --filter bailly-api
# Morpheus's stem data (pinned revision, verified digests): apps/api/morpheus-data.
RUN pnpm --filter bailly-api run morpheus:data
# The API with its runtime dependencies only.
RUN pnpm --filter bailly-api deploy --prod /app \
  && cp -r apps/api/morpheus-data /app/morpheus-data

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build /app /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
# Node.js 24 runs the TypeScript sources as they are.
CMD ["node", "src/node.ts"]
