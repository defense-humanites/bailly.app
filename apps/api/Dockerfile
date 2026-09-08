# Development image only. Build the local libmorpheus-deno deno-runtime image first.
ARG MORPHEUS_DENO_IMAGE=morpheus-deno:latest
FROM ${MORPHEUS_DENO_IMAGE}

USER root

RUN apk add --no-cache curl sqlite-libs \
 && mkdir -p /deno-dir \
 && chown -R deno:deno /deno-dir

USER deno

ENV DENO_DIR=/deno-dir
WORKDIR /app
COPY deno.json deno.lock ./
RUN deno cache --lock=deno.lock deno.json
COPY --chown=deno:deno . .

EXPOSE 3000
CMD ["deno", "run", "--allow-env", "--allow-ffi", "--allow-net", \
     "--allow-read", "--allow-write", "--env-file", "--watch", "src/index.ts"]
