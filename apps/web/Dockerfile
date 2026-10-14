# Web image: the Next.js standalone build (ADR-0016), run by Node as a
# non-root user. Build context: apps/web (`docker build apps/web`). The same
# file builds for linux/amd64 (local) and linux/arm64 (the VM).
#
# TRACEMAIL_API_URL is the API's address inside the Compose network. It is
# fixed at build time because the /api rewrite is compiled into the build;
# server-side data requests read the same variable at run time.
#
# TRACEMAIL_VERSION is the commit SHA CI builds from, shown on the health
# panel (ADR-0002); nothing calls git at run time. Set last, so a new commit
# rebuilds only the final layer.

ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:${NODE_VERSION}-bookworm-slim AS build
WORKDIR /app
ARG TRACEMAIL_API_URL=http://api:8000
ENV TRACEMAIL_API_URL=${TRACEMAIL_API_URL} \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:${NODE_VERSION}-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
USER node
ARG TRACEMAIL_VERSION=""
ENV TRACEMAIL_VERSION=${TRACEMAIL_VERSION}
EXPOSE 3000
CMD ["node", "server.js"]
