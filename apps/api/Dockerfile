### Build stage

FROM denoland/deno:latest AS builder
ENV DENO_DIR=/deno-dir
WORKDIR /app
COPY deno.json deno.lock package.json* ./
RUN deno ci --prod --skip-types
COPY . .

### Production stage

FROM denoland/deno:latest
ENV DENO_DIR=/deno-dir
WORKDIR /app
COPY --from=builder --chown=deno:deno /app .
COPY --from=builder --chown=deno:deno /deno-dir /deno-dir
USER deno
EXPOSE 3000
CMD ["deno", "run", "--allow-env", "--allow-ffi", "--allow-net", "--allow-read", "--allow-run", "--allow-write", "--env-file", "--watch", "src/index.ts"] 